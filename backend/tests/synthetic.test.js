import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';
import {
  HISTORY_SEED,
  WEEKS,
  BASE_WEEKLY_DEMAND,
  mulberry32,
  assignProfile,
  generateWeeklySeries,
  isoWeekLabel,
} from '../src/scripts/generateHistory.js';
import {
  VENDOR_SEED,
  runVendorSeed,
} from '../src/scripts/seedVendors.js';

// ---------------------------------------------------------------------------
// 1. PURE LOGIC TESTS — no Mongo required. Both scripts are import-safe: they
//    only connect to the database inside their run functions / direct-run guard.
// ---------------------------------------------------------------------------
describe('Synthetic history pure logic (no DB)', () => {
  const seedRef = { seed: HISTORY_SEED, sku: 'STEEL-12MM-ROD', baseWeeklyDemand: 140 };

  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 50; i += 1) {
      const v = a();
      assert.strictEqual(v, b());
      assert.ok(v >= 0 && v < 1);
    }
  });

  it('generateWeeklySeries is deterministic: same seed -> identical array', () => {
    const first = generateWeeklySeries('A', WEEKS, seedRef);
    const second = generateWeeklySeries('A', WEEKS, seedRef);
    assert.deepEqual(first, second);
    const seasonal1 = generateWeeklySeries('B', WEEKS, seedRef);
    const seasonal2 = generateWeeklySeries('B', WEEKS, seedRef);
    assert.deepEqual(seasonal1, seasonal2);
  });

  it('profile A: correct length, strictly positive every week', () => {
    const series = generateWeeklySeries('A', WEEKS, seedRef);
    assert.strictEqual(series.length, WEEKS);
    for (const q of series) {
      assert.ok(q >= 1, `stable profile must never be zero, got ${q}`);
      assert.ok(Number.isInteger(q));
    }
  });

  it('profile B: length equals weeks and values positive', () => {
    const series = generateWeeklySeries('B', WEEKS, seedRef);
    assert.strictEqual(series.length, WEEKS);
    for (const q of series) assert.ok(q >= 1);
  });

  it('profile C: intermittent — more than 30% zero weeks, bursts 1-3', () => {
    const series = generateWeeklySeries('C', WEEKS, seedRef);
    assert.strictEqual(series.length, WEEKS);
    const zeros = series.filter((q) => q === 0).length;
    assert.ok(
      zeros / WEEKS > 0.3,
      `intermittent profile should have >30% zero weeks, got ${(zeros / WEEKS) * 100}%`
    );
    for (const q of series) assert.ok(q === 0 || (q >= 1 && q <= 3));
  });

  it('profile D: cold-start — only the last 8-12 weeks have data', () => {
    const series = generateWeeklySeries('D', WEEKS, seedRef);
    assert.strictEqual(series.length, WEEKS);
    const firstNonZero = series.findIndex((q) => q > 0);
    assert.ok(firstNonZero >= WEEKS - 12 && firstNonZero <= WEEKS - 8,
      `cold-start history should start within the last 8-12 weeks, index ${firstNonZero}`);
    // No gaps after the product "launches".
    for (let w = firstNonZero; w < WEEKS; w += 1) assert.ok(series[w] >= 1);
  });

  it('assignProfile covers every profile across the 7 seeded products', () => {
    const profiles = new Set([0, 1, 2, 3, 4, 5, 6].map(assignProfile));
    for (const p of ['A', 'B', 'C', 'D']) assert.ok(profiles.has(p), `profile ${p} missing`);
    assert.strictEqual(assignProfile(0), 'D');
    assert.strictEqual(assignProfile(3), 'B');
    assert.strictEqual(assignProfile(5), 'C');
  });

  it('isoWeekLabel yields unique yyyy/Www labels for 60 consecutive Mondays', () => {
    const monday = new Date(Date.UTC(2026, 0, 5));
    const labels = new Set();
    for (let w = 0; w < WEEKS; w += 1) {
      const d = new Date(monday.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      labels.add(isoWeekLabel(d));
    }
    assert.strictEqual(labels.size, WEEKS);
    for (const label of labels) assert.match(label, /^\d{4}\/W\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// 2. DB SMOKE TEST — real Mongo (Atlas), mirrors auth.test.js conventions.
//    Skips itself gracefully when the database is unreachable so the pure
//    suite above always runs hermetically. Cleans up everything it creates.
// ---------------------------------------------------------------------------
describe('Vendor seed DB smoke (real Mongo, guarded)', () => {
  let dbAvailable = false;

  before(async () => {
    try {
      await connectDB();
      dbAvailable = mongoose.connection.readyState === 1;
    } catch {
      dbAvailable = false;
    }
  });

  after(async () => {
    if (dbAvailable) {
      const seedVendors = await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id');
      await VendorPrice.deleteMany({ vendor: { $in: seedVendors.map((v) => v._id) } });
      await Vendor.deleteMany({ vendorCode: /^VND-SEED-/ });
      await mongoose.connection.close();
    }
  });

  it('runs seedVendors and every active product ends with >=5 vendor prices', async (t) => {
    if (!dbAvailable) return t.skip('Mongo unavailable — pure-logic tests cover the logic');
    const result = await runVendorSeed();
    assert.ok(result.vendorCount === 120, `expected 120 vendors, got ${result.vendorCount}`);
    const vendorCount = await Vendor.countDocuments({ vendorCode: /^VND-SEED-/, source: 'seed' });
    assert.ok(vendorCount > 0, 'expected seeded vendors in DB');

    // Scope to the base-seeded SKUs only: other suites run against the same
    // shared Atlas DB and create their own products concurrently.
    const products = await Product.find({ is_active: true, sku: { $in: Object.keys(BASE_WEEKLY_DEMAND) } });
    for (const product of products) {
      const priceCount = await VendorPrice.countDocuments({ product: product._id, source: 'seed' });
      assert.ok(priceCount >= 5, `${product.sku} has only ${priceCount} vendor prices`);
      assert.ok(priceCount <= 6, `${product.sku} has ${priceCount} vendor prices, max 6`);
    }
    assert.ok(result.priceCount >= products.length * 5);
  });

  it('is idempotent: rerun does not duplicate vendors or prices', async (t) => {
    if (!dbAvailable) return t.skip('Mongo unavailable');
    const seedVendors = await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id');
    const beforeCounts = {
      vendors: seedVendors.length,
      prices: await VendorPrice.countDocuments({ source: 'seed', vendor: { $in: seedVendors.map((v) => v._id) } }),
    };
    await runVendorSeed();
    const afterVendors = await Vendor.countDocuments({ vendorCode: /^VND-SEED-/ });
    const afterPrices = await VendorPrice.countDocuments({ source: 'seed', vendor: { $in: await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id') } });
    assert.strictEqual(afterVendors, beforeCounts.vendors);
    assert.strictEqual(afterPrices, beforeCounts.prices);
  });
});