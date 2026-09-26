// ---------------------------------------------------------------------------
// Hermetic unit tests for the pure demo-data generators. NO DB, NO network.
//
// These cover the two datasets added for the extended catalog:
//   - demoCatalog.js      : master data (categories/warehouses/locations/products)
//   - demoOperations.js   : 90 days of operations + matching ledger moves
//
// The load-bearing property is DETERMINISM: a hackathon demo that reshuffles
// its numbers on every reseed looks fake, and a PRNG draw-order change is
// silent. So determinism is asserted explicitly everywhere.
// ---------------------------------------------------------------------------
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generateCatalog,
  CATALOG_SEED,
  CATEGORIES,
  PRODUCTS,
  WAREHOUSES,
  LOCATIONS,
  VIRTUAL_LOCATIONS,
  ANCHOR_LOCATION,
  DEMO_USERS,
  PARTNER_NAMES,
} from '../src/scripts/demoCatalog.js';
import {
  generateOperationsHistory,
  OPERATIONS_SEED,
  HISTORY_DAYS,
  ANCHOR_DATE,
} from '../src/scripts/demoOperations.js';
import {
  BASE_WEEKLY_DEMAND,
  EXTRA_WEEKLY_DEMAND,
  ANCHOR_SKUS,
  weeklyDemandFor,
  profileForSku,
  anchorIndexFor,
  generateWeeklySeries,
  WEEKS,
  HISTORY_SEED,
} from '../src/scripts/generateHistory.js';

const catalog = generateCatalog();

describe('demoCatalog: master data shape', () => {
  it('produces 8 categories, 4 warehouses, 12 internal + 4 virtual locations', () => {
    assert.strictEqual(catalog.categories.length, 8);
    assert.strictEqual(catalog.warehouses.length, 4);
    assert.strictEqual(catalog.locations.length, 12);
    assert.strictEqual(catalog.virtualLocations.length, 4);
  });

  it('keeps every category parent resolvable and acyclic', () => {
    const keys = new Set(catalog.categories.map((c) => c.key));
    for (const c of catalog.categories) {
      if (c.parentKey) assert.ok(keys.has(c.parentKey), `${c.key} has unknown parent ${c.parentKey}`);
    }
  });

  it('gives every internal location a warehouse that exists', () => {
    const whKeys = new Set(catalog.warehouses.map((w) => w.key));
    for (const l of catalog.locations) {
      assert.ok(whKeys.has(l.warehouse), `${l.code} references unknown warehouse ${l.warehouse}`);
    }
  });

  it('location codes are unique and every location has a capacity > 0', () => {
    const codes = catalog.locations.map((l) => l.code);
    assert.strictEqual(new Set(codes).size, codes.length, 'location codes must be unique');
    for (const l of catalog.locations) assert.ok(l.capacity > 0, `${l.code} has no capacity`);
  });

  it('seeds 5+ demo users with unique emails and valid roles', () => {
    assert.ok(catalog.users.length >= 5, `expected >=5 users, got ${catalog.users.length}`);
    const emails = catalog.users.map((u) => u.email);
    assert.strictEqual(new Set(emails).size, emails.length, 'user emails must be unique');
    const roles = new Set(catalog.users.map((u) => u.role));
    for (const r of ['admin', 'inventory_manager', 'warehouse_staff']) {
      assert.ok(roles.has(r), `missing role ${r}`);
    }
  });
});

describe('demoCatalog: products', () => {
  it('ships >=40 products with unique SKUs', () => {
    assert.ok(catalog.products.length >= 40, `expected >=40 products, got ${catalog.products.length}`);
    const skus = catalog.products.map((p) => p.sku);
    assert.strictEqual(new Set(skus).size, skus.length, 'SKUs must be unique');
  });

  it('preserves the 7 anchor SKUs as the first 7 products, in frozen order', () => {
    // The frozen SVR artifact and synthetic_series.json were trained on these
    // SKUs at these indices; reordering them would silently break the model.
    const first7 = catalog.products.slice(0, 7).map((p) => p.sku);
    assert.deepStrictEqual(first7, ANCHOR_SKUS);
    assert.strictEqual(catalog.products.filter((p) => p.anchor).length, 7);
  });

  it('gives every product a real uom and a min < max reorder band', () => {
    for (const p of catalog.products) {
      assert.ok(p.uom && p.uom.length > 0 && !/PLACEHOLDER/.test(p.uom), `bad uom on ${p.sku}: ${p.uom}`);
      assert.ok(p.min_quantity >= 1, `${p.sku} min_quantity must be >=1`);
      assert.ok(p.max_quantity > p.min_quantity, `${p.sku} max must exceed min`);
    }
  });

  it('every product maps to a real category', () => {
    const keys = new Set(catalog.categories.map((c) => c.key));
    for (const p of catalog.products) {
      assert.ok(keys.has(p.category), `${p.sku} references unknown category ${p.category}`);
    }
  });

  it('every non-anchor product declares a weekly demand hint in EXTRA_WEEKLY_DEMAND', () => {
    for (const p of catalog.products) {
      if (p.anchor) continue;
      assert.ok(
        Object.hasOwn(EXTRA_WEEKLY_DEMAND, p.sku),
        `${p.sku} is not an anchor but has no EXTRA_WEEKLY_DEMAND entry — it would get no demand series`
      );
    }
  });

  it('EXTRA_WEEKLY_DEMAND covers exactly the non-anchor products (no drift either way)', () => {
    const extraInCatalog = catalog.products.filter((p) => !p.anchor).map((p) => p.sku).sort();
    const extraInMap = Object.keys(EXTRA_WEEKLY_DEMAND).sort();
    assert.deepStrictEqual(extraInCatalog, extraInMap,
      'demoCatalog PRODUCTS and generateHistory EXTRA_WEEKLY_DEMAND have drifted apart');
  });

  it('EXTRA_WEEKLY_DEMAND never shadows an anchor base value', () => {
    for (const sku of ANCHOR_SKUS) {
      assert.ok(
        !Object.hasOwn(EXTRA_WEEKLY_DEMAND, sku),
        `${sku} is a frozen anchor and must not appear in EXTRA_WEEKLY_DEMAND`
      );
    }
  });
});

describe('demoCatalog: stock quants', () => {
  it('has one quant per product, all pointing at real products and locations', () => {
    assert.strictEqual(catalog.stock.length, catalog.products.length);
    const productKeys = new Set(catalog.products.map((p) => p.key));
    const locationKeys = new Set(catalog.locations.map((l) => l.key));
    for (const s of catalog.stock) {
      assert.ok(productKeys.has(s.productKey), `unknown product ${s.productKey}`);
      assert.ok(locationKeys.has(s.locationKey), `unknown location ${s.locationKey}`);
      assert.ok(Number.isInteger(s.quantity) && s.quantity >= 0, `bad quantity for ${s.productKey}`);
    }
  });

  it('leaves no product without any on-hand row', () => {
    const withStock = new Set(catalog.stock.map((s) => s.productKey));
    for (const p of catalog.products) {
      assert.ok(withStock.has(p.key), `${p.sku} has no stock quant row`);
    }
  });

  it('includes at least one out-of-stock and one low-stock product for the alerts demo', () => {
    assert.ok(catalog.stock.some((s) => s.quantity === 0), 'expected an out-of-stock product');
    const lowCount = catalog.products.filter((p) => {
      const s = catalog.stock.find((x) => x.productKey === p.key);
      return s && s.quantity > 0 && s.quantity <= p.min_quantity;
    }).length;
    assert.ok(lowCount >= 2, `expected >=2 low-stock products, got ${lowCount}`);
  });

  it('pins every anchor SKU to a real rack location', () => {
    const locationKeys = new Set(catalog.locations.map((l) => l.key));
    for (const p of catalog.products.filter((x) => x.anchor)) {
      const s = catalog.stock.find((x) => x.productKey === p.key);
      assert.strictEqual(s.locationKey, ANCHOR_LOCATION[p.key], `${p.sku} anchor location drifted`);
      assert.ok(locationKeys.has(s.locationKey));
    }
  });
});

describe('demoCatalog: determinism', () => {
  it('same seed -> byte-identical catalog', () => {
    assert.strictEqual(JSON.stringify(generateCatalog()), JSON.stringify(generateCatalog()));
    assert.strictEqual(JSON.stringify(generateCatalog(CATALOG_SEED)), JSON.stringify(generateCatalog(CATALOG_SEED)));
  });

  it('different seed -> different reordering bands', () => {
    const a = generateCatalog(CATALOG_SEED);
    const b = generateCatalog(CATALOG_SEED + 1);
    assert.notStrictEqual(
      JSON.stringify(a.products.map((p) => p.min_quantity)),
      JSON.stringify(b.products.map((p) => p.min_quantity))
    );
  });
});

describe('generateHistory: extended catalog keeps the frozen model valid', () => {
  it('resolves a weekly base for every catalog SKU and none for strangers', () => {
    for (const p of catalog.products) {
      assert.notStrictEqual(weeklyDemandFor(p.sku), null, `${p.sku} has no weekly demand base`);
    }
    assert.strictEqual(weeklyDemandFor('NOT-A-REAL-SKU'), null);
  });

  it('anchors resolve to their FROZEN training index regardless of catalog size', () => {
    for (let i = 0; i < ANCHOR_SKUS.length; i += 1) {
      assert.strictEqual(anchorIndexFor(ANCHOR_SKUS[i]), i);
    }
  });

  it('anchor profiles match the committed parity fixture exactly', () => {
    // This is the regression guard. The expected values are read from
    // synthetic_series.json — the dataset the frozen SVR artifact was actually
    // trained on — rather than hardcoded, so if a future edit perturbs the
    // index->profile mapping this test fails with the real drift instead of
    // relying on someone's memory of the original assignment.
    const committed = JSON.parse(
      readFileSync(new URL('../src/ml/artifacts/synthetic_series.json', import.meta.url), 'utf8')
    );
    for (const sku of ANCHOR_SKUS) {
      assert.strictEqual(
        profileForSku(sku),
        committed.skuMeta[sku].profile,
        `${sku} profile drifted from the frozen training assignment`
      );
    }
  });

  it('anchor series are byte-identical to the committed parity fixture', () => {
    // Stronger than checking profiles: the exact 60-week quantity series the
    // model was trained on must still regenerate identically.
    const committed = JSON.parse(
      readFileSync(new URL('../src/ml/artifacts/synthetic_series.json', import.meta.url), 'utf8')
    );
    const bySku = new Map();
    for (const row of committed.rows) {
      if (!bySku.has(row.sku)) bySku.set(row.sku, []);
      bySku.get(row.sku)[row.week] = row.qty;
    }
    for (const sku of ANCHOR_SKUS) {
      const series = generateWeeklySeries(profileForSku(sku), WEEKS, {
        seed: HISTORY_SEED,
        sku,
        baseWeeklyDemand: BASE_WEEKLY_DEMAND[sku],
      });
      assert.deepStrictEqual(series, bySku.get(sku), `${sku} series drifted from the frozen fixture`);
    }
  });

  it('non-anchor profiles are stable per SKU and span all four types', () => {
    const extras = Object.keys(EXTRA_WEEKLY_DEMAND);
    const seen = new Set(extras.map(profileForSku));
    for (const p of ['A', 'B', 'C', 'D']) {
      assert.ok(seen.has(p), `extended SKUs never get profile ${p}`);
    }
    // Stability: same answer on every call.
    for (const sku of extras) {
      assert.strictEqual(profileForSku(sku), profileForSku(sku));
    }
  });

  it('every catalog SKU generates a usable series of the right length', () => {
    for (const p of catalog.products) {
      const series = generateWeeklySeries(profileForSku(p.sku), WEEKS, {
        seed: HISTORY_SEED,
        sku: p.sku,
        baseWeeklyDemand: weeklyDemandFor(p.sku),
      });
      assert.strictEqual(series.length, WEEKS, `${p.sku} series length`);
      assert.ok(series.every((q) => Number.isInteger(q) && q >= 0), `${p.sku} has invalid quantities`);
      assert.ok(series.some((q) => q > 0), `${p.sku} has an all-zero series`);
    }
  });
});

describe('demoOperations: 90-day history', () => {
  const ctx = {
    products: catalog.products,
    internalLocationKeys: catalog.locations.map((l) => l.key),
    vendorLocKey: 'vendor',
    customerLocKey: 'customer',
    lossLocKey: 'loss',
    userCount: catalog.users.length,
    suppliers: PARTNER_NAMES.suppliers,
    customers: PARTNER_NAMES.customers,
  };
  const data = generateOperationsHistory(ctx);

  it('generates a substantial number of operations across the window', () => {
    assert.ok(data.operations.length >= 150, `expected >=150 operations, got ${data.operations.length}`);
  });

  it('references are unique and well-formed per operation type', () => {
    const refs = data.operations.map((o) => o.reference);
    assert.strictEqual(new Set(refs).size, refs.length, 'operation references must be unique');
    const prefixFor = { receipt: 'REC', delivery: 'DEL', internal_transfer: 'INT', adjustment: 'ADJ' };
    for (const o of data.operations) {
      assert.match(o.reference, new RegExp(`^${prefixFor[o.operation_type]}/2026/\\d{4}$`), `bad ref ${o.reference}`);
    }
  });

  it('covers all four operation types and every lifecycle status', () => {
    for (const t of ['receipt', 'delivery', 'internal_transfer', 'adjustment']) {
      assert.ok(data.summary.byType[t] > 0, `no ${t} operations generated`);
    }
    for (const s of ['done', 'waiting', 'ready', 'draft', 'canceled']) {
      assert.ok(data.summary.byStatus[s] > 0, `no operations in status ${s}`);
    }
  });

  it('every line references a real product with a positive demand quantity', () => {
    const productKeys = new Set(catalog.products.map((p) => p.key));
    for (const op of data.operations) {
      assert.ok(op.lines.length > 0, `${op.reference} has no lines`);
      for (const line of op.lines) {
        assert.ok(productKeys.has(line.productKey), `${op.reference} line references unknown product`);
        assert.ok(line.quantity_demanded > 0, `${op.reference} line has non-positive demand`);
        assert.ok(line.quantity_done >= 0 && line.quantity_done <= line.quantity_demanded,
          `${op.reference} done quantity out of range`);
      }
    }
  });

  it('no operation moves stock to the same location it came from', () => {
    for (const op of data.operations) {
      assert.notStrictEqual(op.sourceKey, op.destinationKey, `${op.reference} is a self-transfer`);
    }
  });

  it('receipts come from vendors and deliveries go to customers', () => {
    for (const op of data.operations.filter((o) => o.operation_type === 'receipt')) {
      assert.strictEqual(op.sourceKey, 'vendor', `${op.reference} receipt source`);
      assert.ok(op.partner_name, `${op.reference} receipt has no supplier name`);
    }
    for (const op of data.operations.filter((o) => o.operation_type === 'delivery')) {
      assert.strictEqual(op.destinationKey, 'customer', `${op.reference} delivery destination`);
      assert.ok(op.partner_name, `${op.reference} delivery has no customer name`);
    }
  });

  it('the ledger reconciles: move quantities equal each done operation total', () => {
    const movedByRef = new Map();
    for (const mv of data.moves) {
      movedByRef.set(mv.reference, (movedByRef.get(mv.reference) || 0) + mv.quantity);
    }
    let checked = 0;
    for (const op of data.operations) {
      const want = op.lines.reduce((s, l) => s + l.quantity_done, 0);
      if (want === 0) continue;
      checked += 1;
      assert.strictEqual(movedByRef.get(op.reference) || 0, want, `${op.reference} ledger does not reconcile`);
    }
    assert.ok(checked > 100, `expected >100 settled operations to reconcile, checked ${checked}`);
  });

  it('only settled operations produce ledger moves', () => {
    const doneRefs = new Set(data.operations.filter((o) => o.status === 'done').map((o) => o.reference));
    for (const mv of data.moves) {
      assert.ok(doneRefs.has(mv.reference), `${mv.reference} has a move but its operation is not done`);
    }
  });

  it('stays inside the 90-day window ending at the fixed anchor date', () => {
    // ANCHOR_DATE is midnight UTC, and operations created "on" the anchor day
    // are stamped 08:00-18:00 that same day — so the upper bound is the end of
    // the anchor day, not the anchor midnight.
    const dayEnd = ANCHOR_DATE.getTime() + 24 * 60 * 60 * 1000;
    const windowStart = ANCHOR_DATE.getTime() - (HISTORY_DAYS - 1) * 24 * 60 * 60 * 1000;
    for (const op of data.operations) {
      const t = op.created_at.getTime();
      assert.ok(t >= windowStart, `${op.reference} predates the history window`);
      assert.ok(t < dayEnd, `${op.reference} is after the anchor day`);
    }
    // The window should actually span close to the full 90 days.
    const earliest = Math.min(...data.operations.map((o) => o.created_at.getTime()));
    assert.ok(dayEnd - earliest >= (HISTORY_DAYS - 2) * 24 * 60 * 60 * 1000,
      'history should cover ~90 days, not just a few');
  });

  it('in-flight operations are scheduled in the future, settled ones are not', () => {
    for (const op of data.operations) {
      if (op.status === 'done' || op.status === 'canceled') {
        assert.strictEqual(op.scheduled_date, null, `${op.reference} is settled but still scheduled`);
      } else {
        assert.ok(op.scheduled_date, `${op.reference} is ${op.status} with no scheduled date`);
        assert.ok(op.scheduled_date.getTime() > ANCHOR_DATE.getTime(), `${op.reference} scheduled in the past`);
      }
    }
  });

  it('creator indices are always in range', () => {
    for (const op of data.operations) {
      assert.ok(Number.isInteger(op.createdByIndex), `${op.reference} creator is not an index`);
      assert.ok(op.createdByIndex >= 0 && op.createdByIndex < ctx.userCount, `${op.reference} creator out of range`);
    }
  });

  it('adjustments terminate at the loss or an internal location', () => {
    const valid = new Set([...ctx.internalLocationKeys, 'loss']);
    for (const op of data.operations.filter((o) => o.operation_type === 'adjustment')) {
      assert.ok(op.sourceKey === 'loss' || op.destinationKey === 'loss',
        `${op.reference} adjustment does not involve the scrap/loss location`);
      assert.ok(valid.has(op.sourceKey) && valid.has(op.destinationKey));
    }
  });

  it('is deterministic and seed-sensitive', () => {
    const a = generateOperationsHistory(ctx);
    const b = generateOperationsHistory(ctx);
    assert.strictEqual(JSON.stringify(a.operations), JSON.stringify(b.operations));
    assert.strictEqual(JSON.stringify(a.moves), JSON.stringify(b.moves));
    const alt = generateOperationsHistory({ ...ctx, seed: OPERATIONS_SEED + 1 });
    assert.notStrictEqual(JSON.stringify(alt.operations), JSON.stringify(a.operations));
  });

  it('rejects bad input instead of silently producing garbage', () => {
    assert.throws(() => generateOperationsHistory({ ...ctx, products: [] }), /products required/);
    assert.throws(() => generateOperationsHistory({ ...ctx, internalLocationKeys: [] }), /internalLocationKeys required/);
    assert.throws(() => generateOperationsHistory({ ...ctx, userCount: 0 }), /userCount/);
  });

  it('does not loop forever with a single internal location', () => {
    // A self-transfer retry would hang here; the generator must skip the slot.
    const single = generateOperationsHistory({ ...ctx, internalLocationKeys: ['wh1_stock'] });
    assert.ok(single.operations.length > 0, 'should still produce receipts/deliveries');
    assert.ok(single.operations.every((o) => o.sourceKey !== o.destinationKey));
    assert.strictEqual(
      single.operations.filter((o) => o.operation_type === 'internal_transfer').length,
      0,
      'no internal transfers are possible with one location'
    );
  });
});

describe('demoCatalog + demoOperations: cross-file consistency', () => {
  it('the static exports match the generated catalog', () => {
    assert.strictEqual(CATEGORIES.length, catalog.categories.length);
    assert.strictEqual(WAREHOUSES.length, catalog.warehouses.length);
    assert.strictEqual(LOCATIONS.length, catalog.locations.length);
    assert.strictEqual(VIRTUAL_LOCATIONS.length, catalog.virtualLocations.length);
    assert.strictEqual(PRODUCTS.length, catalog.products.length);
    assert.strictEqual(DEMO_USERS.length, catalog.users.length);
  });

  it('supplier and customer name pools are large enough to avoid visible repeats', () => {
    assert.ok(PARTNER_NAMES.suppliers.length >= 20);
    assert.ok(PARTNER_NAMES.customers.length >= 20);
    assert.strictEqual(new Set(PARTNER_NAMES.suppliers).size, PARTNER_NAMES.suppliers.length);
    assert.strictEqual(new Set(PARTNER_NAMES.customers).size, PARTNER_NAMES.customers.length);
  });

  it('anchor weekly bases are the originals the model was trained on', () => {
    // Guards against an accidental edit to BASE_WEEKLY_DEMAND.
    assert.strictEqual(BASE_WEEKLY_DEMAND['STEEL-12MM-ROD'], 140);
    assert.strictEqual(BASE_WEEKLY_DEMAND['ALUM-25X25-BAR'], 60);
    assert.strictEqual(BASE_WEEKLY_DEMAND['BOLT-HEX-M8-P50'], 30);
    assert.strictEqual(ANCHOR_SKUS.length, 7);
  });
});
