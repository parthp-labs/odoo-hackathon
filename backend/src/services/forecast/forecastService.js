// Forecast service: aggregates weekly demand history from StockMove,
// runs the pure forecast builder, and persists snapshots to the Forecast model.
// Reads demand from the ledger behind a small adapter (the synthetic generator
// and real operations both write StockMoves, so this stays source-agnostic).

import StockMove from '../../models/stockMove.model.js';
import Product from '../../models/product.model.js';
import Location from '../../models/location.model.js';
import Forecast from '../../models/forecast.model.js';
import { buildForecast } from './builder.js';

const DEFAULT_HORIZON_WEEKS = 8;

/**
 * Aggregate weekly demand (units moved OUT to a customer/delivery location)
 * for one product across the ledger, oldest week first.
 * @returns {Promise<{series:number[], sourceFrom:Date|null, sourceTo:Date|null}>}
 */
export async function aggregateWeeklyDemand(productId, { weeks = 60, now = new Date() } = {}) {
  // OUT demand = moves whose destination is a customer/vendor virtual location.
  const customerLocs = await Location.find({
    location_type: { $in: ['customer', 'vendor'] },
  }).select('_id').lean();
  const locIds = customerLocs.map((l) => l._id);
  if (locIds.length === 0) return { series: [], sourceFrom: null, sourceTo: null };

  const moves = await StockMove.find({
    product: productId,
    status: 'done',
    destination_location: { $in: locIds },
    move_date: { $gte: new Date(now.getTime() - weeks * 7 * 24 * 3600 * 1000) },
  })
    .select('quantity move_date')
    .lean();

  // Bucket by ISO week. Use map keyed by "yyyy-Www".
  const end = new Date(now);
  const start = new Date(now.getTime() - weeks * 7 * 24 * 3600 * 1000);
  const buckets = new Map();
  // prefill empty weeks so the series is continuous even with zero-demand weeks
  for (let w = 0; w < weeks; w++) {
    const d = new Date(start.getTime() + w * 7 * 24 * 3600 * 1000);
    buckets.set(isoWeek(d), 0);
  }
  for (const m of moves) {
    const key = isoWeek(new Date(m.move_date));
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + m.quantity);
  }
  // oldest-first numeric week order = insertion order (prefill was increasing)
  const series = Array.from(buckets.values());
  const nonEmpty = moves.length > 0;
  return {
    series,
    sourceFrom: nonEmpty ? start : null,
    sourceTo: nonEmpty ? end : null,
  };
}

/**
 * Refit and persist a forecast snapshot for every active product.
 */
export async function refitAll({ horizonWeeks = DEFAULT_HORIZON_WEEKS } = {}) {
  const products = await Product.find({ is_active: true }).select('_id sku category name').lean();
  const results = [];
  for (const p of products) {
    const { series, sourceFrom, sourceTo } = await aggregateWeeklyDemand(p._id);
    const forecast = buildForecast(series, horizonWeeks);
    await Forecast.findOneAndUpdate(
      { sku: p.sku, horizonWeeks },
      {
        product: p._id,
        sku: p.sku,
        horizonWeeks,
        forecastedDemand: forecast.pointForecast,
        quantiles: forecast.quantiles,
        modelType: forecast.method,
        generatedAt: new Date(),
        sourceDataFrom: sourceFrom,
        sourceDataTo: sourceTo,
      },
      { upsert: true, new: true }
    );
    results.push({ sku: p.sku, method: forecast.method, pointForecast: forecast.pointForecast });
  }
  return results;
}

/**
 * Read the latest cached forecast for a SKU, refitting that SKU if none exists.
 * @returns {Promise<object|null>}
 */
export async function getForecast(sku, { horizonWeeks = DEFAULT_HORIZON_WEEKS, refitIfMissing = true } = {}) {
  const cached = await Forecast.findOne({ sku, horizonWeeks }).sort({ generatedAt: -1 }).lean();
  if (cached) return cached;
  if (!refitIfMissing) return null;
  const product = await Product.findOne({ sku }).select('_id sku').lean();
  if (!product) return null;
  const { series, sourceFrom, sourceTo } = await aggregateWeeklyDemand(product._id);
  const forecast = buildForecast(series, horizonWeeks);
  return Forecast.findOneAndUpdate(
    { sku, horizonWeeks },
    {
      product: product._id,
      sku,
      horizonWeeks,
      forecastedDemand: forecast.pointForecast,
      quantiles: forecast.quantiles,
      modelType: forecast.method,
      generatedAt: new Date(),
      sourceDataFrom: sourceFrom,
      sourceDataTo: sourceTo,
    },
    { upsert: true, new: true }
  ).lean();
}

/** ISO week key helper: returns "yyyy-Www" for a Date. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}