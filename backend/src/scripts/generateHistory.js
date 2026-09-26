// ---------------------------------------------------------------------------
// Synthetic 14-month (60-week) OUT-demand history generator for StockSense.
//
// Run AFTER the base seeder:  node src/scripts/seed.js && node src/scripts/generateHistory.js
//
// Determinism: fixed PRNG seed constant HISTORY_SEED = 20260926 (mulberry32).
// Same products + same endDate => byte-identical move set on every run.
//
// Demand profiles (assigned by product index, stable across reruns):
//   A - stable high volume: base + small wave noise, never zero
//   B - seasonal + trend:   strong weekly seasonality (sin) + gentle annual trend
//   C - intermittent:       most weeks zero, ~25-35% of weeks a burst of 1-3 units
//                           (exercises Croston-style forecasters)
//   D - cold-start:         only the last 8-12 weeks have data (new product)
//
// Idempotent: deletes every StockMove with a SYN/ reference and rewrites the
// synthetic StockQuant at each product's primary internal location.
// ---------------------------------------------------------------------------
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.config.js';
import User from '../models/user.model.js';
import Location from '../models/location.model.js';
import Product from '../models/product.model.js';
import StockQuant from '../models/stockQuant.model.js';
import StockMove from '../models/stockMove.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const HISTORY_SEED = 20260926; // fixed seed constant — do not change
export const WEEKS = 60; // ~14 months of weekly buckets

// Sensible weekly consumption levels per seeded SKU, in the product's own uom.
export const BASE_WEEKLY_DEMAND = {
  'STEEL-12MM-ROD': 140, // kg
  'ALUM-25X25-BAR': 60, // m
  'BOLT-HEX-M8-P50': 30, // packs
  'CHAIR-ERGO-MESH': 6, // units
  'FRAME-STEEL-WORK': 4, // units
  'PASTE-THERM-10G': 18, // tubes
  'HELM-SAFE-YEL': 8, // units
};

// Weekly demand hints for the EXTENDED catalog (everything except the 7 anchor
// SKUs above). These products are NOT covered by the frozen SVR artifact, so
// they get a baseline trailing-mean forecast instead of an SVR one — but they
// still need a real weekly series so the demand charts, reorder candidates, and
// operations history are not empty for them.
//
// The anchor SKUs are deliberately NOT repeated here: their series is frozen by
// BASE_WEEKLY_DEMAND above and is what the trained model and the
// synthetic_series.json parity fixture were built from. Adding an entry for one
// of them would silently change the model.
export const EXTRA_WEEKLY_DEMAND = {
  'STEEL-PLATE-6MM': 220,
  'STEEL-SHEET-2MM': 160,
  'TUBE-SS-304-25MM': 90,
  'ANGLE-MILD-40X40': 130,
  'WIRE-CU-2.5SQ': 420,
  'CABLE-3C-2.5': 240,
  'SWITCH-MCCB-100A': 30,
  'LIGHT-LED-PANEL-40W': 55,
  'CONDUIT-PVC-25MM': 300,
  'CARTON-SMALL-12IN': 650,
  'CARTON-LARGE-24IN': 320,
  'WRAP-STRETCH-500MM': 85,
  'TAPE-BROWN-48MM': 130,
  'PALLET-WOOD-STD': 45,
  'LABEL-THERMAL-100X150': 50,
  'PPE-GLOVE-NITRILE-M': 210,
  'PPE-VEST-HIVIS': 90,
  'PPE-GOGGLE-CLEAR': 65,
  'PPE-RESPIRATOR-N95': 110,
  'PPE-FIRSTAID-KIT': 18,
  'SAFETY-FIREEXT-6KG': 14,
  'TABLE-PACK-BENCH': 14,
  'SHELF-STEEL-5TIER': 22,
  'BIN-PLASTIC-60L': 65,
  'DOLLY-PLATFORM-4W': 18,
  'MAT-ANTI-FATIGUE': 26,
  'PACK-BUBBLE-1M': 44,
  'PACK-EDGE-GUARD-1M': 300,
  'PACK-STRAP-PP-12MM': 62,
  'ADHESIVE-WORKBENCH': 38,
  'RESIN-EPOXY-1KG': 22,
  'ABRASIVE-GRIND-115': 170,
  'ABRASIVE-CUT-115': 195,
  'ABRASIVE-BRUSH-WIRE': 85,
  'SOLDER-FLUX-100G': 32,
  'LUBE-HD-500ML': 44,
};

/** Every SKU the generator can emit a series for, anchors first. */
export const ALL_WEEKLY_DEMAND = { ...BASE_WEEKLY_DEMAND, ...EXTRA_WEEKLY_DEMAND };

/**
 * Resolve a SKU's weekly demand base, or null if the SKU is not part of the
 * synthetic demand dataset.
 */
export function weeklyDemandFor(sku) {
  if (Object.hasOwn(BASE_WEEKLY_DEMAND, sku)) return BASE_WEEKLY_DEMAND[sku];
  if (Object.hasOwn(EXTRA_WEEKLY_DEMAND, sku)) return EXTRA_WEEKLY_DEMAND[sku];
  return null;
}
const DEFAULT_BASE_WEEKLY_DEMAND = 10;

// mulberry32 — small deterministic PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Index rule guarantees at least one product per profile with 7 seeded items:
//   first product -> D (cold-start), idx%6==3 -> B, idx%6==5 -> C,
//   even idx -> A, otherwise rotate A/B.
//
// IMPORTANT (extended catalog): this function is applied to the ANCHOR SKUS
// only, and always with the anchor's index in BASE_WEEKLY_DEMAND's own key
// order — never with its index in the full product list. The frozen SVR
// artifact and synthetic_series.json were built with the 7 anchors at indices
// 0..6, so if the 36 extra SKUs were folded into the same index space every
// anchor's profile would shift and the model would no longer match its
// training data. See anchorIndexFor().
export function assignProfile(index) {
  if (index === 0) return 'D';
  if (index % 6 === 3) return 'B';
  if (index % 6 === 5) return 'C';
  if (index % 2 === 0) return 'A';
  return index % 4 === 1 ? 'B' : 'A';
}

// The anchor SKUs in their frozen order. Index here === the index the model was
// trained with, so it is the ONLY index that may be passed to assignProfile.
export const ANCHOR_SKUS = Object.keys(BASE_WEEKLY_DEMAND);

/** The frozen training index of an anchor SKU, or -1 if it is not an anchor. */
export function anchorIndexFor(sku) {
  return ANCHOR_SKUS.indexOf(sku);
}

/**
 * Profile for a SKU, resolved without depending on how many extra products
 * exist in the database. Anchors get their frozen training profile; extended
 * SKUs are assigned by a stable hash of the SKU so adding or removing a product
 * never changes another product's profile.
 */
export function profileForSku(sku) {
  const anchorIdx = anchorIndexFor(sku);
  if (anchorIdx >= 0) return assignProfile(anchorIdx);
  // Extended SKUs: map a stable per-SKU hash into the same profile mix
  // (A dominant, B/C/D present) without touching the anchor index space.
  const h = hashStringToSeed(String(sku));
  switch (h % 10) {
    case 0:
    case 1:
      return 'B';
    case 2:
      return 'C';
    case 3:
      return 'D';
    default:
      return 'A';
  }
}

// Pure function: returns an array of `weeks` non-negative weekly quantities.
// profileType: 'A' | 'B' | 'C' | 'D'. rngSeed folds product identity into the
// per-product rng so product order changes only affect that one product.
export function generateWeeklySeries(profileType, weeks, rngSeed) {
  const base = Math.max(1, Math.round(rngSeed.baseWeeklyDemand ?? DEFAULT_BASE_WEEKLY_DEMAND));
  const rng = mulberry32(((rngSeed.seed >>> 0) ^ hashStringToSeed(String(rngSeed.sku ?? 'SKU'))) >>> 0);
  const series = new Array(weeks).fill(0);

  if (profileType === 'A') {
    for (let w = 0; w < weeks; w += 1) {
      const noise = Math.round((rng() - 0.5) * base * 0.2);
      series[w] = Math.max(1, base + noise);
    }
  } else if (profileType === 'B') {
    const amplitude = base * 0.35; // annual cycle over the 60-week window
    for (let w = 0; w < weeks; w += 1) {
      const seasonal = amplitude * Math.sin((2 * Math.PI * w) / 52);
      const trend = (base * 0.3 * w) / weeks; // gentle upward annual trend
      const noise = Math.round((rng() - 0.5) * base * 0.1);
      series[w] = Math.max(1, Math.round(base + seasonal + trend + noise));
    }
  } else if (profileType === 'C') {
    const burstProbability = 0.25 + rng() * 0.1; // 25-35% of weeks active
    for (let w = 0; w < weeks; w += 1) {
      if (rng() < burstProbability) {
        series[w] = 1 + Math.floor(rng() * 3); // burst of 1-3 units
      }
    }
  } else if (profileType === 'D') {
    const historyWeeks = 8 + Math.floor(rng() * 5); // 8-12 weeks of life
    const firstWeek = Math.max(0, weeks - historyWeeks);
    for (let w = firstWeek; w < weeks; w += 1) {
      const noise = Math.round((rng() - 0.5) * base * 0.3);
      series[w] = Math.max(1, base + noise);
    }
  } else {
    throw new Error(`Unknown demand profile: ${profileType}`);
  }

  return series;
}

// yyyy/Www ISO-week label used inside the SYN/ reference so every reference is
// unique per product+week and constant across reruns.
export function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = d.getUTCDay() || 7; // Monday = 1 .. Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const weekPadded = String(week).padStart(2, '0');
  return `${d.getUTCFullYear()}/W${weekPadded}`;
}

function startOfWeekMonday(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNumber - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const runGenerator = async ({ endDate, weeks } = {}) => {
  const effectiveWeeks = Number.isInteger(weeks) && weeks > 0 ? weeks : WEEKS;
  const end = endDate ? new Date(endDate) : new Date();

  console.log('--- Connecting to Database for History Generation ---');
  await connectDB();

  console.log('--- 1. Clearing previous synthetic history (SYN/ moves) ---');
  const removed = await StockMove.deleteMany({ reference: /^SYN\// });
  console.log(`  Removed ${removed.deletedCount} prior synthetic moves`);

  console.log('--- 2. Resolving locations and users ---');
  const [customerLoc, stockLoc, rackB, firstInternal, anyInternal, firstUser] = await Promise.all([
    Location.findOne({ code: 'PARTNER/CUSTOMERS' }),
    Location.findOne({ code: 'WH1/STOCK' }),
    Location.findOne({ code: 'WH1/RACK-B' }),
    Location.findOne({ code: /^WH1\//, location_type: 'internal' }),
    Location.findOne({ location_type: 'internal' }),
    User.findOne().sort({ createdAt: 1 }),
  ]);
  if (!customerLoc) throw new Error('PARTNER/CUSTOMERS location missing — run seed.js first');
  const primaryStockLoc = stockLoc || rackB || firstInternal || anyInternal;
  if (!primaryStockLoc) throw new Error('No internal stock location found — run seed.js first');

  const productsAll = await Product.find({ is_active: true }).sort({ createdAt: 1, sku: 1 });
  // Only SKUs with a declared weekly-demand base get synthetic history —
  // leftover products from ad-hoc test runs in the shared demo DB must not pick
  // up synthetic quants/moves. That set is now the anchors (BASE_WEEKLY_DEMAND)
  // plus the extended catalog (EXTRA_WEEKLY_DEMAND).
  const products = productsAll.filter((p) => weeklyDemandFor(p.sku) !== null);
  if (products.length === 0) throw new Error('No seeded active products found — run seed.js first');

  // Last run Monday acts as the "today" anchor; the 60th bucket starts there.
  const lastWeekStart = startOfWeekMonday(end);
  const weekStarts = [];
  for (let i = effectiveWeeks - 1; i >= 0; i -= 1) {
    weekStarts.push(new Date(lastWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }

  console.log('--- 3. Generating weekly demand series ---');
  const profileCounts = { A: 0, B: 0, C: 0, D: 0 };
  const moveDocs = [];
  const quantPlans = [];

  for (let idx = 0; idx < products.length; idx += 1) {
    const product = products[idx];
    // Profile comes from the SKU, not from its position in this list, so the
    // anchors keep the profiles the frozen model was trained with even though
    // the extended catalog now sits in the same table.
    const profile = profileForSku(product.sku);
    profileCounts[profile] += 1;
    const baseWeeklyDemand = weeklyDemandFor(product.sku) ?? DEFAULT_BASE_WEEKLY_DEMAND;
    const series = generateWeeklySeries(profile, effectiveWeeks, {
      seed: HISTORY_SEED,
      sku: product.sku,
      baseWeeklyDemand,
    });

    const skuSuffix = String(product.sku).split(/[^A-Z0-9]+/i)[0] || String(product.sku);
    let moveCount = 0;
    for (let w = 0; w < effectiveWeeks; w += 1) {
      if (series[w] <= 0) continue;
      moveCount += 1;
      moveDocs.push({
        reference: `SYN/${skuSuffix}/${isoWeekLabel(weekStarts[w])}`,
        operation: null, // synthetic history is not tied to a StockOperation
        product: product._id,
        source_location: primaryStockLoc._id,
        destination_location: customerLoc._id,
        quantity: series[w],
        status: 'done',
        move_date: weekStarts[w],
        user: firstUser ? firstUser._id : null,
      });
    }

    // On-hand anchor: last 8 weeks of demand — keeps several SKUs demonstrably
    // below their reordering min so the demo always has reorder candidates.
    const recentDemand = series.slice(-8).reduce((sum, q) => sum + q, 0);
    quantPlans.push({
      product: product,
      sku: product.sku,
      profile,
      moveCount,
      totalDemand: series.reduce((sum, q) => sum + q, 0),
      onHand: Math.max(0, recentDemand),
    });
  }

  console.log('--- 4. Writing StockMove ledger rows (upsert by reference) ---');
  for (const doc of moveDocs) {
    await StockMove.updateOne({ reference: doc.reference }, { $set: doc }, { upsert: true });
  }

  console.log('--- 5. Setting synthetic StockQuant on-hand at primary location ---');
  for (const plan of quantPlans) {
    await StockQuant.findOneAndUpdate(
      { product: plan.product._id, location: primaryStockLoc._id },
      { $set: { quantity: plan.onHand, reserved_quantity: 0 } },
      { upsert: true, new: true }
    );
  }

  console.log('\n======================================================');
  console.log(' SYNTHETIC DEMAND HISTORY GENERATED');
  console.log('======================================================');
  console.log(`  Seed:        ${HISTORY_SEED}`);
  console.log(`  Week span:   ${weekStarts[0].toISOString().slice(0, 10)} to ${weekStarts[weekStarts.length - 1].toISOString().slice(0, 10)}`);
  console.log(`  Buckets:     ${effectiveWeeks} weekly`);
  console.log(`  Moves total: ${moveDocs.length}`);
  console.log(`  Profiles:    A=${profileCounts.A} B=${profileCounts.B} C=${profileCounts.C} D=${profileCounts.D}`);
  for (const plan of quantPlans) {
    console.log(
      `  ${plan.sku.padEnd(16)} profile=${plan.profile} moves=${String(plan.moveCount).padStart(2)} ` +
        `total_demand=${String(plan.totalDemand).padStart(4)} on_hand=${plan.onHand}`
    );
  }
  console.log('======================================================\n');

  return {
    profileCounts,
    totalMoves: moveDocs.length,
    dateFrom: weekStarts[0],
    dateTo: weekStarts[weekStarts.length - 1],
    products: quantPlans,
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  runGenerator()
    .then(async () => {
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('History Generation Failed:', error);
      await mongoose.connection.close();
      process.exit(1);
    });
}

export { runGenerator };
