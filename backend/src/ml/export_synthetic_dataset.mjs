// Emit the exact deterministic weekly-demand dataset (one row per (sku, week))
// by calling the same pure functions used to seed Mongo, so the SVM trains on
// parity-identical data. Writes synthetic_series.json for the Python trainer.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_WEEKLY_DEMAND,
  WEEKS,
  HISTORY_SEED,
  assignProfile,
  generateWeeklySeries,
} from '../scripts/generateHistory.js';

const DEFAULT_BASE_WEEKLY_DEMAND = 10; // mirrors generateHistory.js (not exported)

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'artifacts');
mkdirSync(outDir, { recursive: true });

const skus = Object.keys(BASE_WEEKLY_DEMAND);
const rows = [];
const skuMeta = {};

skus.forEach((sku, idx) => {
  const profile = assignProfile(idx);
  skuMeta[sku] = { profile, baseWeeklyDemand: BASE_WEEKLY_DEMAND[sku] ?? DEFAULT_BASE_WEEKLY_DEMAND };
  const series = generateWeeklySeries(profile, WEEKS, {
    seed: HISTORY_SEED,
    sku,
    baseWeeklyDemand: BASE_WEEKLY_DEMAND[sku] ?? DEFAULT_BASE_WEEKLY_DEMAND,
  });
  series.forEach((qty, w) => {
    rows.push({ sku, week: w, profile, qty });
  });
});

const out = {
  model: 'svr-demand-forecast',
  generatedBy: 'export_synthetic_dataset.mjs',
  seed: HISTORY_SEED,
  weeks: WEEKS,
  skuCount: skus.length,
  rowCount: rows.length,
  skuMeta,
  rows,
};

const path = join(outDir, 'synthetic_series.json');
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(`Wrote ${path}: ${skus.length} skus, ${rows.length} rows, ${WEEKS} weeks, seed=${HISTORY_SEED}`);