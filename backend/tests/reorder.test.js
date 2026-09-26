import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createReplenishPort } from '../src/services/replenishment/replenishPort.js';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Forecast from '../src/models/forecast.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';
import ReorderSuggestion from '../src/models/reorderSuggestion.model.js';

// Integration-style, mirrors auth.test.js (real Mongo). Fully self-contained:
// creates its OWN product + vendor with unique SKUs and cleans up ONLY its own
// records, so parallel sibling test files (which share the same live DB) never collide.

describe('Reorder Service (combined replenishment flow)', () => {
  let port;
  let productId, productSku;
  let vendorId;

  before(async () => {
    await connectDB();
    port = createReplenishPort();

    productSku = `RT-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const product = await Product.create({ name: 'Reorder Test Widget', sku: productSku, uom: 'units', is_active: true });
    productId = product._id;

    await Forecast.create({
      product: productId, sku: productSku, horizonWeeks: 8, forecastedDemand: 80,
      quantiles: { p10: 55, p50: 80, p90: 110 }, modelType: 'ses', generatedAt: new Date(),
    });

    const vendor = await Vendor.create({
      vendorCode: 'RT-VND', name: 'Replenish Test Vendor', city: 'Noida',
      state: 'UP', gstin: '09AAAAA0000A1Z5', source: 'seed', isVerified: false,
    });
    vendorId = vendor._id;
    await VendorPrice.create({
      vendor: vendorId, product: productId, sku: productSku, priceType: 'list',
      price: 118.5, currency: 'INR', uom: 'units', moq: 25, leadDays: 5,
      source: 'seed', confidence: 'demo',
    });
  });

  after(async () => {
    await Forecast.deleteMany({ product: productId });
    await ReorderSuggestion.deleteMany({ product: productId });
    await VendorPrice.deleteMany({ product: productId });
    await Vendor.deleteMany({ _id: vendorId });
    await Product.deleteMany({ _id: productId });
    await mongoose.connection.close();
  });

  it('createReplenishPort exposes the boundary methods', () => {
    assert.strictEqual(typeof port.recommendReorder, 'function');
    assert.strictEqual(typeof port.recommendAll, 'function');
    assert.strictEqual(typeof port.listSourceableVendors, 'function');
  });

  it('recommendReorder returns a recommendation for the owned SKU', async () => {
    const rec = await port.recommendReorder(productSku);
    assert.ok(rec);
    assert.strictEqual(rec.sku, productSku);
    assert.ok(['reorder', 'none'].includes(rec.trigger));
    assert.ok(rec.qtyToOrder >= 0);
    assert.ok(rec.onHand >= 0);
  });

  it('reorder quantity = forecastOverLead + safetyStock - (onHand - reserved)', async () => {
    const rec = await port.recommendReorder(productSku, { serviceLevel: 95, leadDays: 7 });
    assert.ok(rec.forecastOverLeadTime >= 0);
    assert.ok(rec.safetyStock >= 0);
    const effective = rec.onHand - rec.reserved;
    const expected = Math.max(0, Math.ceil(rec.forecastOverLeadTime + rec.safetyStock - effective));
    assert.strictEqual(rec.qtyToOrder, expected);
  });

  it('recommendAll returns suggestions for every forecasted SKU (includes the owned one)', async () => {
    const all = await port.recommendAll({ serviceLevel: 95 });
    assert.ok(Array.isArray(all));
    assert.ok(all.some((r) => r.sku === productSku));
  });

  it('listSourceableVendors returns the owned seed vendor cheapest-first', async () => {
    const vendors = await port.listSourceableVendors(productSku, productId);
    assert.ok(vendors.length >= 1);
    assert.strictEqual(vendors[0].name, 'Replenish Test Vendor');
    assert.strictEqual(vendors[0].currency, 'INR');
    assert.strictEqual(vendors[0].confidence, 'demo');
    const prices = vendors.map((v) => v.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it('recommendReorder returns null for an unknown SKU', async () => {
    assert.strictEqual(await port.recommendReorder('NO-SUCH-999'), null);
  });
});