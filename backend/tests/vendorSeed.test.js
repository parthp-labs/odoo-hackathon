// ---------------------------------------------------------------------------
// Hermetic unit tests for the pure vendor-seed generator. NO DB, NO network:
// only generateVendorDataset() (a pure function) is exercised.
//
// NOTE on vendorCode shape: the dataset carries 120 vendors, so codes are
// zero-padded VND-SEED-00 … VND-SEED-119 (two digits up to 99, three beyond).
// ---------------------------------------------------------------------------
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VENDOR_SEED,
  VENDOR_CATEGORIES,
  SEED_SKU_SPECS,
  CITY_STATE_CODE,
  generateVendorDataset,
} from '../src/scripts/seedVendors.js';

const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$/;

const dataset = generateVendorDataset(VENDOR_SEED);

describe('Vendor seed dataset (pure generator, hermetic)', () => {
  it('has exactly 120 vendors with unique, well-formed codes', () => {
    assert.strictEqual(dataset.vendors.length, 120);
    const codes = new Set(dataset.vendors.map((v) => v.vendorCode));
    assert.strictEqual(codes.size, 120, 'vendor codes must be unique');
    for (const v of dataset.vendors) {
      assert.match(v.vendorCode, /^VND-SEED-\d{2,3}$/, `bad code ${v.vendorCode}`);
    }
  });

  it('every vendor is an unverified seed-sourced demo row', () => {
    for (const v of dataset.vendors) {
      assert.strictEqual(v.isVerified, false);
      assert.strictEqual(v.source, 'seed');
      assert.ok(v.name && v.name.length > 3, `bad name: ${v.name}`);
    }
  });

  it('vendor names are unique', () => {
    const names = new Set(dataset.vendors.map((v) => v.name));
    assert.strictEqual(names.size, dataset.vendors.length);
  });

  it('all 5 seeded categories are represented', () => {
    const cats = new Set(dataset.vendors.map((v) => v.category));
    for (const cat of VENDOR_CATEGORIES) {
      assert.ok(cats.has(cat), `category missing: ${cat}`);
    }
    assert.strictEqual(cats.size, 5);
  });

  it('vendors span >=6 city/state pairs with real GST state codes', () => {
    const pairs = new Set();
    for (const v of dataset.vendors) {
      const region = CITY_STATE_CODE[v.city];
      assert.ok(region, `city not in CITY_STATE_CODE: ${v.city}`);
      assert.strictEqual(v.state, region.state);
      assert.ok(v.gstin.startsWith(region.code), `gstin must start with GST code ${region.code} for ${v.city}`);
      pairs.add(`${v.city}|${v.state}`);
    }
    assert.ok(pairs.size >= 6, `expected >=6 city/state pairs, got ${pairs.size}`);
  });

  it('every GSTIN matches the 15-char GSTIN shape', () => {
    for (const v of dataset.vendors) {
      assert.strictEqual(v.gstin.length, 15, `gstin length for ${v.name}: ${v.gstin}`);
      assert.match(v.gstin, GSTIN_SHAPE, `gstin shape for ${v.name}: ${v.gstin}`);
    }
  });

  it('every seeded SKU has >=5 price rows (>=35 total)', () => {
    assert.ok(dataset.prices.length >= 7 * 5, `expected >=35 prices, got ${dataset.prices.length}`);
    for (const { sku } of SEED_SKU_SPECS) {
      const rows = dataset.prices.filter((p) => p.sku === sku);
      assert.ok(rows.length >= 5, `${sku} has ${rows.length} price rows, want >=5`);
      const vendorsPerSku = new Set(rows.map((r) => r.vendorCode));
      assert.strictEqual(vendorsPerSku.size, rows.length, `${sku}: vendors must be distinct per SKU`);
    }
    const extraSkus = new Set(
      dataset.prices.map((p) => p.sku).filter((s) => !SEED_SKU_SPECS.some((x) => x.sku === s))
    );
    assert.strictEqual(extraSkus.size, 0, `unexpected SKUs priced: ${[...extraSkus]}`);
  });

  it('price rows carry valid fields', () => {
    const vendorCodes = new Set(dataset.vendors.map((v) => v.vendorCode));
    for (const p of dataset.prices) {
      assert.ok(vendorCodes.has(p.vendorCode), `price for unknown vendor ${p.vendorCode}`);
      assert.ok(Number.isFinite(p.price) && p.price > 0, `bad price: ${p.price}`);
      assert.strictEqual(p.currency, 'INR');
      assert.strictEqual(p.confidence, 'demo');
      assert.strictEqual(p.priceType, 'list');
      assert.strictEqual(p.source, 'seed');
      assert.ok(p.moq > 0, `moq must be > 0, got ${p.moq}`);
      assert.ok(p.leadDays >= 1 && p.leadDays >= 3 && p.leadDays <= 21, `leadDays out of 3-21: ${p.leadDays}`);
      assert.ok(new Date(p.effFrom) < new Date(), 'effFrom must be in the past');
      assert.strictEqual(p.effTo, null);
    }
  });

  it('generator is deterministic: same seed -> deep-equal dataset', () => {
    const a = generateVendorDataset(20260927);
    const b = generateVendorDataset(20260927);
    assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
    assert.strictEqual(a.vendors.length, 120);
  });

  it('different seeds produce different datasets', () => {
    const alt = generateVendorDataset(20260928);
    assert.notStrictEqual(JSON.stringify(alt), JSON.stringify(dataset));
  });
});
