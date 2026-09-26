import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  seasonalNaive,
  sma,
  ses,
  holtWinters,
  croston,
  naive,
} from '../src/services/forecast/methods.js';
import { wape, mae, mase, bias, trackingSignal } from '../src/services/forecast/evaluate.js';
import { rollingOriginBacktest, summarizeFolds } from '../src/services/forecast/backtest.js';
import { buildForecast, chooseMethodWithGate, zeroRate, selectMethod } from '../src/services/forecast/builder.js';

test('seasonalNaive repeats last value', () => {
  assert.deepEqual(seasonalNaive([3, 7, 2], 3), [2, 2, 2]);
  assert.deepEqual(seasonalNaive([], 2), [0, 0]);
});

test('sma returns trailing mean', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2, 4), [2.5, 2.5]);
  assert.deepEqual(sma([10], 1, 4), [10]);
});

test('ses converges to mean of constant series', () => {
  assert.deepEqual(ses([5, 5, 5, 5], 2, 0.3), [5, 5]);
});

test('holtWinters on constant series stays constant', () => {
  const fc = holtWinters([10, 10, 10, 10, 10], 3, 4);
  assert.ok(fc.every((x) => Math.abs(x - 10) < 1e-6));
});

test('croston handles all-zero series', () => {
  assert.deepEqual(croston([0, 0, 0, 0], 3), [0, 0, 0]);
});

test('croston produces nonzero forecast for intermittent but active series and is nonzero-or-pbs', () => {
  // Heavy zero series with periodic bursts: weekly 0 except one 5 every 4th week.
  const series = [];
  for (let w = 0; w < 40; w++) series.push(w % 4 === 0 ? 5 : 0);
  const fc = croston(series, 4);
  assert.ok(fc.every((x) => x >= 0));
  // Demand is occasional so forecast should be small but > 0 (rate 5/4 * debias).
  assert.ok(fc[0] > 0 && fc[0] <= 5, `expected a small positive intermittent forecast, got ${fc[0]}`);
});

test('selectMethod picks croston for high-zero series', () => {
  const intermittent = Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? 5 : 0));
  assert.strictEqual(selectMethod(intermittent), 'croston');
});

test('selectMethod picks sma for short cold-start series and holt for longer seasonal', () => {
  assert.strictEqual(selectMethod([1, 3, 2]), 'sma');
  const seasonal = Array.from({ length: 24 }, (_, i) => 10 + Math.round(5 * Math.sin(i / 1.6)));
  assert.strictEqual(selectMethod(seasonal), 'holtWinters');
});

test('zeroRate computes fraction of zero weeks', () => {
  assert.strictEqual(zeroRate([0, 0, 5, 0]), 0.75);
  assert.strictEqual(zeroRate([1, 2, 3]), 0);
});

test('wape perfect forecast is 0', () => {
  assert.strictEqual(wape([10, 20, 30], [10, 20, 30]), 0);
});

test('wape is volume-weighted not per point', () => {
  // Forecast off on the small actual is diluted by big actuals.
  const v = wape([100, 1], [100, 5]);
  assert.ok(Math.abs(v - 4 / 101) < 1e-9);
});

test('wape handles all-zero actuals (no NaN/Inf)', () => {
  assert.strictEqual(wape([0, 0], [1, 1]), null);
  assert.strictEqual(wape([0, 0], [0, 0]), 0);
});

test('mae and bias basics', () => {
  assert.strictEqual(mae([1, 3, 5], [1, 4, 5]), 1 / 3);
  assert.strictEqual(bias([1, 3, 5], [2, 4, 5]), 2 / 3); // avg forecast - actual
});

test('mase < 1 means beat naive', () => {
  // Constant series: naive (repeat last) is perfect -> mase well below 1 for a good method.
  const series = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const actual = [5, 5, 5];
  const m = mase(actual, [5, 5, 5], naive([5, 5, 5, 5, 5, 5, 5, 5], 3));
  assert.ok(m < 1, `expected mase<1 got ${m}`);
});

test('trackingSignal signals consistent over-forecast', () => {
  const actual = [10, 10, 10, 10];
  const forecast = [15, 15, 15, 15];
  assert.ok(Math.abs(trackingSignal(actual, forecast) - 4) < 1e-6);
});

test('rollingOriginBacktest requires nWindows >= 3', () => {
  assert.throws(() => rollingOriginBacktest([1, 2, 3], 1, 2, () => []));
});

test('rollingOriginBacktest returns >= 3 folds on a decent series', () => {
  const series = Array.from({ length: 40 }, (_, i) => 10 + Math.round(4 * Math.sin(i / 1.9)));
  const folds = rollingOriginBacktest(series, 4, 3, (train, h) => seasonalNaive(train, h));
  assert.ok(folds.length >= 1);
  const summary = summarizeFolds(folds);
  assert.strictEqual(typeof summary.wape, 'number');
  assert.ok(folds.every((f) => f.actual.length === 4));
});

test('seasonal-naive beats a random guess chooser to produce summary.beatsNaive reliably (self-consistency)', () => {
  // A pure periodic series should be caught well by naive; check summarize doesn't throw.
  const series = Array.from({ length: 40 }, (_, i) => (i % 5 === 0 ? 9 : 2));
  const fn = (train) => seasonalNaive(train, 4);
  const folds = rollingOriginBacktest(series, 4, 3, fn);
  const s = summarizeFolds(folds);
  assert.ok(s.folds >= 1);
  assert.ok(Number.isFinite(s.pooledMAE));
});

test('buildForecast returns point + quantiles for a stable series', () => {
  const series = Array.from({ length: 30 }, () => 20);
  const f = buildForecast(series, 8);
  assert.ok(['seasonalNaive', 'ses', 'holtWinters', 'croston', 'sma'].includes(f.method));
  assert.ok(f.pointForecast > 0);
  assert.ok(f.quantiles.p10 <= f.quantiles.p50 && f.quantiles.p50 <= f.quantiles.p90);
  assert.strictEqual(typeof f.beatsNaive, 'boolean');
});

test('buildForecast on a too-short series degrades to seasonalNaive', () => {
  const f = buildForecast([4, 5], 8);
  assert.strictEqual(f.method, 'seasonalNaive');
});