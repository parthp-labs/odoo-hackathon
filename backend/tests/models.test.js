import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Vendor,
  VendorPrice,
  Forecast,
  ReorderSuggestion,
} from '../src/models/index.js';
import mongoose from 'mongoose';

test('new replenishment models compile without a DB connection', () => {
  // Model compile is enough to prove schema correctness; no Mongo needed.
  assert.strictEqual(typeof Vendor.modelName, 'string');
  assert.strictEqual(typeof VendorPrice.modelName, 'string');
  assert.strictEqual(typeof Forecast.modelName, 'string');
  assert.strictEqual(typeof ReorderSuggestion.modelName, 'string');
});

test('vendorPrice schema defaults', () => {
  const vp = new VendorPrice({});
  // price required -> invalid without it
  assert.ok(vp.validateSync());
  const vp2 = new VendorPrice({ vendor: new mongoose.Types.ObjectId(), product: new mongoose.Types.ObjectId(), sku: 'XYZ', price: 10 });
  const err = vp2.validateSync();
  assert.strictEqual(err, undefined);
  assert.strictEqual(vp2.currency, 'INR');
  assert.strictEqual(vp2.confidence, 'demo');
  assert.strictEqual(vp2.source, 'seed');
  assert.strictEqual(vp2.priceType, 'list');
});

test('forecast defaults', () => {
  const f = new Forecast({ product: new mongoose.Types.ObjectId(), sku: 'A', forecastedDemand: 5 });
  assert.strictEqual(f.horizonWeeks, 8);
  assert.strictEqual(f.modelType, 'seasonalNaive');
  assert.strictEqual(f.validateSync(), undefined);
});

test('reorderSuggestion defaults', () => {
  const r = new ReorderSuggestion({ product: new mongoose.Types.ObjectId(), sku: 'A' });
  assert.strictEqual(r.trigger, 'none');
  assert.strictEqual(r.method, 'ses');
  assert.strictEqual(r.validateSync(), undefined);
});