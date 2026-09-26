import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createReplenishPort } from '../src/services/replenishment/replenishPort.js';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Forecast from '../src/models/forecast.model.js';
import StockQuant from '../src/models/stockQuant.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';
import ReorderSuggestion from '../src/models/reorderSuggestion.model.js';

// Integration-style, mirrors auth.test.js / forecastService.test.js (real Mongo).

describe('Reorder Service (combined replenishment flow)', () => {
  let port;
  let product;
  let vendor;
  let vendorPrice;

  before(async () => {
    await connectDB();
    port = createReplenishPort();

    // Provision a controlled product + forecast + quant + vendor so assertions are stable.
    product = await Product.findOne({ is_active: true }).select('_id sku uom').lean()
      || await Product.create({ name: 'Reorder Test Widget', sku: 'RT-0001', uom: 'units', is_active: true });

    await Forecast.deleteOne({ sku: product.sku });
    await Forecast.create({
      product: product._id,
      sku: product.sku,
      horizonWeeks: 8,
      forecastedDemand: 80, // 10/week
      quantiles: { p10: 55, p50: 80, p90: 110 },
      modelType: 'ses',
      generatedAt: new Date(),
    });

    // Contracted on-hand so the math is deterministic: we don't force quants here
    // (the seeded DB may already have them); instead assert formula invariants.

    vendor = await Vendor.create({
      vendorCode: 'RT-VND', name: 'Replenish Test Vendor', city: 'Noida',
      state: 'UP', gstin: '09AAAAA0000A1Z5', source: 'seed', isVerified: false,
    });
    vendorPrice = await VendorPrice.create({
      vendor: vendor._id, product: product._id, sku: product.sku, priceType: 'list',
      price: 118.5, currency: 'INR', uom: 'units', moq: 25, leadDays: 5,
      source: 'seed', confidence: 'demo',
    });
  });

  after(async () => {
    await Forecast.deleteOne({ sku: product?.sku });
    await ReorderSuggestion.deleteMany({ product: product?._id });
    await VendorPrice.deleteOne({ _id: vendorPrice?._id });
    await Vendor.deleteOne({ _id: vendor?._id });
    await mongoose.connection.close();
  });

  it('createReplenishPort exposes the boundary methods', () => {
    assert.strictEqual(typeof port.recommendReorder, 'function');
    assert.strictEqual(typeof port.recommendAll, 'function');
    assert.strictEqual(typeof port.listSourceableVendors, 'function');
  });

  it('recommendReorder returns a recommendation for a known SKU', async () => {
    const rec = await port.recommendReorder(product.sku);
    assert.ok(rec);
    assert.strictEqual(rec.sku, product.sku);
    assert.ok(['reorder', 'none'].includes(rec.trigger));
    assert.ok(rec.qtyToOrder >= 0);
    assert.ok(rec.onHand >= 0);
  });

  it('reorder quantity obeys qty = forecastOverLead + safetyStock - (onHand - reserved)', async () => {
    const rec = await port.recommendReorder(product.sku, { serviceLevel: 95, leadDays: 7 });
    assert.ok(rec.forecastOverLeadTime >= 0);
    assert.ok(rec.safetyStock >= 0);
    const effective = rec.onHand - rec.reserved;
    const expected = Math.max(0, Math.ceil(rec.forecastOverLeadTime + rec.safetyStock - effective));
    assert.strictEqual(rec.qtyToOrder, expected);
    // With a near-zero effective stock the recommendation should trigger reorder.
    assert.strictEqual(rec.trigger, 'reorder');
  });

  it('recommendAll returns suggestions for every forecasted SKU', async () => {
    const all = await port.recommendAll({ serviceLevel: 95 });
    assert.ok(Array.isArray(all));
    assert.ok(all.some((r) => r.sku === product.sku));
  });

  it('listSourceableVendors returns the seeded vendor cheapest-first', async () => {
    const vendors = await port.listSourceableVendors(product.sku, product._id);
    assert.ok(vendors.length >= 1);
    assert.strictEqual(vendors[0].name, 'Replenish Test Vendor');
    assert.strictEqual(vendors[0].currency, 'INR');
    assert.strictEqual(vendors[0].confidence, 'demo');
    // prices ascending
    const prices = vendors.map((v) => v.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it('recommendReorder returns null for an unknown SKU', async () => {
    assert.strictEqual(await port.recommendReorder('NO-SUCH-999'), null);
  });
});