import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createMarketPort } from '../src/services/vendors/marketPort.js';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';

// Self-contained: owns its own product, vendors, prices; only deletes its own records.

describe('Vendor Search Service', () => {
  let port;
  let productId, productSku;
  let v1, v2, v3;

  before(async () => {
    await connectDB();
    port = createMarketPort();

    productSku = `VS-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const product = await Product.create({ name: 'Vendor Search Widget', sku: productSku, uom: 'units', is_active: true });
    productId = product._id;

    v1 = await Vendor.create({ vendorCode: 'VS-A', name: 'Alpha Industrial', city: 'Mumbai', state: 'MH', gstin: '27AAAAA0000A1Z5', source: 'seed', isVerified: true });
    v2 = await Vendor.create({ vendorCode: 'VS-B', name: 'Beta Traders', city: 'Mumbai', state: 'MH', source: 'seed', isVerified: false });
    v3 = await Vendor.create({ vendorCode: 'VS-C', name: 'Gamma Supply', city: 'Delhi', state: 'DL', source: 'seed', isVerified: false });

    await VendorPrice.create([
      { vendor: v1._id, product: productId, sku: productSku, price: 100, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
      { vendor: v2._id, product: productId, sku: productSku, price: 80, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
      { vendor: v3._id, product: productId, sku: productSku, price: 120, currency: 'INR', uom: 'units', source: 'seed', confidence: 'demo' },
    ]);
  });

  after(async () => {
    await VendorPrice.deleteMany({ product: productId });
    await Vendor.deleteMany({ _id: { $in: [v1?._id, v2?._id, v3?._id] } });
    await Product.deleteMany({ _id: productId });
    await mongoose.connection.close();
  });

  it('createMarketPort exposes boundary methods', () => {
    assert.strictEqual(typeof port.searchProducts, 'function');
    assert.strictEqual(typeof port.getBestPricesForProduct, 'function');
    assert.strictEqual(typeof port.searchVendors, 'function');
  });

  it('searchProducts returns the owned product by sku', async () => {
    const res = await port.searchProducts(productSku);
    assert.ok(res.length >= 1);
    assert.ok(res.some((p) => p.sku === productSku));
  });

  it('getBestPricesForProduct returns vendors sorted cheapest-first with provenance', async () => {
    const prices = await port.getBestPricesForProduct(productId, { live: false, limit: 10 });
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