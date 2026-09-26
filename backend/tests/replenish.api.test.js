import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import OtpVerification from '../src/models/otpVerification.model.js';
import Product from '../src/models/product.model.js';
import Forecast from '../src/models/forecast.model.js';
import ReorderSuggestion from '../src/models/reorderSuggestion.model.js';

// Integration API test, self-contained: creates its OWN user + product with
// unique identifiers and cleans up ONLY its own records, so parallel sibling
// test files sharing the same live DB never collide.

describe('Replenishment API (protected routes)', () => {
  let server;
  let baseUrl;
  let authToken;
  let productId, productSku;
  let myEmail;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}/api`;

    // Own user with a unique email.
    myEmail = `repl_${Date.now()}_${Math.floor(Math.random() * 1e4)}@stocksense.test`;
    const r = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Repl Tester', email: myEmail, password: 'Passw0rd!', role: 'admin' }),
    });
    assert.strictEqual(r.status, 201);
    const otp = await OtpVerification.findOne({ email: myEmail, purpose: 'email_verification', is_used: false });
    const v = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: myEmail, otp_code: otp.otp_code }),
    });
    authToken = (await v.json()).token;
    assert.ok(authToken);

    // Own product + forecast.
    productSku = `APIREPL-${Date.now().toString().slice(-6)}`;
    const product = await Product.create({ name: 'API Repl Test', sku: productSku, is_active: true });
    productId = product._id;
    await Forecast.create({
      product: productId, sku: productSku, horizonWeeks: 8, forecastedDemand: 64,
      quantiles: { p10: 40, p50: 64, p90: 90 }, modelType: 'ses', generatedAt: new Date(),
    });
  });

  after(async () => {
    await Forecast.deleteMany({ product: productId });
    await ReorderSuggestion.deleteMany({ product: productId });
    await Product.deleteMany({ _id: productId });
    await OtpVerification.deleteMany({ email: myEmail });
    await User.deleteMany({ email: myEmail });
    if (server) server.close();
    await mongoose.connection.close();
  });

  const authed = (auth = true) => ({ 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${authToken}` } : {}) });

  it('401 without a token on every replenishment endpoint', async () => {
    for (const path of [
      '/replenishment/recommendations',
      `/replenishment/forecast/${productSku}`,
      `/product/${productSku}/vendors`,
      '/vendors/search?q=x',
    ]) {
      const res = await fetch(`${baseUrl}${path}`, { headers: authed(false) });
      assert.strictEqual(res.status, 401, `expected 401 for ${path}`);
    }
  });

  it('GET /replenishment/forecast/:sku returns a forecast when authed', async () => {
    const res = await fetch(`${baseUrl}/replenishment/forecast/${productSku}?horizon=8`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.sku, productSku);
    assert.strictEqual(typeof data.data.forecastedDemand, 'number');
  });

  it('rejects an out-of-range horizon with 400', async () => {
    const res = await fetch(`${baseUrl}/replenishment/forecast/${productSku}?horizon=99`, { headers: authed() });
    assert.strictEqual(res.status, 400);
  });

  it('GET /replenishment/recommendations returns a suggestion for an existing SKU', async () => {
    const res = await fetch(`${baseUrl}/replenishment/recommendations?sku=${productSku}`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.sku, productSku);
    assert.ok(['none', 'reorder'].includes(data.data.trigger));
  });

  it('404 for an unknown SKU on recommendations', async () => {
    const res = await fetch(`${baseUrl}/replenishment/recommendations?sku=NOPE-999`, { headers: authed() });
    assert.strictEqual(res.status, 404);
  });

  it('GET /product/:sku/vendors returns vendor list for the owned product', async () => {
    const res = await fetch(`${baseUrl}/product/${productSku}/vendors`, { headers: authed() });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.product.sku, productSku);
    assert.ok(Array.isArray(data.data.vendors));
  });
});