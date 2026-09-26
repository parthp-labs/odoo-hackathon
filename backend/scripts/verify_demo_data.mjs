#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Ad-hoc end-to-end verification of the StockSense demo dataset.
//
// Deliberately does NOT reuse the test suite: this checks the LIVE Atlas DB and
// the LIVE HTTP API, so it proves the demo a reviewer would actually see — not
// just that the pure generators are self-consistent.
//
// Usage:  node scripts/verify_demo_data.mjs            (server must be on :5000)
//         BASE=http://host:port node scripts/verify_demo_data.mjs
// Exits non-zero on the first failed check.
// ---------------------------------------------------------------------------
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BASE = process.env.BASE || 'http://localhost:5000/api';
const EMAIL = 'admin@stocksense.com';
const PASSWORD = 'Password123!';

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const near = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;

async function main() {
  console.log(`\n=== StockSense demo data verification (${BASE}) ===\n`);

  // ---- 1. Database volumes -------------------------------------------
  console.log('[1] Database contents');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const count = (c) => db.collection(c).countDocuments();

  // Assert on the rows the SEEDER owns, not on global counts. The test suite
  // creates throwaway warehouses/products/users (WH_RACK_*, BRG-*,
  // rack_inspector_*@example.com) and several suites do not clean up after
  // themselves, so a global count drifts every time tests run. Counting the
  // seeded prefixes keeps this check meaningful on a dirty demo DB.
  const SEED = {
    warehouses: { code: { $in: ['WH1', 'WH2', 'WH3', 'WH4'] } },
    locations: { code: /^(WH[1-4]\/|PARTNER\/|VIRTUAL\/)/ },
    users: { email: /@stocksense\.com$/ },
    products: {
      sku: /^(STEEL|ALUM|BOLT|CHAIR|FRAME|PASTE|HELM|TUBE|ANGLE|WIRE|CABLE|SWITCH|LIGHT|CONDUIT|CARTON|WRAP|TAPE|PALLET|LABEL|PPE|SAFETY|TABLE|SHELF|BIN|DOLLY|MAT|PACK|ADHESIVE|RESIN|ABRASIVE|SOLDER|LUBE)/,
    },
    stockoperations: { reference: /^(REC|DEL|INT|ADJ)\/2026\// },
  };

  const volumes = {
    users: await db.collection('users').countDocuments(SEED.users),
    warehouses: await db.collection('warehouses').countDocuments(SEED.warehouses),
    locations: await db.collection('locations').countDocuments(SEED.locations),
    productcategories: await count('productcategories'),
    products: await db.collection('products').countDocuments(SEED.products),
    stockquants: await count('stockquants'),
    stockoperations: await db.collection('stockoperations').countDocuments(SEED.stockoperations),
    stockmoves: await count('stockmoves'),
    vendors: await count('vendors'),
    vendorprices: await count('vendorprices'),
  };
  console.log('   seeded rows:', JSON.stringify(volumes));

  check('5 demo users', volumes.users === 5, `${volumes.users}`);
  check('4 warehouses', volumes.warehouses === 4, `${volumes.warehouses}`);
  check('16 locations (12 internal + 4 virtual)', volumes.locations === 16, `${volumes.locations}`);
  check('8 categories', volumes.productcategories === 8, `${volumes.productcategories}`);
  check('43 products', volumes.products === 43, `${volumes.products}`);
  check('120 vendors', volumes.vendors === 120, `${volumes.vendors}`);
  check('>=258 vendor prices (43 SKUs x 6)', volumes.vendorprices >= 258, `${volumes.vendorprices}`);
  check('>=250 operations over 90 days', volumes.stockoperations >= 250, `${volumes.stockoperations}`);
  check('>=1900 ledger moves', volumes.stockmoves >= 1900, `${volumes.stockmoves}`);

  // ---- 2. Referential integrity --------------------------------------
  console.log('\n[2] Referential integrity');
  const orphanQuants = await db.collection('stockquants').aggregate([
    { $lookup: { from: 'products', localField: 'product', foreignField: '_id', as: 'p' } },
    { $match: { p: { $size: 0 } } },
    { $count: 'n' },
  ]).toArray();
  check('no stock quants without a product', (orphanQuants[0]?.n || 0) === 0, `${orphanQuants[0]?.n || 0} orphans`);

  const orphanPrices = await db.collection('vendorprices').aggregate([
    { $lookup: { from: 'vendors', localField: 'vendor', foreignField: '_id', as: 'v' } },
    { $match: { v: { $size: 0 } } },
    { $count: 'n' },
  ]).toArray();
  check('no vendor prices without a vendor', (orphanPrices[0]?.n || 0) === 0, `${orphanPrices[0]?.n || 0} orphans`);

  const dupRefs = await db.collection('stockoperations').aggregate([
    { $group: { _id: '$reference', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: 'n' },
  ]).toArray();
  check('no duplicate operation references', (dupRefs[0]?.n || 0) === 0, `${dupRefs[0]?.n || 0} dupes`);

  // Ledger reconciliation: per operation, moved qty == summed done lines.
  const reconcile = await db.collection('stockoperations').aggregate([
    { $match: { status: 'done' } },
    { $project: { reference: 1, want: { $sum: '$lines.quantity_done' } } },
    { $lookup: { from: 'stockmoves', localField: 'reference', foreignField: 'reference', as: 'mv' } },
    { $project: { reference: 1, want: 1, got: { $sum: '$mv.quantity' } } },
    { $match: { $expr: { $ne: ['$want', '$got'] } } },
    { $count: 'n' },
  ]).toArray();
  check('every done operation reconciles with its ledger moves',
    (reconcile[0]?.n || 0) === 0, `${reconcile[0]?.n || 0} mismatched`);

  // ---- 3. Vendor price coverage --------------------------------------
  console.log('\n[3] Vendor price coverage per product');
  const coverage = await db.collection('vendorprices').aggregate([
    { $group: { _id: '$product', n: { $sum: 1 } } },
  ]).toArray();
  const pricedProducts = new Set(coverage.map((c) => String(c._id)));
  // Scope to the seeded catalog: test suites leave throwaway BRG-* products in
  // the shared DB and those legitimately have no vendor quotes.
  const allProducts = await db.collection('products').find({ ...SEED.products, is_active: true }).toArray();
  const unpriced = allProducts.filter((p) => !pricedProducts.has(String(p._id)));
  check('every seeded product has >=1 vendor price', unpriced.length === 0,
    unpriced.length ? `unpriced: ${unpriced.slice(0, 5).map((p) => p.sku).join(', ')}` : `${pricedProducts.size} products priced`);
  const thinCoverage = coverage.filter((c) => c.n < 5);
  check('every priced product has >=5 vendor quotes', thinCoverage.length === 0,
    `${thinCoverage.length} products with <5 quotes`);

  // ---- 4. Live API ---------------------------------------------------
  console.log('\n[4] Live API');
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await login.json();
  const token = loginBody?.token;
  check('login with seeded demo credentials', Boolean(token) && loginBody?.success === true);
  if (!token) {
    console.log('\nCannot continue without a token.');
    await mongoose.connection.close();
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };
  const get = async (path) => {
    const res = await fetch(`${BASE}${path}`, { headers: auth });
    return { status: res.status, body: await res.json() };
  };

  const kpis = await get('/dashboard/kpis');
  check('GET /dashboard/kpis', kpis.status === 200, `status ${kpis.status}`);
  check('dashboard sees the seeded catalog',
    kpis.body?.data?.totalProductsInStock >= 43,
    `${kpis.body?.data?.totalProductsInStock} products, ${kpis.body?.data?.totalUnitsInStock} units`);

  // KPI low-stock count must equal the alerts list length (regression guard
  // for the per-rule duplicate alert bug).
  const alerts = await get('/dashboard/low-stock');
  const kpiLow = kpis.body?.data?.lowStockCount || 0;
  const alertRows = alerts.body?.data?.length || 0;
  check('low-stock KPI matches the alerts list length', kpiLow === alertRows,
    `KPI ${kpiLow} vs list ${alertRows}`);
  const uniqueAlertSkus = new Set((alerts.body?.data || []).map((a) => a.sku));
  check('alerts contain no duplicate products', uniqueAlertSkus.size === alertRows,
    `${uniqueAlertSkus.size} unique of ${alertRows} rows`);

  const products = await get('/products?limit=100');
  const items = Array.isArray(products.body?.data) ? products.body.data : [];
  const seededSkus = items.filter((p) => SEED.products.sku.test(p.sku));
  check('GET /products returns the seeded catalog', seededSkus.length >= 43,
    `${seededSkus.length} seeded of ${items.length} total (rest are test leftovers)`);

  const ops = await get('/operations?limit=500');
  const opItems = Array.isArray(ops.body?.data) ? ops.body.data : [];
  check('GET /operations returns the 90-day history', opItems.length >= 250, `${opItems.length} operations`);
  const statuses = new Set(opItems.map((o) => o.status));
  check('operations span multiple lifecycle statuses', statuses.size >= 4, [...statuses].join(', '));

  const moves = await get('/moves?limit=50');
  const moveItems = Array.isArray(moves.body?.data) ? moves.body.data : [];
  check('GET /moves returns the ledger', moveItems.length > 0, `${moveItems.length} moves`);

  const recs = await get('/replenishment/recommendations');
  const recList = Array.isArray(recs.body?.data) ? recs.body.data : [];
  const withVendors = recList.filter((r) => (r.vendors || []).length > 0);
  check('GET /replenishment/recommendations', recs.status === 200 && recList.length >= 43, `${recList.length} recommendations`);
  check('recommendations carry vendor quotes', withVendors.length >= recList.length * 0.9,
    `${withVendors.length}/${recList.length} with vendors`);
  check('at least one product triggers a reorder',
    recList.some((r) => r.trigger === 'reorder' && r.qtyToOrder > 0),
    `${recList.filter((r) => r.trigger === 'reorder').length} reorder candidates`);

  const svrRecs = recList.filter((r) => r.method === 'svr');
  check('frozen SVR model serves the anchor SKUs', svrRecs.length >= 4, `${svrRecs.length} svr forecasts`);

  const anchorCheck = await get('/replenishment/forecast/STEEL-12MM-ROD');
  check('GET /replenishment/forecast/:sku', anchorCheck.status === 200, `status ${anchorCheck.status}`);

  const vend = await get('/product/STEEL-12MM-ROD/vendors');
  const vendorList = vend.body?.data?.vendors || [];
  check('GET /product/:sku/vendors', vend.status === 200 && vendorList.length >= 5,
    `${vendorList.length} vendors, cheapest Rs${vendorList[0]?.price ?? '-'}`);
  check('vendor quotes are sorted cheapest-first',
    vendorList.every((v, i) => i === 0 || v.price >= vendorList[i - 1].price));

  const modelInfo = await get('/replenishment/model-info');
  check('GET /replenishment/model-info', modelInfo.status === 200,
    `${modelInfo.body?.data?.model} v${modelInfo.body?.data?.version}`);

  // ---- 5. Determinism spot-check -------------------------------------
  console.log('\n[5] Frozen-model integrity');
  const artifact = JSON.parse(
    (await import('node:fs')).readFileSync(
      new URL('../src/ml/artifacts/synthetic_series.json', import.meta.url), 'utf8')
  );
  const gh = await import('../src/scripts/generateHistory.js');
  let parity = 0;
  for (const sku of gh.ANCHOR_SKUS) {
    const series = gh.generateWeeklySeries(gh.profileForSku(sku), gh.WEEKS, {
      seed: gh.HISTORY_SEED, sku, baseWeeklyDemand: gh.BASE_WEEKLY_DEMAND[sku],
    });
    const expected = artifact.rows.filter((r) => r.sku === sku).sort((a, b) => a.week - b.week).map((r) => r.qty);
    if (JSON.stringify(series) === JSON.stringify(expected)) parity += 1;
  }
  check('all 7 anchor SKUs regenerate the frozen training series', parity === 7, `${parity}/7`);

  await mongoose.connection.close();

  // ---- Summary --------------------------------------------------------
  console.log('\n======================================================');
  console.log(`  passed: ${passed}   failed: ${failed}`);
  if (failed) {
    console.log(`  failures: ${failures.join('; ')}`);
    console.log('======================================================\n');
    process.exit(1);
  }
  console.log('  ALL CHECKS PASSED — demo dataset is live and consistent');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('verification crashed:', err);
  process.exit(1);
});
