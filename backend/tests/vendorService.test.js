import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createMarketPort } from '../src/services/vendors/marketPort.js';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';

describe('Vendor Search Service', () => {
  let port;
  let product;
  let v1, v2, v3;

  before(async () => {
    await connectDB();
    port = createMarketPort();

    product = await Product.findOne({ is_active: true }).select('_id sku uom').lean()
      || await Product.create({ name: 'Vendor Search Widget', sku: 'VS-0001', uom: 'units', is_active: true });

    v1 = await Vendor.create({ vendorCode: 'VS-A', name: 'Alpha Industrial', city: 'Mumbai', state: 'MH', gstin: '27AAAAA0000A1Z5', source: 'seed', isVerified: true });
    v2 = await Vendor.create({ vendorCode: 'VS-B', name: 'Beta Traders', city: 'Mumbai', state: 'MH', source: 'seed', isVerified: false });
    v3 = await Vendor.create({ vendorCode: 'VS-C', name: 'Gamma Supply', city: 'Delhi', state: 'DL', source: 'seed', isVerified: false });

    await VendorPrice.create([
      { vendor: v1._id, product: product._id, sku: product.sku, price: 100, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
      { vendor: v2._id, product: product._id, sku: product.sku, price: 80, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
      { vendor: v3._id, product: product._id, sku: product.sku, price: 120, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
    ]);
  });

  after(async () => {
    await VendorPrice.deleteMany({ product: product?._id });
    await Vendor.deleteMany({ _id: { $in: [v1?._id, v2?._id, v3?._id] } });
    await mongoose.connection.close();
  });

  it('createMarketPort exposes boundary methods', () => {
    assert.strictEqual(typeof port.searchProducts, 'function');
    assert.strictEqual(typeof port.getBestPricesForProduct, 'function');
    assert.strictEqual(typeof port.searchVendors, 'function');
  });

  it('searchProducts returns the seeded product by sku', async () => {
    const res = await port.searchProducts(product.sku);
    assert.ok(res.length >= 1);
    assert.strictEqual(res[0].sku, product.sku);
  });

  it('getBestPricesForProduct returns vendors sorted cheapest-first with provenance', async () => {
    const prices = await port.getBestPricesForProduct(product._id, { live: false, limit: 10 });
    assert.strictEqual(prices.length, 3);
    assert.strictEqual(prices[0].name, 'Beta Traders'); // 80 cheapest
    assert.strictEqual(prices[0].currency, 'INR');
    assert.strictEqual(prices[0].confidence, 'demo');
    const sorted = prices.map((p) => p.price);
    assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b));
  });

  it('searchVendors finds a vendor by city and by name', async () => {
    const byCity = await port.searchVendors('Mumbai');
    assert.ok(byCity.some((v) => v.vendorCode === 'VS-A'));
    const byName = await port.searchVendors('Gamma');
    assert.ok(byName.some((v) => v.vendorCode === 'VS-C'));
  });
});