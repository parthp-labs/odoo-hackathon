import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  runSvmForecast,
  modelInfo,
  getArtifact,
} from '../src/services/svm/svmForecastPort.js';

// Hermetic tests — no Mongo. Exercises the frozen-model path end-to-end via the
// pure functions (runSvmForecast + modelInfo). (DB persistence is covered by the
// API route tests; these prove the SVM is the served engine's source of truth.)

describe('SvmForecastPort (hermetic)', () => {
  let artifact;
  before(() => {
    artifact = getArtifact();
  });

  it('loads the frozen artifact + model-info exposes trained metrics', () => {
    assert.ok(artifact?.featureNames?.length === 17);
    const info = modelInfo();
    assert.strictEqual(info.model, 'per-sku-svr-forecast');
    assert.strictEqual(info.nFeatures, 17);
    assert.ok(info.metrics?.wape > 0 && info.metrics?.wape < 0.5); // 27.7% frozen
    assert.ok(info.skuKinds['BOLT-HEX-M8-P50'], 'svr');
  });

  it('runSvmForecast returns a positive horizon-length SVR forecast for a seeded svr SKU', () => {
    // BOLT (profile A) is a frozen kind:svr SKU. Series ~ base 30 stable.
    const series = Array.from({ length: 40 }, (_, i) => 30 + Math.round(Math.sin(i) * 2));
    const f = runSvmForecast('BOLT-HEX-M8-P50', series, { horizonWeeks: 8 });
    assert.strictEqual(f.horizonWeeks, 8);
    assert.strictEqual(f.weekly.length, 8);
    assert.ok(f.pointForecast > 0);
    assert.ok(f.weekly.every((v) => v >= 0));
    assert.strictEqual(f.kind, 'svr');
  });

  it('runSvmForecast uses trailing-mean fallback for guard_base/baseline SKUs', () => {
    // STEEL (D) is frozen kind guard_base; FRAME is baseline.
    const series = Array.from({ length: 20 }, () => 5);
    const g = runSvmForecast('STEEL-12MM-ROD', series, { horizonWeeks: 8 });
    assert.strictEqual(g.kind, 'guard_base');
    // trailing mean of the (last 8 = 5) repeated 8x => pointForecast 40
    assert.ok(Math.abs(g.pointForecast - 40) < 1e-9);
  });

  it('unknown SKUs degrade to a baseline trailing-mean forecast (non-negative)', () => {
    const series = [10, 12, 11, 13, 12, 14, 13, 15];
    const f = runSvmForecast('SOME-NEW-SKU', series, { horizonWeeks: 8 });
    assert.strictEqual(f.kind, 'baseline');
    assert.ok(f.pointForecast > 0);
    assert.ok(f.weekly.every((v) => v >= 0));
  });
});