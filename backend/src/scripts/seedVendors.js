// ---------------------------------------------------------------------------
// Indian vendor + vendor-price seed for the StockSense replenishment demo.
//
// Run AFTER the base seeder:  node src/scripts/seed.js && node src/scripts/seedVendors.js
//
// Determinism: fixed PRNG seed constant VENDOR_SEED = 20260927 (mulberry32),
// so every rerun produces the same vendors, prices, MOQs and lead times.
//
// All vendors are FICTIONAL-BUT-PLAUSIBLE demo companies. GSTIN strings are
// illustrative 15-char shapes only (state code + hash of name + Z + check
// chars) and are NOT real registrations — isVerified is always false.
//
// Idempotent: deletes prior seed-sourced VendorPrice rows for the seeded
// vendor codes and the seeded Vendor documents, then re-inserts.
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

// City/state pairs with their GST state codes (real codes, fictional firms).
const CITY_STATE_CODE = {
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

// 25 fictional-but-plausible Indian industrial suppliers.
export const VENDOR_FIXTURES = [
  { name: 'Orbit Metals Pvt Ltd', city: 'Mumbai' },
  { name: 'Narmada Industrial Supplies', city: 'Pune' },
  { name: 'Deccan Alloy Traders', city: 'Hyderabad' },
  { name: 'Shakti Fasteners & Fittings', city: 'Faridabad' },
  { name: 'Coromandel Hardware Mart', city: 'Chennai' },
  { name: 'Vindhya Steel & Pipes', city: 'New Delhi' },
  { name: 'Western Ghat Engineering Works', city: 'Pune' },
  { name: 'Sahyadri Safety Equipments', city: 'Mumbai' },
  { name: 'Ganga Metal Industries', city: 'Delhi' },
  { name: 'Nandi Alloys Pvt Ltd', city: 'Bangalore' },
  { name: 'Marina Industrial Traders', city: 'Chennai' },
  { name: 'Godavari Fabrication Works', city: 'Hyderabad' },
  { name: 'Pragati Screw & Bolt Co', city: 'Faridabad' },
  { name: 'Konkan Non-Ferrous Supplies', city: 'Mumbai' },
  { name: 'Aravalli Structural Steels', city: 'New Delhi' },
  { name: 'Vaigai Industrial Products', city: 'Coimbatore' },
  { name: 'Chambal Metals & Alloys', city: 'New Delhi' },
  { name: 'Malnad Extrusions Pvt Ltd', city: 'Bangalore' },
  { name: 'Tapti Thermal Solutions', city: 'Nashik' },
  { name: 'Kaveri Precision Components', city: 'Bangalore' },
  { name: 'Surat Formwork Systems', city: 'Mumbai' },
  { name: 'Pennar Industrial Fasteners', city: 'Chennai' },
  { name: 'Betwa Storage Racks Pvt Ltd', city: 'Faridabad' },
  { name: 'Pamba Ergonomic Furniture', city: 'Hyderabad' },
  { name: 'Sabarmati Safety Solutions', city: 'Ahmedabad' },
];

// Illustrative 15-char GSTIN shape: state code (2) + PAN-shaped body
// (5 letters, 5 digits, 1 letter) + entity digit + check letter. NOT real —
// derived deterministically from the vendor name hash for demo purposes only.
export function buildIllustrativeGstin(name, city) {
  const region = CITY_STATE_CODE[city] || { state: 'Unknown', code: '00' };
  const alphabet = 'ABCHJKLMNPQRSTUVWXYZ'; // PAN-style letters (no I/O)
  const digits = '0123456789';
  let x = hashStringToSeed(name.toUpperCase());
  const pick = (charset) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return charset[x % charset.length];
  };
  const body =
    pick(alphabet) + pick(alphabet) + pick(alphabet) + pick(alphabet) + pick(alphabet) +
    pick(digits) + pick(digits) + pick(digits) + pick(digits) + pick(digits) +
    'Z' + pick(alphabet) + pick(alphabet);
  return (region.code + body).slice(0, 15);
}

// Product-sensible INR base prices per seeded SKU (per the product's uom).
export const BASE_PRICE_INR = {
  'STEEL-12MM-ROD': 68, // per kg
  'ALUM-25X25-BAR': 235, // per m
  'BOLT-HEX-M8-P50': 420, // per pack of 50
  'CHAIR-ERGO-MESH': 7450, // per unit
  'FRAME-STEEL-WORK': 11200, // per unit
  'PASTE-THERM-10G': 145, // per tube
  'HELM-SAFE-YEL': 385, // per unit
};
const DEFAULT_BASE_PRICE_INR = 500;

const MOQ_TIERS = [25, 50, 100];

// Pure function: deterministic VendorPrice drafts for one product.
// productDetail: { sku, uom, index, basePrice? }
// Returns 3-6 drafts; each has vendorCode, INR currency, positive price,
// priceType 'list', source 'seed', confidence 'demo' and a past effFrom.
export function generateVendorPricesForProduct(productDetail, now = new Date()) {
  const basePrice = Number(productDetail.basePrice ?? BASE_PRICE_INR[productDetail.sku] ?? DEFAULT_BASE_PRICE_INR);
  const rng = mulberry32(((VENDOR_SEED >>> 0) ^ hashStringToSeed(String(productDetail.sku))) >>> 0);
  const count = 3 + Math.floor(rng() * 4); // 3-6 vendors per product

  // Pick `count` distinct vendors deterministically (Fisher-Yates partial).
  const pool = VENDOR_FIXTURES.map((_, i) => i);
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drafts = [];
  for (let k = 0; k < count; k += 1) {
    const vendorIdx = pool[k];
    const vendorCode = `VND-SEED-${String(vendorIdx + 1).padStart(2, '0')}`;
    const factor = 0.9 + rng() * 0.3; // 0.9 .. 1.2
    const raw = basePrice * factor;
    // Round: coarse for big ticket items, fine otherwise; keep it positive.
    const price = basePrice >= 1000
      ? Math.max(1, Math.round(raw / 10) * 10)
      : Math.max(1, Math.round(raw * 4) / 4);
    drafts.push({
      vendorCode,
      vendorIdx,
      sku: productDetail.sku,
      priceType: 'list',
      price,
      currency: 'INR',
      uom: productDetail.uom || 'units',
      moq: MOQ_TIERS[Math.floor(rng() * MOQ_TIERS.length)],
      leadDays: 3 + Math.floor(rng() * 19), // 3-21 days
      source: 'seed',
      confidence: 'demo',
      effFrom: new Date(now.getTime() - (90 + Math.floor(rng() * 210)) * 24 * 60 * 60 * 1000),
      effTo: null,
    });
  }
  return drafts;
}

const runVendorSeed = async () => {
  console.log('--- Connecting to Database for Vendor Seeding ---');
  await connectDB();

  const allCodes = VENDOR_FIXTURES.map((_, i) => `VND-SEED-${String(i + 1).padStart(2, '0')}`);

  console.log('--- 1. Clearing previous seed vendors/prices (idempotent) ---');
  const seedVendors = await Vendor.find({ vendorCode: { $in: allCodes } }).select('_id');
  const seedVendorIds = seedVendors.map((v) => v._id);
  await VendorPrice.deleteMany({ vendor: { $in: seedVendorIds } });
  const removedVendors = await Vendor.deleteMany({ vendorCode: { $in: allCodes } });
  console.log(`  Removed ${removedVendors.deletedCount} prior seed vendors and their prices`);

  console.log('--- 2. Upserting vendors ---');
  const vendorByCode = new Map();
  for (let i = 0; i < VENDOR_FIXTURES.length; i += 1) {
    const fixture = VENDOR_FIXTURES[i];
    const region = CITY_STATE_CODE[fixture.city] || { state: '', code: '00' };
    const vendorCode = `VND-SEED-${String(i + 1).padStart(2, '0')}`;
    const vendor = await Vendor.findOneAndUpdate(
      { vendorCode },
      {
        $set: {
          vendorCode,
          name: fixture.name,
          city: fixture.city,
          state: region.state,
          gstin: buildIllustrativeGstin(fixture.name, fixture.city),
          source: 'seed',
          isVerified: false,
        },
      },
      { upsert: true, new: true }
    );
    vendorByCode.set(vendorCode, vendor);
  }

  console.log('--- 3. Seeding vendor prices per seeded product ---');
  // Scope to the base-seeded SKUs: other suites create throwaway products in
  // the same shared demo DB and must not collect demo price rows.
  const products = await Product.find({ is_active: true, sku: { $in: Object.keys(BASE_PRICE_INR) } }).sort({ createdAt: 1, sku: 1 });
  if (products.length === 0) throw new Error('No seeded active products found — run seed.js first');

  const now = new Date();
  let priceCount = 0;
  for (let idx = 0; idx < products.length; idx += 1) {
    const product = products[idx];
    const drafts = generateVendorPricesForProduct(
      { sku: product.sku, uom: product.uom, index: idx },
      now
    );
    for (const draft of drafts) {
      const vendor = vendorByCode.get(draft.vendorCode);
      await VendorPrice.findOneAndUpdate(
        { vendor: vendor._id, product: product._id },
        {
          $set: {
            vendor: vendor._id,
            product: product._id,
            sku: product.sku,
            priceType: draft.priceType,
            price: draft.price,
            currency: draft.currency,
            uom: draft.uom,
            moq: draft.moq,
            leadDays: draft.leadDays,
            effFrom: draft.effFrom,
            effTo: draft.effTo,
            source: draft.source,
            confidence: draft.confidence,
          },
        },
        { upsert: true, new: true }
      );
      priceCount += 1;
    }
  }

  console.log('\n======================================================');
  console.log(' INDIAN VENDOR + PRICE SEED COMPLETE');
  console.log('======================================================');
  console.log(`  Seed:         ${VENDOR_SEED}`);
  console.log(`  Vendors:      ${VENDOR_FIXTURES.length} (fictional demo firms, isVerified=false)`);
  console.log(`  Products:     ${products.length}`);
  console.log(`  Price rows:   ${priceCount}`);
  console.log('======================================================\n');

  return { vendorCount: VENDOR_FIXTURES.length, productCount: products.length, priceCount };
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
