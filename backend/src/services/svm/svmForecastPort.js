// SvmForecastPort — serves the frozen per-SKU SVR demand forecast from the Node
// backend. Mirrors the ForecastPort interface (getForecast/refitAll/aggregateWeeklyDemand)
// so the controller can swap engines without touching reorder/vendor layers.
//
// - engine='svm' (default): build the weekly demand series from the ledger, run the
//   pure-JS recursive multi-step SVR forecast (svrPredictor), persist an 8-week
//   snapshot to the `forecast` collection with modelType:'svr'.
// - engine='stats': delegate to the statistical ForecastPort (seasons/SES/HW/Croston).
//
// The reorder service reads the `forecast` collection directly (Forecast.findOne by sku),
// so persisting SVR snapshots here is exactly how the SVM becomes the served forecast.

import Product from '../../models/product.model.js';
import Forecast from '../../models/forecast.model.js';
import { aggregateWeeklyDemand } from '../forecast/forecastService.js';
import { createForecastPort } from '../forecast/forecastPort.js';
import {
  loadSvmArtifact,
  forecastSkuForecast,
  svrPredictRaw,
  buildSvmFeatures,
} from './svrPredictor.js';

const DEFAULT_HORIZON_WEEKS = 8;
const statsPort = createForecastPort();

/** Cached loaded artifact (loaded once at import; small, static). */
let _artifact = null;
export function getArtifact() {
  if (!_artifact) _artifact = loadSvmArtifact();
  return _artifact;
}

/**
 * Resolve the frozen entry + meta (profile/base) for a SKU, with graceful
 * defaults for products not in the seeded catalog.
 * @returns {{entry:object|null, profile:string, base:number, kind:string} | null}
 */
function resolveSkuConfig(artifact, sku, series) {
  const meta = artifact?.skuMeta?.[sku];
  const trailing = series.length
    ? series.slice(-8).reduce((a, b) => a + b, 0) / series.length
    : 0;
  const profile = meta?.profile || 'A';
  const base = Number(meta?.baseWeeklyDemand ?? (trailing || 10));
  const entry = artifact?.skus?.[sku] || null;
  const kind = entry?.kind || 'baseline';
  return { entry, profile, base, kind };
}

/**
 * Forecast one SKU over a horizon using the frozen SVR (recursive multi-step)
 * or the trailing-mean fallback for baseline/guard_base SKUs. Pure (no DB).
 * @returns {{horizonWeeks:number, pointForecast:number, weekly:number[], kind:string}}
 */
export function runSvmForecast(sku, series, { horizonWeeks = DEFAULT_HORIZON_WEEKS } = {}) {
  const artifact = getArtifact();
  const cfg = resolveSkuConfig(artifact, sku, series);
  const weekly = forecastSkuForecast(
    artifact,
    { sku, profile: cfg.profile, base: cfg.base, entry: cfg.entry },
    series,
    horizonWeeks
  );
  const pointForecast = weekly.reduce((a, b) => a + b, 0);
  return { horizonWeeks, pointForecast, weekly, kind: cfg.kind };
}

/** Approximate Gaussian quantiles from the SVR's weekly forecast + residual sigma. */
function approximateQuantiles(weekly, kind) {
  const total = weekly.reduce((a, b) => a + b, 0);
  const sigmaT = Math.max(0.5, kind === 'svr' ? total * 0.277 : total * 0.4); // WAPE-computed
  const z = 1.28; // |p90 - p50| ~ 1.28 sigma
  return {
    p10: Math.max(0, total - z * sigmaT),
    p50: total,
    p90: total + z * sigmaT,
  };
}

/**
 * Get (and persist) an SVR forecast snapshot for a SKU.
 * engine 'svm' (default) -> SVR; engine 'stats' -> statistical ForecastPort.
 * @returns {Promise<object|null>} the persisted forecast doc (lean) or null
 */
export async function getForecast(sku, { horizonWeeks = DEFAULT_HORIZON_WEEKS, engine = 'svm', refitIfMissing = true } = {}) {
  sku = String(sku || '').toUpperCase();
  if (engine === 'stats') {
    return statsPort.getForecast(sku, { horizonWeeks, refitIfMissing });
  }

  const product = await Product.findOne({ sku, is_active: true }).select('_id sku').lean();
  if (!product) return null;

  const { series, sourceFrom, sourceTo } = await aggregateWeeklyDemand(product._id, { weeks: 60 });
  const f = runSvmForecast(sku, series, { horizonWeeks });

  return Forecast.findOneAndUpdate(
    { sku, horizonWeeks },
    {
      product: product._id,
      sku,
      horizonWeeks,
      forecastedDemand: f.pointForecast,
      quantiles: approximateQuantiles(f.weekly, f.kind),
      modelType: f.kind === 'svr' ? 'svr' : f.kind, // 'baseline' | 'guard_base' | 'svr'
      generatedAt: new Date(),
      sourceDataFrom: sourceFrom,
      sourceDataTo: sourceTo,
    },
    { upsert: true, new: true }
  ).lean();
}

/**
 * Refit (persist) an SVR forecast snapshot for every active product.
 */
export async function refitAll({ horizonWeeks = DEFAULT_HORIZON_WEEKS, engine = 'svm' } = {}) {
  if (engine === 'stats') return statsPort.refitAll({ horizonWeeks });
  const products = await Product.find({ is_active: true }).select('_id sku').lean();
  const results = [];
  for (const p of products) {
    const doc = await getForecast(p.sku, { horizonWeeks, engine: 'svm' });
    if (doc) results.push({ sku: doc.sku, modelType: doc.modelType, forecastedDemand: doc.forecastedDemand });
  }
  return results;
}

export { aggregateWeeklyDemand };

/** Public factory matching ForecastPort's createForecastPort convention. */
export function createSvmForecastPort() {
  return { getForecast, refitAll, aggregateWeeklyDemand, getArtifact };
}

/** Model-info payload for the /api/replenishment/model-info endpoint. */
export function modelInfo() {
  const a = getArtifact();
  const kinds = {};
  for (const [sku, entry] of Object.entries(a.skus || {})) kinds[sku] = entry.kind || 'svr';
  return {
    model: a.model,
    version: a.version,
    horizon: a.horizon,
    featureNames: a.featureNames,
    nFeatures: a.nFeatures,
    metrics: a.metrics,
    trainedAt: a.trainedAt,
    data: a.data,
    split: a.split,
    skuKinds: kinds,
  };
}