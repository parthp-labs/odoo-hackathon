// Pure JavaScript demand-forecasting methods for the replenishment feature.
// All functions are deterministic, network-free and operate on a plain number[]
// of weekly demand observations (0 allowed for intermittent SKUs).
// Methods: seasonalNaive, sma, ses, holtWinters, croston (SBA-debiased), naive.

/** Seasonal naive: repeat last week's value for the next week(s). */
export function seasonalNaive(series, horizon) {
  const last = series.length ? series[series.length - 1] : 0;
  return Array(horizon).fill(last);
}

/** Simple moving average over window w. */
export function sma(series, horizon, w = 4) {
  if (series.length === 0) return Array(horizon).fill(0);
  const window = Math.min(w, series.length);
  const recent = series.slice(-window);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Array(horizon).fill(mean);
}

/** Simple exponential smoothing with alpha tuning (default 0.3). */
export function ses(series, horizon, alpha = 0.3) {
  if (series.length === 0) return Array(horizon).fill(0);
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return Array(horizon).fill(level);
}

/**
 * Holt's linear (additive trend) exponential smoothing.
 * Holt-Winters with weekly season (period default 4) and additive trend.
 * Returns an array of `horizon` point forecasts.
 */
export function holtWinters(series, horizon, period = 4, alpha = 0.3, beta = 0.1, gamma = 0.1) {
  if (series.length === 0) return Array(horizon).fill(0);
  // Fall back to SES when too few observations to fit a seasonal model.
  if (series.length < 2 * period) return ses(series, horizon, alpha);

  const n = series.length;
  let level = series[0];
  let trend = 0;
  const season = new Array(period).fill(0);
  if (n > 0) season[0] = series[0];

  for (let i = 0; i < n; i++) {
    const lastLevel = level;
    const s = season[i % period];
    const base = s === 0 ? series[i] : series[i] - s;
    level = alpha * base + (1 - alpha) * (lastLevel + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    season[i % period] = gamma * (series[i] - level) + (1 - gamma) * s;
  }

  const out = [];
  for (let h = 1; h <= horizon; h++) {
    out.push(level + h * trend + season[(n - 1 + h) % period]);
  }
  return out.map((v) => Math.max(0, v));
}

/**
 * Croston's method with Syntetos-Boylan Approximation (SBA) bias correction,
 * for intermittent (slow-mover) demand with many zero weeks.
 * Splits the series into inter-arrival gaps and non-zero demand sizes.
 */
export function croston(series, horizon, alpha = 0.3) {
  if (series.length === 0) return Array(horizon).fill(0);

  const nonZero = series.filter((x) => x > 0);
  // If everything is zero or near-constant, SBA reduces to a flat forecast.
  if (nonZero.length === 0) return Array(horizon).fill(0);

  let demandForecast = nonZero[0];
  let intervalForecast = 1;
  let gap = 0;
  let sizeAccum = 0;

  // Simple Croston-style fitting over the series.
  let pendingAvg = 0;
  let seenNonZero = 0;
  const sizes = [];
  const interArrivals = [];
  let zerosSince = 0;
  for (const x of series) {
    if (x > 0) {
      sizes.push(x);
      zerosSince += 1; // gap from previous non-zero point
      if (seenNonZero > 0) interArrivals.push(zerosSince);
      zerosSince = 0;
      seenNonZero++;
    } else {
      zerosSince += 1;
    }
  }

  if (sizes.length === 1) {
    // Only one observation; SBA not applicable. Return that size every horizon.
    return Array(horizon).fill(sizes[0]);
  }

  let d = sizes[0];
  let p = interArrivals.length ? interArrivals[0] : 1;
  for (let i = 1; i < sizes.length; i++) {
    d = alpha * sizes[i] + (1 - alpha) * d;
    const pp = i - 1 < interArrivals.length ? interArrivals[i - 1] : p;
    p = alpha * pp + (1 - alpha) * p;
  }

  // SBA bias correction factor = (1 - alpha/2).
  const debias = 1 - alpha / 2;
  const rate = (p > 0 ? d / p : 0) * debias;
  return Array(horizon).fill(Math.max(0, rate));
}

/** Plain naive: repeat last value (used as the MASE comparator baseline). */
export function naive(series, horizon) {
  return seasonalNaive(series, horizon);
}

export const METHODS = {
  seasonalNaive,
  sma,
  ses,
  holtWinters,
  croston,
  naive,
};