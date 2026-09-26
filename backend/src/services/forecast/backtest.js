// Rolling-origin (walk-forward) backtest for forecast methods.
// Splits a demand series into training windows and evaluates each method's
// forecasts against held-out origins using a rolling, expanding window.

import { seasonalNaive } from './methods.js';
import { wape, bias } from './evaluate.js';

/**
 * Rolling-origin cross-validation.
 * @param {number[]} series Full demand series (time-ordered, oldest first).
 * @param {number} horizon Forecast horizon (weeks) per fold.
 * @param {number} nWindows Number of expanding windows (>= 3 recommended).
 * @param {(train: number[]) => number[]} forecastFn Returns point forecast for `horizon` weeks from a train prefix.
 * @returns {Array<{start:number, train:number[], actual:number[], forecast:number[], naiveForecast:number[], wape:number|null, bias:number, mase:number|null}>}
 */
export function rollingOriginBacktest(series, horizon, nWindows = 3, forecastFn) {
  if (nWindows < 3) throw new Error('nWindows must be >= 3');
  const folds = [];
  const minTrain = Math.max(2, horizon * 2);
  const avail = series.length - horizon;
  if (avail < minTrain) return folds;

  // Growing train size across folds.
  const step = Math.max(1, Math.floor((avail - minTrain) / nWindows));
  for (let k = 1; k <= nWindows; k++) {
    const trainLen = Math.min(avail, minTrain + (k - 1) * step);
    const train = series.slice(0, trainLen);
    const actual = series.slice(trainLen, trainLen + horizon);
    if (actual.length === 0) break;
    const forecast = forecastFn(train, horizon);
    const naiveForecast = seasonalNaive(train, horizon);
    const m = actual.reduce((s, a, i) => s + Math.abs(a - (forecast[i] ?? 0)), 0) / actual.length;
    const n = actual.reduce((s, a, i) => s + Math.abs(a - (naiveForecast[i] ?? 0)), 0) / actual.length;
    folds.push({
      start: trainLen,
      train,
      actual,
      forecast,
      naiveForecast,
      wape: wape(actual, forecast),
      bias: bias(actual, forecast),
      mase: n === 0 ? null : m / n,
    });
  }
  return folds;
}

/**
 * Pool metrics across folds (flatten actual + forecast, then compute WAPE/bias/MASE
 * against the pooled naive baseline). This is the aggregate "did we beat naive?" gate.
 */
export function summarizeFolds(folds) {
  const allActual = [];
  const allForecast = [];
  const allNaive = [];
  for (const f of folds) {
    allActual.push(...f.actual);
    allForecast.push(...f.forecast);
    allNaive.push(...f.naiveForecast);
  }
  const sumAbs = (a, f) => a.reduce((s, x, i) => s + Math.abs(x - (f[i] ?? 0)), 0);
  const pooledMAE = sumAbs(allActual, allForecast) / (allActual.length || 1);
  const naiveMAE = sumAbs(allActual, allNaive) / (allActual.length || 1);
  return {
    folds: folds.length,
    wape: wape(allActual, allForecast),
    bias: bias(allActual, allForecast),
    naiveMAE,
    pooledMAE,
    mase: naiveMAE === 0 ? null : pooledMAE / naiveMAE,
    beatsNaive: naiveMAE > 0 ? pooledMAE < naiveMAE : false,
  };
}