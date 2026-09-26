// ---------------------------------------------------------------------------
// Indian vendor + vendor-price seed for the StockSense replenishment demo.
//
// Run AFTER the base seeder:  node src/scripts/seed.js && node src/scripts/seedVendors.js
//
// Seeds 120 FICTIONAL-BUT-PLAUSIBLE Indian demo vendors across the 5 seeded
// product categories (Raw Materials, Metals & Alloys, Hardware, Finished
// Goods, Furniture) with >=5 distinct list-price tiers per seeded SKU.
//
// Determinism: pure generator generateVendorDataset(seed) draws every field
// (names, cities, GSTINs, prices, MOQs, lead times) from mulberry32 seeded
// with the constant VENDOR_SEED = 20260927, so every rerun produces a
// byte-identical dataset. NO database access happens inside the generator.
//
// All vendors/prices are FICTIONAL-BUT-PLAUSIBLE demo data; GSTINs are
// illustrative 15-char shapes only (state code + hash of name + Z + check
// chars) and are NOT real registrations — isVerified is always false and
// every price row carries confidence:'demo'.
//
// Idempotent: deletes prior VND-SEED- sourced VendorPrice rows and Vendor
// documents, then re-inserts the generated dataset.
// ---------------------------------------------------------------------------
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.config.js';
import Product from '../models/product.model.js';
import Vendor from '../models/vendor.model.js';
import VendorPrice from '../models/vendorPrice.model.js';
import { mulberry32, hashStringToSeed } from './generateHistory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const VENDOR_SEED = 20260927; // fixed seed constant — do not change
export const VENDOR_TARGET_COUNT = 120;

// City/state pairs with their REAL GST state codes (fictional firms, real codes).
export const CITY_STATE_CODE = {
  Mumbai: { state: 'Maharashtra', code: '27' },
  Pune: { state: 'Maharashtra', code: '27' },
  Nashik: { state: 'Maharashtra', code: '27' },
  Delhi: { state: 'Delhi', code: '07' },
  'New Delhi': { state: 'Delhi', code: '07' },
  'Faridabad': { state: 'Haryana', code: '06' },
  Bangalore: { state: 'Karnataka', code: '29' },
  Chennai: { state: 'Tamil Nadu', code: '33' },
  Coimbatore: { state: 'Tamil Nadu', code: '33' },
  Hyderabad: { state: 'Telangana', code: '36' },
  Ahmedabad: { state: 'Gujarat', code: '24' },
};

// The 5 seeded product_categories. Furniture has no seeded SKU but is a real
// seeded category, so vendors may belong to it.
export const VENDOR_CATEGORIES = [
  'Raw Materials',
  'Metals & Alloys',
  'Hardware',
  'Finished Goods',
  'Furniture',
];

// Share of the 120 vendors per category (sums to 120; every category > 0).
const CATEGORY_SHARES = [
  ['Metals & Alloys', 28],
  ['Hardware', 26],
  ['Finished Goods', 24],
  ['Raw Materials', 22],
  ['Furniture', 20],
];

// Deterministic name composition pools: prefix + category noun + suffix.
const NAME_PREFIXES = [
  'Acme', 'Shree', 'Amrit', 'Star', 'Om', 'Krishna', 'Raj',
  'Alpine', 'National', 'Global', 'Vertex', 'Nova', 'Pacific', 'Zenith',
];
const NAME_SUFFIXES = ['Pvt Ltd', 'LLP', 'Works', 'Associates', 'Traders', 'Industries'];
const CATEGORY_NOUNS = {
  'Raw Materials': ['Raw', 'Packaging', 'Supply', 'Trading', 'Enterprises', 'Impex'],
  'Metals & Alloys': ['Metal', 'Steel', 'Alloys', 'Components', 'Trading', 'Enterprises'],
  Hardware: ['Hardware', 'Fastener', 'Components', 'Supply', 'Impex', 'Enterprises'],
  'Finished Goods': ['Industrial', 'Components', 'Furniture', 'Supply', 'Trading', 'Works'],
  Furniture: ['Furniture', 'Enterprises', 'Industrial', 'Supply', 'Trading', 'Impex'],
};

// The 7 base-seeded SKUs: category (which vendors may quote them), product uom,
// and an illustrative INR base price per the product's uom.
export const SEED_SKU_SPECS = [
  { sku: 'STEEL-12MM-ROD', category: 'Metals & Alloys', uom: 'kg', base: 80 },   // ~68-88 /kg
  { sku: 'ALUM-25X25-BAR', category: 'Metals & Alloys', uom: 'm', base: 235 },   // ~200-258 /m
  { sku: 'BOLT-HEX-M8-P50', category: 'Hardware', uom: 'packs', base: 380 },     // ~323-418 /pack
  { sku: 'CHAIR-ERGO-MESH', category: 'Finished Goods', uom: 'units', base: 2775 }, // ~2359-3053 /unit
  { sku: 'FRAME-STEEL-WORK', category: 'Finished Goods', uom: 'units', base: 1115 }, // ~948-1227 /unit
  { sku: 'PASTE-THERM-10G', category: 'Raw Materials', uom: 'tubes', base: 102 },  // ~87-112 /tube
  { sku: 'HELM-SAFE-YEL', category: 'Finished Goods', uom: 'units', base: 480 },  // ~408-528 /unit
];

// Illustrative INR base prices per seeded SKU (kept exported for tests/docs).
export const BASE_PRICE_INR = Object.fromEntries(SEED_SKU_SPECS.map((s) => [s.sku, s.base]));
const DEFAULT_BASE_PRICE_INR = 500;

const MOQ_TIERS = [25, 50, 100];
const PRICE_TIERS_PER_SKU = 6; // >=5 distinct vendors quote each SKU
const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed reference epoch for effective-from dates (pure determinism: never `now`).
const EFF_FROM_REF_UTC = Date.UTC(2026, 7, 1); // 2026-08-01

// Illustrative 15-char GSTIN shape mirroring the real format:
//   state code (2 digits) + PAN body (5 letters, 4 digits, 1 letter)
//   + entity digit + 'Z' + check char — ^\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]$
// NOT real registrations: derived deterministically from the name+city hash.
export function buildIllustrativeGstin(name, city) {
  const region = CITY_STATE_CODE[city] || { state: 'Unknown', code: '00' };
  const alphabet = 'ABCHJKLMNPQRSTUVWXYZ'; // PAN-style letters (no I/O)
  const digits = '0123456789';
  let x = hashStringToSeed(`${name}|${city}`.toUpperCase());
  const pick = (charset) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return charset[x % charset.length];
  };
  const pan =
    pick(alphabet) + pick(alphabet) + pick(alphabet) + pick(alphabet) + pick(alphabet) +
    pick(digits) + pick(digits) + pick(digits) + pick(digits) +
    pick(alphabet);
  const entity = pick(digits);
  const check = pick(alphabet + digits);
  return (region.code + pan + entity + 'Z' + check).slice(0, 15);
}

// Deterministically compose a unique "Prefix Noun Suffix" name within `taken`.
function composeVendorName(rng, taken, category) {
  const nouns = CATEGORY_NOUNS[category];
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const prefix = NAME_PREFIXES[Math.floor(rng() * NAME_PREFIXES.length)];
    const noun = nouns[Math.floor(rng() * nouns.length)];
    const suffix = NAME_SUFFIXES[Math.floor(rng() * NAME_SUFFIXES.length)];
    const name = `${prefix} ${noun} ${suffix}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  // Guaranteed-unique fallback: walk the full combination space in order.
  for (const prefix of NAME_PREFIXES) {
    for (const noun of nouns) {
      for (const suffix of NAME_SUFFIXES) {
        const name = `${prefix} ${noun} ${suffix}`;
        if (!taken.has(name)) {
          taken.add(name);
          return name;
        }
      }
    }
  }
  throw new Error(`vendor name space exhausted for category ${category}`);
}

// Deterministically pick `count` distinct vendors from `pool` (partial
// Fisher-Yates) and emit one price draft per pick.
function generatePriceRows(vendors, seed) {
  const byCategory = new Map();
  for (const v of vendors) {
    if (!byCategory.has(v.category)) byCategory.set(v.category, []);
    byCategory.get(v.category).push(v);
  }

  const prices = [];
  for (const { sku, category, uom, base } of SEED_SKU_SPECS) {
    const pool = [...(byCategory.get(category) || [])];
    if (pool.length < PRICE_TIERS_PER_SKU) {
      throw new Error(`not enough ${category} vendors to price ${sku}`);
    }
    const rng = mulberry32(((seed >>> 0) ^ hashStringToSeed(`price:${sku}`)) >>> 0);
    for (let i = 0; i < PRICE_TIERS_PER_SKU; i += 1) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let k = 0; k < PRICE_TIERS_PER_SKU; k += 1) {
      const vendor = pool[k];
      const factor = 0.85 + rng() * 0.25; // 0.85 .. 1.10
      const price = Math.max(0.01, Math.round(base * factor * 100) / 100);
      prices.push({
        vendorCode: vendor.vendorCode,
        sku,
        price,
        currency: 'INR',
        uom,
        moq: MOQ_TIERS[Math.floor(rng() * MOQ_TIERS.length)],
        leadDays: 3 + Math.floor(rng() * 19), // 3-21 days
        priceType: 'list',
        source: 'seed',
        confidence: 'demo',
        effFrom: new Date(EFF_FROM_REF_UTC - (30 + Math.floor(rng() * 150)) * DAY_MS),
        effTo: null,
      });
    }
  }
  return prices;
}

// ---------------------------------------------------------------------------
// PURE GENERATOR — no DB I/O. Deterministic for a fixed seed; unit-testable.
// Returns { vendors: [{ vendorCode, name, city, state, gstin, category,
//                        source, isVerified }],
//          prices:  [{ vendorCode, sku, price, currency, uom, moq, leadDays,
//                       priceType, source, confidence, effFrom, effTo }] }
// `category` on vendors is advisory (model does not persist it).
// ---------------------------------------------------------------------------
export function generateVendorDataset(seed = VENDOR_SEED) {
  const rng = mulberry32(seed >>> 0);
  const cities = Object.keys(CITY_STATE_CODE);
  const takenNames = new Set();
  const vendors = [];
  let index = 0;
  for (const [category, share] of CATEGORY_SHARES) {
    for (let j = 0; j < share; j += 1) {
      const name = composeVendorName(rng, takenNames, category);
      const city = cities[Math.floor(rng() * cities.length)];
      const region = CITY_STATE_CODE[city];
      vendors.push({
        vendorCode: `VND-SEED-${String(index).padStart(2, '0')}`,
        name,
        city,
        state: region.state,
        gstin: buildIllustrativeGstin(name, city),
        category,
        source: 'seed',
        isVerified: false,
      });
      index += 1;
    }
  }
  return { vendors, prices: generatePriceRows(vendors, seed) };
}

const runVendorSeed = async () => {
  console.log('--- Connecting to Database for Vendor Seeding ---');
  await connectDB();

  const dataset = generateVendorDataset(VENDOR_SEED);

  console.log('--- 1. Clearing previous seed vendors/prices (idempotent) ---');
  const prior = await Vendor.find({ vendorCode: /^VND-SEED-/ }).select('_id');
  await VendorPrice.deleteMany({ vendor: { $in: prior.map((v) => v._id) } });
  const removedVendors = await Vendor.deleteMany({ vendorCode: /^VND-SEED-/ });
  console.log(`  Removed ${removedVendors.deletedCount} prior seed vendors and their prices`);

  console.log('--- 2. Inserting vendors ---');
  const created = await Vendor.insertMany(
    dataset.vendors.map(({ category, ...doc }) => doc), // `category` is advisory only
    { ordered: true }
  );
  const vendorIdByCode = new Map(created.map((v) => [v.vendorCode, v._id]));

  console.log('--- 3. Seeding vendor prices per seeded product ---');
  // Scope to the base-seeded SKUs: other suites create throwaway products in
  // the same shared demo DB and must not collect demo price rows.
  const products = await Product.find({
    is_active: true,
    sku: { $in: SEED_SKU_SPECS.map((s) => s.sku) },
  }).sort({ createdAt: 1, sku: 1 });
  if (products.length === 0) throw new Error('No seeded active products found — run seed.js first');

  const productBySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
  const priceDocs = [];
  for (const draft of dataset.prices) {
    const product = productBySku.get(draft.sku.toUpperCase());
    if (!product) continue; // SKU not in this DB — skip its rows
    priceDocs.push({
      vendor: vendorIdByCode.get(draft.vendorCode),
      product: product._id,
      sku: draft.sku,
      priceType: draft.priceType,
      price: draft.price,
      currency: draft.currency,
      uom: product.uom || draft.uom,
      moq: draft.moq,
      leadDays: draft.leadDays,
      effFrom: draft.effFrom,
      effTo: draft.effTo,
      source: draft.source,
      confidence: draft.confidence,
    });
  }
  await VendorPrice.insertMany(priceDocs, { ordered: true });

  console.log('\n======================================================');
  console.log(' INDIAN VENDOR + PRICE SEED COMPLETE');
  console.log('======================================================');
  console.log(`  Seed:         ${VENDOR_SEED}`);
  console.log(`  Vendors:      ${dataset.vendors.length} across ${VENDOR_CATEGORIES.length} categories (fictional demo firms, isVerified=false)`);
  console.log(`  Products:     ${products.length}`);
  console.log(`  Price rows:   ${priceDocs.length} (>=${PRICE_TIERS_PER_SKU} tiers per SKU)`);
  console.log('======================================================\n');

  console.log(`seeded ${dataset.vendors.length} vendors, ${priceDocs.length} prices`);
  return {
    vendorCount: dataset.vendors.length,
    productCount: products.length,
    priceCount: priceDocs.length,
  };
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  runVendorSeed()
    .then(async () => {
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Vendor Seeding Failed:', error);
      await mongoose.connection.close();
      process.exit(1);
    });
}

export { runVendorSeed };
