// ---------------------------------------------------------------------------
// StockSense demo operations history — a PURE, deterministic generator for
// 90 days of stock operations plus their matching ledger moves. No DB.
//
// The point of this dataset: the Move History page and the dashboard's
// pending-operation counters are the two emptiest screens in the demo. With
// only 6 hand-written operations the lists look fake. This produces a
// believable 90-day trail: receipts flowing in, deliveries going out, internal
// transfers, and cycle-count adjustments, in every lifecycle status so each
// tab on the Operations pages has rows.
//
// Determinism: every field derives from mulberry32(OPERATIONS_SEED ^ hash(sku
// | reference)), so a given operation is identical on every rerun. No Date.now()
// in the output: dates are computed from a fixed ANCHOR_DATE so a rerun a month
// later still produces the same 90-day window.
//
// Every operation is linked to its ledger move(s), so the "History" ledger
// reconciles with the operation list: SUM(moves for an operation) equals the
// operation's done quantities.
// ---------------------------------------------------------------------------
import { mulberry32, hashStringToSeed } from './generateHistory.js';

export const OPERATIONS_SEED = 20260929; // fixed seed constant — do not change
export const HISTORY_DAYS = 90;

// Fixed "now" for the demo window. Deliberately NOT Date.now() — determinism.
export const ANCHOR_DATE = new Date('2026-09-26T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

// Operation mix per day. Weights are relative; total per day is deterministic.
const DAILY_MIX = [
  { type: 'receipt', weight: 5 },
  { type: 'delivery', weight: 6 },
  { type: 'internal_transfer', weight: 3 },
  { type: 'adjustment', weight: 2 },
];

const STATUS_BY_AGE_DAYS = [
  // Recent operations are still in flight; older ones are settled.
  { maxAge: 2, statuses: ['waiting', 'ready', 'draft'] },
  { maxAge: 6, statuses: ['ready', 'done', 'done'] },
  { maxAge: 1000, statuses: ['done', 'done', 'done', 'canceled'] },
];

// Notes pool per type, so the operation detail page reads like real data.
const NOTES = {
  receipt: [
    'Inbound truck unloaded at dock; count verified against packing slip',
    'Vendor delivery received in full, quality check passed',
    'Partial delivery received, balance expected next week',
    'Return-to-vendor replacement accepted and booked in',
    'Scheduled replenishment received against approved purchase order',
  ],
  delivery: [
    'Customer pick-up completed at loading dock',
    'Outbound shipment handed to freight carrier, e-way bill generated',
    'Same-day dispatch confirmed by customer logistics team',
    'Consignment delivered and signed off by site receiver',
    'Transfer order dispatched to regional warehouse',
  ],
  internal_transfer: [
    'Stock moved from bulk floor to assembly station',
    'Replenishment transfer to pick face for next shift',
    'Consolidation move between storage zones',
    'Rebalanced stock ahead of the weekend dispatch wave',
  ],
  adjustment: [
    'Cycle count variance written off after recount',
    'Damaged packaging scrapped during handling',
    'Expired stock removed from active rack',
    'Found stock during aisle recount, added back to inventory',
    'Shortage confirmed by supervisor, adjusted out',
  ],
};

const ADJ_REASONS = ['cycle_count_variance', 'damage', 'expiry', 'found_stock', 'shortage'];

/**
 * Generate the operations + moves dataset deterministically.
 *
 * @param {object} ctx
 * @param {Array<{key:string,sku:string,category:string}>} ctx.products  catalog products
 * @param {Record<string,string>} ctx.locationKeyByCode  location code -> key
 * @param {string[]} ctx.internalLocationKeys  valid destination/source keys
 * @param {string} ctx.vendorLocKey  PARTNER/VENDORS key
 * @param {string} ctx.customerLocKey  PARTNER/CUSTOMERS key
 * @param {string} ctx.lossLocKey  VIRTUAL/LOSS key
 * @param {number} [ctx.userCount] how many creator slots to cycle through
 * @param {string[]} [ctx.suppliers] supplier partner names
 * @param {string[]} [ctx.customers] customer partner names
 * @param {number} [ctx.seed]
 * @returns {{operations:Array,moves:Array,summary:object}}
 */
export function generateOperationsHistory(ctx) {
  const {
    products,
    locationKeyByCode,
    internalLocationKeys,
    vendorLocKey,
    customerLocKey,
    lossLocKey,
    userCount = 3,
    days = HISTORY_DAYS,
    suppliers = [],
    customers = [],
    seed = OPERATIONS_SEED,
  } = ctx;

  if (!products || products.length === 0) throw new Error('generateOperationsHistory: products required');
  if (!internalLocationKeys || internalLocationKeys.length === 0) throw new Error('generateOperationsHistory: internalLocationKeys required');
  if (!(Number.isInteger(userCount) && userCount > 0)) throw new Error('generateOperationsHistory: userCount must be a positive integer');

  const operations = [];
  const moves = [];
  const counters = {}; // { 'receipt': 1, ... } -> next reference sequence
  const summary = { byType: {}, byStatus: {}, totalMoves: 0, reconciled: true };

  // Reference counters start at 1: this dataset REPLACES the 6 hand-written
  // demo operations the old seed.js created, so the REC/DEL/INT/ADJ sequences
  // are contiguous from 0001.
  for (const { type } of DAILY_MIX) counters[type] = 0;

  const typePrefix = { receipt: 'REC', delivery: 'DEL', internal_transfer: 'INT', adjustment: 'ADJ' };

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const dayRng = mulberry32((seed ^ hashStringToSeed(`day-${dayOffset}`)) >>> 0);
    const day = new Date(ANCHOR_DATE.getTime() - dayOffset * DAY_MS);

    // 2-6 operations per day, weekends lighter.
    const dow = day.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const baseOps = isWeekend ? 1 + Math.floor(dayRng() * 2) : 2 + Math.floor(dayRng() * 4);

    for (let n = 0; n < baseOps; n += 1) {
      // Weighted type pick.
      const totalWeight = DAILY_MIX.reduce((s, m) => s + m.weight, 0);
      let roll = dayRng() * totalWeight;
      let chosen = DAILY_MIX[0];
      for (const mix of DAILY_MIX) {
        roll -= mix.weight;
        if (roll <= 0) { chosen = mix; break; }
      }
      const type = chosen.type;

      const product = products[Math.floor(dayRng() * products.length) % products.length];
      const opRng = mulberry32((seed ^ hashStringToSeed(`${type}-${product.sku}-${dayOffset}-${n}`)) >>> 0);

      counters[type] += 1;
      const ref = `${typePrefix[type]}/2026/${String(counters[type]).padStart(4, '0')}`;

      // Status by age: recent -> in-flight, old -> done.
      let statuses = ['done'];
      for (const band of STATUS_BY_AGE_DAYS) {
        if (dayOffset <= band.maxAge) { statuses = band.statuses; break; }
      }
      const status = statuses[Math.floor(opRng() * statuses.length) % statuses.length];

      // Line quantity: 1-3 lines per operation.
      const lineCount = 1 + Math.floor(opRng() * 3);
      const lines = [];
      const chosenProducts = [];
      for (let li = 0; li < lineCount; li += 1) {
        const p = li === 0 ? product : products[Math.floor(opRng() * products.length) % products.length];
        if (chosenProducts.includes(p.key)) continue;
        chosenProducts.push(p.key);
        // Anchor SKUs are high-volume (kg/m), extras are counted in units.
        const baseQty = p.weekly_demand_hint ? Math.round(p.weekly_demand_hint * 0.4) : 40;
        const qty = Math.max(1, Math.round(baseQty * (0.5 + opRng())));
        const done = status === 'done' ? qty : status === 'canceled' ? 0 : 0;
        lines.push({ productKey: p.key, sku: p.sku, quantity_demanded: qty, quantity_done: done });
      }
      if (lines.length === 0) continue;

      // Source / destination by type.
      let sourceKey; let destinationKey; let partnerName = '';
      if (type === 'receipt') {
        sourceKey = vendorLocKey;
        destinationKey = internalLocationKeys[Math.floor(opRng() * internalLocationKeys.length) % internalLocationKeys.length];
        partnerName = suppliers.length ? suppliers[Math.floor(opRng() * suppliers.length) % suppliers.length] : 'Demo Supplier';
      } else if (type === 'delivery') {
        sourceKey = internalLocationKeys[Math.floor(opRng() * internalLocationKeys.length) % internalLocationKeys.length];
        destinationKey = customerLocKey;
        partnerName = customers.length ? customers[Math.floor(opRng() * customers.length) % customers.length] : 'Demo Customer';
      } else if (type === 'internal_transfer') {
        // Never transfer a location to itself. With only one internal location
        // a transfer is meaningless, so skip the slot instead of retrying (a
        // retry loop would spin forever on a 1-location catalog).
        const a = internalLocationKeys[Math.floor(opRng() * internalLocationKeys.length) % internalLocationKeys.length];
        const b = internalLocationKeys[Math.floor(opRng() * internalLocationKeys.length) % internalLocationKeys.length];
        if (internalLocationKeys.length < 2 || a === b) continue;
        sourceKey = a; destinationKey = b;
        partnerName = '';
      } else {
        // adjustment: from an internal rack to loss (or reverse for found_stock)
        const isFound = opRng() < 0.25;
        const internal = internalLocationKeys[Math.floor(opRng() * internalLocationKeys.length) % internalLocationKeys.length];
        sourceKey = isFound ? lossLocKey : internal;
        destinationKey = isFound ? internal : lossLocKey;
        partnerName = '';
      }

      // Timestamps: created mid-day, validated a few hours later if done.
      const createdMs = day.getTime() + (8 + Math.floor(opRng() * 10)) * 60 * 60 * 1000;
      const created = new Date(createdMs);
      const validated = status === 'done' ? new Date(createdMs + (1 + Math.floor(opRng() * 6)) * 60 * 60 * 1000) : null;
      // Scheduled: in-flight operations are dated in the near future.
      const scheduled = status === 'done' || status === 'canceled'
        ? null
        : new Date(ANCHOR_DATE.getTime() + (1 + Math.floor(opRng() * 5)) * DAY_MS);

      const notePool = NOTES[type];
      const note = notePool[Math.floor(opRng() * notePool.length) % notePool.length];
      // Creator slot is an INDEX into the catalog's user list, so the pure
      // generator stays free of database ids.
      const createdByIndex = Math.floor(opRng() * userCount) % userCount;

      const op = {
        reference: ref,
        operation_type: type,
        status,
        partner_name: partnerName,
        sourceKey,
        destinationKey,
        createdByIndex,
        created_at: created,
        scheduled_date: scheduled,
        validated_at: validated,
        notes: type === 'adjustment' ? `${note} (${ADJ_REASONS[Math.floor(opRng() * ADJ_REASONS.length) % ADJ_REASONS.length]})` : note,
        lines: lines.map((l) => ({ productKey: l.productKey, quantity_demanded: l.quantity_demanded, quantity_done: l.quantity_done })),
      };
      operations.push(op);

      summary.byType[type] = (summary.byType[type] || 0) + 1;
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;

      // Ledger moves: one per line, only for done quantities.
      for (const line of lines) {
        if (line.quantity_done <= 0) continue;
        moves.push({
          reference: ref,
          productKey: line.productKey,
          sourceKey: op.sourceKey,
          destinationKey: op.destinationKey,
          quantity: line.quantity_done,
          status: 'done',
          move_date: validated || created,
          createdByIndex: op.createdByIndex,
        });
        summary.totalMoves += 1;
      }
    }
  }

  return { operations, moves, summary };
}
