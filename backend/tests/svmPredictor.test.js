// Hermetic tests for the pure-Node SVR predictor (no Mongo, no network).
// Validates artifact loading, RBF SVR math, JS<->Python parity against
// Python-generated fixtures, and the recursive multi-step forecast.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  loadSvmArtifact,
  svrPredictRaw,
  buildSvmFeatures,
  forecastSkuForecast,
} from '../src/services/svm/svrPredictor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'svm_parity.json');
const KNOWN_SKUS = ['BOLT-HEX-M8-P50', 'ALUM-25X25-BAR', 'CHAIR-ERGO-MESH', 'HELM-SAFE-YEL'];

test('loadSvmArtifact returns artifact with 17 featureNames and known SKUs', () => {
  const model = loadSvmArtifact();
  assert.equal(model.featureNames.length, 17);
  assert.equal(model.nFeatures, 17);
  for (const sku of KNOWN_SKUS) {
    assert.ok(model.skus[sku], `expected skus.${sku} in artifact`);
  }
});

test('svrPredictRaw on a fixed 17-vector returns a finite number', () => {
  const model = loadSvmArtifact();
  const sku = 'BOLT-HEX-M8-P50';
  const entry = model.skus[sku];
  assert.equal(entry.kind, 'svr');
  const x = buildSvmFeatures(Array(17).fill(1), 'A', 30, 17);
  assert.equal(x.length, 17);
  const pred = svrPredictRaw(entry, x);
  assert.equal(typeof pred, 'number');
  assert.ok(Number.isFinite(pred), `prediction must be finite, got ${pred}`);
});

test('JS <-> Python parity within tolerance for every fixture row', () => {
  const model = loadSvmArtifact();
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  assert.equal(fixture.rows.length, 3);

  for (const row of fixture.rows) {
    const entry = model.skus[row.sku];
    assert.ok(entry, `fixture sku ${row.sku} missing from artifact`);
    const x = buildSvmFeatures(row.series, row.profile, row.base, row.labelWeek);
    assert.equal(x.length, 17);
    const jsPred = svrPredictRaw(entry, x);
    const absErr = Math.abs(jsPred - row.expectedPred);
    const ok = absErr <= 1e-4 || absErr <= 1e-6 * Math.max(1, Math.abs(row.expectedPred));
    assert.ok(
      ok,
      `parity failed for ${row.sku} wk${row.labelWeek}: js=${jsPred} py=${row.expectedPred} absErr=${absErr}`,
    );
  }
});

test('forecastSkuForecast returns horizon clamped non-negative predictions', () => {
  const model = loadSvmArtifact();
  const sku = 'BOLT-HEX-M8-P50';
  const meta = model.skuMeta[sku];
  const series = Array.from({ length: 20 }, (_, i) => meta.baseWeeklyDemand + ((i * 7) % 5) - 2);
  const horizon = 8;
  const preds = forecastSkuForecast(
    model,
    { sku, profile: meta.profile, base: meta.baseWeeklyDemand },
    series,
    horizon,
  );
  assert.equal(preds.length, horizon);
  for (const p of preds) {
    assert.equal(typeof p, 'number');
    assert.ok(Number.isFinite(p));
    assert.ok(p >= 0, `predictions must be clamped >= 0, got ${p}`);
  }
});
