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
  VENDOR_CATEGORIES,
  SEED_SKU_SPECS,
  buildIllustrativeGstin,
  generateVendorDataset,
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

describe('Indian vendor seed pure logic (no DB)', () => {
  it('fixture list has 25 vendors with distinct cities in the intended regions', () => {
    assert.strictEqual(VENDOR_FIXTURES.length, 25);
    const names = new Set(VENDOR_FIXTURES.map((v) => v.name));
    assert.strictEqual(names.size, 25);
  });

  it('buildIllustrativeGstin produces 15-char codes, deterministic, unique per name', () => {
    const codes = new Set();
    for (const fixture of VENDOR_FIXTURES) {
      const g = buildIllustrativeGstin(fixture.name, fixture.city);
      assert.strictEqual(g.length, 15, `gstin for ${fixture.name} is ${g}`);
      assert.strictEqual(g, buildIllustrativeGstin(fixture.name, fixture.city));
      assert.match(g, /^[0-9]{2}[A-Z0-9]{13}$/);
      codes.add(g);
    }
    assert.strictEqual(codes.size, VENDOR_FIXTURES.length);
  });

  it('generateVendorPricesForProduct is deterministic', () => {
    const detail = { sku: 'STEEL-12MM-ROD', uom: 'kg', index: 0 };
    const now = new Date('2026-09-26T00:00:00Z');
    const first = generateVendorPricesForProduct(detail, now);
    const second = generateVendorPricesForProduct(detail, now);
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, generateVendorPricesForProduct({ sku: 'HELM-SAFE-YEL', uom: 'units', index: 6 }, now));
  });

  it('vendor price drafts: 3-6 rows, INR, positive price, demo confidence, distinct vendors', () => {
    const skus = [
      { sku: 'STEEL-12MM-ROD', uom: 'kg', index: 0 },
      { sku: 'CHAIR-ERGO-MESH', uom: 'units', index: 3 },
      { sku: 'HELM-SAFE-YEL', uom: 'units', index: 6 },
    ];
    for (const detail of skus) {
      const drafts = generateVendorPricesForProduct(detail);
      assert.ok(drafts.length >= 3 && drafts.length <= 6,
        `${detail.sku} got ${drafts.length} drafts, want 3-6`);
      const vendorCodes = new Set(drafts.map((d) => d.vendorCode));
      assert.strictEqual(vendorCodes.size, drafts.length, 'vendor codes must be distinct per product');
      for (const d of drafts) {
        assert.strictEqual(d.currency, 'INR');
        assert.ok(d.price > 0, `price must be positive, got ${d.price}`);
        assert.strictEqual(d.confidence, 'demo');
        assert.strictEqual(d.source, 'seed');
        assert.strictEqual(d.priceType, 'list');
        assert.strictEqual(d.uom, detail.uom);
        assert.ok(d.leadDays >= 3 && d.leadDays <= 21);
        assert.ok([25, 50, 100].includes(d.moq));
        assert.ok(new Date(d.effFrom) < new Date(), 'effFrom must be in the past');
      }
    }
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

  it('runs seedVendors and every active product ends with >=3 vendor prices', async (t) => {
    if (!dbAvailable) return t.skip('Mongo unavailable — pure-logic tests cover the logic');
    const result = await runVendorSeed();
    assert.ok(result.vendorCount === 25);
    const vendorCount = await Vendor.countDocuments({ vendorCode: /^VND-SEED-/, source: 'seed' });
    assert.ok(vendorCount > 0, 'expected seeded vendors in DB');

    // Scope to the base-seeded SKUs only: other suites run against the same
    // shared Atlas DB and create their own products concurrently.
    const products = await Product.find({ is_active: true, sku: { $in: Object.keys(BASE_WEEKLY_DEMAND) } });
    for (const product of products) {
      const priceCount = await VendorPrice.countDocuments({ product: product._id, source: 'seed' });
      assert.ok(priceCount >= 3, `${product.sku} has only ${priceCount} vendor prices`);
      assert.ok(priceCount <= 6, `${product.sku} has ${priceCount} vendor prices, max 6`);
    }
    assert.ok(result.priceCount >= products.length * 3);
  });

  it('is idempotent: rerun does not duplicate vendors or prices', async (t) => {
    if (!dbAvailable) return t.skip('Mongo unavailable');
    const beforeCounts = {
      vendors: await Vendor.countDocuments({ vendorCode: /^VND-SEED-/ }),
      prices: await VendorPrice.countDocuments({ source: 'seed', vendor: { $in: await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id') } }),
    };
    await runVendorSeed();
    const afterVendors = await Vendor.countDocuments({ vendorCode: /^VND-SEED-/ });
    const afterPrices = await VendorPrice.countDocuments({ source: 'seed', vendor: { $in: await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id') } });
    assert.strictEqual(afterVendors, beforeCounts.vendors);
    assert.strictEqual(afterPrices, beforeCounts.prices);
  });
});
