import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import OtpVerification from '../src/models/otpVerification.model.js';
import Product from '../src/models/product.model.js';
import Forecast from '../src/models/forecast.model.js';
import Vendor from '../src/models/vendor.model.js';
import VendorPrice from '../src/models/vendorPrice.model.js';
import ReorderSuggestion from '../src/models/reorderSuggestion.model.js';

describe('Replenishment API (protected routes)', () => {
  let server;
  let baseUrl;
  let authToken;
  let product;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api`;

    // Authenticate: register a throwaway user, verify OTP, get token.
    const email = `repl_${Date.now()}@example.com`;
    const r = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Repl Tester', email, password: 'Passw0rd!', role: 'admin' }),
    });
    assert.strictEqual(r.status, 201);
    const otp = await OtpVerification.findOne({ email, purpose: 'email_verification', is_used: false });
    const v = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otp.otp_code }),
    });
    const vdata = await v.json();
    authToken = vdata.token;
    assert.ok(authToken);

    // Ensure a product + a forecast exist so endpoints have data.
    product = await Product.findOne({ is_active: true }).select('_id sku').lean()
      || await Product.create({ name: 'API Repl Test', sku: 'APIREPL-1', is_active: true });
    await Forecast.deleteOne({ sku: product.sku });
    await Forecast.create({
      product: product._id, sku: product.sku, horizonWeeks: 8, forecastedDemand: 64,
      quantiles: { p10: 40, p50: 64, p90: 90 }, modelType: 'ses', generatedAt: new Date(),
    });
  });

  after(async () => {
    await Forecast.deleteMany({ sku: product?.sku });
    await ReorderSuggestion.deleteMany({ product: product?._id });
    await VendorPrice.deleteMany({ sku: { $regex: '^APIREPL' } });
    await Vendor.deleteMany({ name: /^API Repl/ });
    await User.deleteMany({ email: /.+@example\.com$/ });
    if (server) server.close();
    await mongoose.connection.close();
  });

  const authed = (auth = true) => ({ 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${authToken}` } : {}) });

  it('401 without a token on every replenishment endpoint', async () => {
    for (const path of [
      '/replenishment/recommendations',
      `/replenishment/forecast/${product.sku}`,
      `/product/${product.sku}/vendors`,
      '/vendors/search?q=x',
    ]) {
      const res = await fetch(`${baseUrl}${path}`, { headers: authed(false) });
      assert.strictEqual(res.status, 401, `expected 401 for ${path}`);
    }
  });

  it('GET /replenishment/forecast/:sku returns a forecast when authed', async () => {
    const res = await fetch(`${baseUrl}/replenishment/forecast/${product.sku}?horizon=8`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.sku, product.sku);
    assert.strictEqual(typeof data.data.forecastedDemand, 'number');
  });

  it('rejects an out-of-range horizon with 400', async () => {
    const res = await fetch(`${baseUrl}/replenishment/forecast/${product.sku}?horizon=99`, { headers: authed() });
    assert.strictEqual(res.status, 400);
  });

  it('GET /replenishment/recommendations returns a suggestion for an existing SKU', async () => {
    const res = await fetch(`${baseUrl}/replenishment/recommendations?sku=${product.sku}`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.sku, product.sku);
    assert.ok(['none', 'reorder'].includes(data.data.trigger));
  });

  it('404 for an unknown SKU on recommendations', async () => {
    const res = await fetch(`${baseUrl}/replenishment/recommendations?sku=NOPE-999`, { headers: authed() });
    assert.strictEqual(res.status, 404);
  });

  it('GET /product/:sku/vendors returns vendor list (may be empty without seed)', async () => {
    // We don't seed vendors for this product; it should still return 200 with the product shape.
    const res = await fetch(`${baseUrl}/product/${product.sku}/vendors`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.product.sku, product.sku);
    assert.ok(Array.isArray(data.data.vendors));
  });
});