// Per-SKU model selection + point/quantile forecast builder.
// Selects a forecasting method by demand profile, then enforces the gate:
// a method only ships if it beats the seasonal-naive baseline on a rolling backtest
// (MASE < 1) — otherwise the SKU falls back to seasonal-naive.

import { METHODS } from './methods.js';
import { rollingOriginBacktest, summarizeFolds } from './backtest.js';

const DEFAULT_HORIZON = 8;
const INTERMITTENT_ZERO_RATE = 0.33; // >33% zero weeks -> treat as intermittent

/** Intermittency ratio: fraction of weeks with zero demand. */
export function zeroRate(series) {
  if (series.length === 0) return 0;
  return series.filter((x) => x === 0).length / series.length;
}

/**
 * Choose the candidate method for a series (before the gate).
 * - intermittent (high zero rate or zero variance) -> croston
 * - short history (cold start) -> trailing average (sma)
 * - otherwise -> holtWinters (seasonal), else ses
 */
export function selectMethod(series) {
  if (series.length === 0) return 'ses';
  if (zeroRate(series) >= INTERMITTENT_ZERO_RATE || new Set(series).size === 1) {
    return 'croston';
  }
  if (series.length < 8) return 'sma'; // cold-start: too little for seasonality
  return 'holtWinters';
}

/**
 * Choose the method to actually ship, using the MASE<1 gate vs seasonal-naive.
 * Returns { method, beatsNaive, backtest }. If the candidate fails the gate,
 * falls back to 'seasonalNaive'.
 */
export function chooseMethodWithGate(series, horizon = DEFAULT_HORIZON, nWindows = 3) {
  if (series.length < horizon + 2) {
    return { method: 'seasonalNaive', beatsNaive: false, backtest: [] };
  }
  const candidate = selectMethod(series);
  const fn = (train, h) => METHODS[candidate](train, h);
  const folds = rollingOriginBacktest(series, horizon, nWindows, fn);
  const summary = summarizeFolds(folds);
  const beatsNaive = summary.folds > 0 ? summary.beatsNaive : false;
  return {
    method: beatsNaive ? candidate : 'seasonalNaive',
    beatsNaive,
    backtest: summary,
  };
}

/**
 * Build a full forecast for one SKU.
 * @param {number[]} series Weekly demand series.
 * @param {number} horizonWeeks How many weeks ahead to forecast.
 * @returns {{method:string, pointForecast:number, seriesForecast:number[], quantiles:Object, beatsNaive:boolean, backtest:Object}}
 */
export function buildForecast(series, horizonWeeks = DEFAULT_HORIZON) {
  const { method, beatsNaive, backtest } = chooseMethodWithGate(series, horizonWeeks);
  const seriesForecast = METHODS[method](series, horizonWeeks);
  const horizon = Math.max(1, Math.min(horizonWeeks, seriesForecast.length || 1));
  const pointForecast = seriesForecast.slice(0, horizon).reduce((a, b) => a + b, 0);
  // Rough quantile spread around the point forecast for planning ranges.
  const sigma = estimateScatter(series);
  const quantiles = {
    p10: Math.max(0, pointForecast - 1.28 * sigma),
    p50: pointForecast,
    p90: pointForecast + 1.28 * sigma,
  };
  return {
    method,
    pointForecast: round2(pointForecast),
    seriesForecast,
    quantiles: {
      p10: round2(quantiles.p10),
      p50: round2(quantiles.p50),
      p90: round2(quantiles.p90),
    },
    beatsNaive,
    backtest,
  };
}

/** Estimate demand scatter (stdev of non-zero weekly demand) for quantile widths. */
function estimateScatter(series) {
  const nz = series.filter((x) => x > 0);
  if (nz.length === 0) return 0;
  const mean = nz.reduce((a, b) => a + b, 0) / nz.length;
  const varSum = nz.reduce((s, x) => s + (x - mean) * (x - mean), 0);
  return Math.sqrt(varSum / nz.length);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}