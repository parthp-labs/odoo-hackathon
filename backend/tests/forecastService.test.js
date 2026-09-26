import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createForecastPort } from '../src/services/forecast/forecastPort.js';
import connectDB from '../src/config/db.config.js';
import Product from '../src/models/product.model.js';
import Forecast from '../src/models/forecast.model.js';

// Integration-style: connect the real Mongo (like auth.test.js) and run the
// forecast service against whatever products exist. Pure builder logic is
// covered network-free in tests/forecast.test.js.

describe('Forecast Service (persistence + aggregation)', () => {
  let port;
  let tempProduct;

  before(async () => {
    await connectDB();
    port = createForecastPort();
  });

  after(async () => {
    if (tempProduct) {
      await Forecast.deleteMany({ product: tempProduct._id });
    }
    await mongoose.connection.close();
  });

  it('createForecastPort exposes the three boundary methods', () => {
    assert.strictEqual(typeof port.getForecast, 'function');
    assert.strictEqual(typeof port.refitAll, 'function');
    assert.strictEqual(typeof port.aggregateWeeklyDemand, 'function');
  });

  it('aggregateWeeklyDemand returns a continuous weekly series (or empty when no history)', async () => {
    const product = await Product.findOne().select('_id sku').lean();
    if (!product) {
      // No products seeded in this environment: the pure logic already covers math.
      return assert.ok(true, 'skipped (no product data present)');
    }
    const { series } = await port.aggregateWeeklyDemand(product._id, { weeks: 60 });
    assert.ok(Array.isArray(series));
    assert.ok(series.length <= 60);
    assert.ok(series.every((x) => typeof x === 'number' && x >= 0));
  });

  it('refitAll persists a Forecast per active product (idempotent upsert)', async () => {
    const results = await port.refitAll({ horizonWeeks: 4 });
    assert.ok(Array.isArray(results));
    for (const r of results) {
      assert.ok(r.sku);
      assert.ok(['seasonalNaive', 'ses', 'holtWinters', 'croston', 'sma'].includes(r.method));
      const saved = await Forecast.findOne({ sku: r.sku, horizonWeeks: 4 }).lean();
      assert.ok(saved, `expected a persisted forecast for ${r.sku}`);
      assert.ok(saved.forecastedDemand >= 0);
      assert.ok(saved.quantiles && typeof saved.quantiles.p50 === 'number');
    }
  });

  it('getForecast returns a cached snapshot or refits on demand for an existing SKU', async () => {
    const product = await Product.findOne().select('_id sku').lean();
    if (!product) return assert.ok(true, 'skipped (no products)');
    const f = await port.getForecast(product.sku, { horizonWeeks: 8 });
    assert.ok(f);
    assert.strictEqual(f.sku, product.sku);
    assert.strictEqual(typeof f.forecastedDemand, 'number');
  });

  it('getForecast returns null for an unknown SKU', async () => {
    const f = await port.getForecast('NO-SUCH-SKU-999', { refitIfMissing: true });
    assert.strictEqual(f, null);
  });
});