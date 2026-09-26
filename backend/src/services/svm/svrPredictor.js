// Pure-Node inference for the frozen per-SKU StockSense demand model
// (backend/src/ml/artifacts/svm_model.json). The model artifact was produced
// by an offline training step; this module only loads and runs it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARTIFACT_PATH = path.resolve(__dirname, '../../ml/artifacts/svm_model.json');

// sorted(PROFILES) layout used by the frozen model => ['A','B','C','D']
const PROFILE_ORDER = ['A', 'B', 'C', 'D'];

/**
 * Load the frozen JSON artifact.
 * @param {string} [filePath] defaults to src/ml/artifacts/svm_model.json
 * @returns {object} parsed artifact
 */
export function loadSvmArtifact(filePath = DEFAULT_ARTIFACT_PATH) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * RBF SVR decision function on standardized features for a single 17-dim
 * sample:
 *   sx  = (x - mean) / scale
 *   out = sum_i dualCoef[i] * exp(-gamma * ||sx - supportVectors[i]||^2) + intercept
 * @param {object} m frozen svr entry ({ scaler, svr }) or object embedding one under `size`
 * @param {number[]} x raw (unstandardized) feature vector, length nFeatures
 * @returns {number} raw (unclamped) prediction
 */
export function svrPredictRaw(m, x) {
  const { mean, scale } = m.scaler;
  const { support_vectors: sv, dual_coef: dc, gamma, intercept } = m.svr;
  if (!sv || sv.length === 0) return Number(intercept);

  const d = x.length;
  const sx = new Array(d);
  for (let j = 0; j < d; j++) sx[j] = (x[j] - mean[j]) / scale[j];

  let out = intercept;
  for (let i = 0; i < sv.length; i++) {
    const svi = sv[i];
    let sq = 0;
    for (let j = 0; j < d; j++) {
      const diff = sx[j] - svi[j];
      sq += diff * diff;
    }
    out += dc[i] * Math.exp(-gamma * sq);
  }
  return out;
}

/**
 * Build the 17-dim feature vector for predicting series[labelWeek] from
 * series[0 .. labelWeek-1] (feature layout matches the frozen model).
 *
 * Cold start: weeks earlier than the start of `series` (or missing because
 * `series` is shorter than t + 1) are treated as 0 and indices clamp to >= 0.
 *
 * @param {number[]} series weekly demand history (index = week)
 * @param {string} profile one of 'A' | 'B' | 'C' | 'D'
 * @param {number} base baseWeeklyDemand (from skuMeta)
 * @param {number} labelWeek week to predict (>= 1)
 * @returns {number[]} 17 features in artifact.featureNames order
 */
export function buildSvmFeatures(series, profile, base, labelWeek) {
  const t = labelWeek - 1;
  const at = (i) => (i >= 0 && i < series.length ? series[i] : 0);

  const lag1 = at(t - 3);
  const lag2 = at(t - 2);
  const lag3 = at(t - 1);
  const lag4 = at(t);
  const sum4 = lag1 + lag2 + lag3 + lag4;
  const mean4 = sum4 / 4.0;
  const zeroCount4 = (lag1 === 0 ? 1 : 0) + (lag2 === 0 ? 1 : 0) + (lag3 === 0 ? 1 : 0) + (lag4 === 0 ? 1 : 0);

  const woySin = Math.sin((2 * Math.PI * t) / 52.0);
  const woyCos = Math.cos((2 * Math.PI * t) / 52.0);
  const trend = t / 60.0;

  // hist = series[:t+1]; missing earlier weeks assumed 0 (contribute length, not nonzero count)
  const histLen = t + 1;
  let nonzero = 0;
  for (let i = 0; i < histLen && i < series.length; i++) {
    if (series[i] > 0) nonzero++;
  }
  const historyLength = nonzero / Math.max(1, histLen);
  const nonzeroRatio = historyLength; // matches frozen model feature layout

  const oneHot = PROFILE_ORDER.map((p) => (profile === p ? 1.0 : 0.0));

  return [
    lag1, lag2, lag3, lag4,
    sum4, mean4, zeroCount4,
    woySin, woyCos, trend,
    historyLength, nonzeroRatio,
    ...oneHot,
    Number(base),
  ];
}

/**
 * Multi-step recursive forecast for one SKU (a 1-week-ahead model rolled
 * forward: each prediction is appended to the history and fed into the next
 * step), or the trailing-mean recipe for baseline/guard_base entries —
 * matching the model's intended behavior.
 *
 * @param {object} model loaded artifact
 * @param {{sku?: string, profile: string, base: number, entry?: object}} opts
 *   sku resolves the frozen entry from model.skus; entry may be passed directly.
 *   profile/base from skuMeta.
 * @param {number[]} series demand history (index = week)
 * @param {number} [horizon=8]
 * @returns {number[]} per-week clamped (>= 0) predictions, length = horizon
 */
export function forecastSkuForecast(model, opts, series, horizon = 8) {
  const { sku, profile, base } = opts;
  const entry = opts.entry || (sku && model?.skus?.[sku]) || null;

  // baseline / guard_base / unknown kind -> trailing mean of last `window` weeks
  if (!entry || entry.kind === 'baseline' || entry.kind === 'guard_base' || entry.kind === 'croston') {
    const window = Number.isFinite(entry?.window) ? entry.window : 8;
    const tail = series.slice(-window);
    const mean = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0.0;
    const clamped = Math.max(0, mean);
    return Array.from({ length: horizon }, () => clamped);
  }

  if (entry.kind !== 'svr') {
    throw new Error(`forecastSkuForecast: unsupported frozen kind "${entry.kind}"`);
  }

  const hist = series.slice();
  const preds = [];
  for (let k = 0; k < horizon; k++) {
    const labelWeek = hist.length; // predict week index == current history length
    const x = buildSvmFeatures(hist, profile, base, labelWeek);
    const p = Math.max(0, svrPredictRaw(entry, x));
    preds.push(p);
    hist.push(p);
  }
  return preds;
}
