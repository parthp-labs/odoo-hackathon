// Forecast accuracy metrics used by the replenishment feature.
// All operate on plain arrays of numbers and are network-free.
// We deliberately avoid MAPE (blows up on zeros); use WAPE + bias + MASE.

/**
 * Weighted Absolute Percentage Error (WAPE / WMAPE).
 * = sum(|actual - forecast|) / sum(actual). Robust to zeros and mixed SKU sizes.
 * Returns 0 when actual sum is 0 and forecast is 0; Infinity-safe: returns null
 * when there is no demand to scale by (caller decides).
 */
export function wape(actual, forecast) {
  const denom = actual.reduce((a, b) => a + b, 0);
  const num = actual.reduce((s, a, i) => s + Math.abs(a - (forecast[i] ?? 0)), 0);
  if (denom === 0) {
    return num === 0 ? 0 : null; // null = undefined basis
  }
  return num / denom;
}

/** Mean Absolute Error in natural units. */
export function mae(actual, forecast) {
  if (actual.length === 0) return 0;
  return actual.reduce((s, a, i) => s + Math.abs(a - (forecast[i] ?? 0)), 0) / actual.length;
}

/**
 * Mean Absolute Percentage Error (MAPE) — provided but NOT recommended for
 * intermittent series (grows to infinity near zero actuals).
 */
export function mape(actual, forecast) {
  const valid = actual
    .map((a, i) => ({ a, f: forecast[i] ?? 0 }))
    .filter(({ a }) => a !== 0);
  if (valid.length === 0) return null;
  return valid.reduce((s, { a, f }) => s + Math.abs(a - f) / Math.abs(a), 0) / valid.length;
}

/**
 * MASE = MAE of the method / MAE of a naive (seasonal-naive) baseline.
 * MASE < 1 means the method beats the naive baseline — that is the pass gate.
 */
export function mase(actual, forecast, naiveForecast) {
  const m = mae(actual, forecast);
  const n = mae(actual, naiveForecast);
  if (n === 0) return null;
  return m / n;
}

/** Mean signed error (bias). Positive = over-forecast on average. */
export function bias(actual, forecast) {
  if (actual.length === 0) return 0;
  return actual.reduce((s, a, i) => s + (forecast[i] ?? 0) - a, 0) / actual.length;
}

/**
 * Tracking signal = cumulative error / MAD. Alert when |ts| exceeds ~4.
 */
export function trackingSignal(actual, forecast) {
  if (actual.length === 0) return 0;
  let cumErr = 0;
  let mad = 0;
  for (let i = 0; i < actual.length; i++) {
    const e = (forecast[i] ?? 0) - actual[i];
    cumErr += e;
    mad += Math.abs(e);
  }
  mad = mad / actual.length;
  return mad === 0 ? 0 : cumErr / mad;
}