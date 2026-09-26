// Reorder recommendation service — the combined replenishment flow.
// Combines forecast-over-lead-time + safety stock − (on-hand − reserved) into a
// reorder quantity, then lists the cheapest vendors to source it.
//
// Safety stock (King's formula, demand + lead-time both vary):
//   SS = z * sqrt( leadWeeks * sigmaD^2 + meanD^2 * sigmaL^2 )
// Derive sigmaD from the forecast quantile spread (p90 - p50) when available,
// else fall back to a capped heuristic. z by service level.

import Forecast from '../../models/forecast.model.js';
import Product from '../../models/product.model.js';
import StockQuant from '../../models/stockQuant.model.js';
import VendorPrice from '../../models/vendorPrice.model.js';
import Vendor from '../../models/vendor.model.js';
import ReorderSuggestion from '../../models/reorderSuggestion.model.js';

const Z_BY_SERVICE = { 90: 1.28, 95: 1.65, 98: 2.05, 99: 2.33 };
const DEFAULT_SERVICE_LEVEL = 95;
const DEFAULT_LEAD_DAYS = 7;

/**
 * Compute the reorder recommendation for a single SKU.
 * @param {string} sku
 * @param {object} opts { serviceLevel (90/95/98/99), horizonWeeks, leadDays, reviewWeeks }
 * @returns {Promise<object|null>} flattened recommendation or null if SKU unknown
 */
export async function recommendReorder(sku, opts = {}) {
  const serviceLevel = opts.serviceLevel || DEFAULT_SERVICE_LEVEL;
  const product = await Product.findOne({ sku, is_active: true }).lean();
  if (!product) return null;

  const forecast = await Forecast.findOne({ sku }).sort({ generatedAt: -1 }).lean();
  const horizonWeeks = opts.horizonWeeks || forecast?.horizonWeeks || 8;
  const forecastDemand = forecast?.forecastedDemand || 0;
  const weeklyForecast = horizonWeeks > 0 ? forecastDemand / horizonWeeks : 0;

  // On-hand & reserved across all internal locations for the product.
  const quants = await StockQuant.find({ product: product._id }).lean();
  const onHand = quants.reduce((s, q) => s + (q.quantity || 0), 0);
  const reserved = quants.reduce((s, q) => s + (q.reserved_quantity || 0), 0);
  const effectiveStock = onHand - reserved;

  // Lead time (days -> weeks). Observed lead time dominates forecast error.
  const leadWeeks = Math.max(0.5, (opts.leadDays ?? DEFAULT_LEAD_DAYS) / 7);
  const reviewWeeks = opts.reviewWeeks ?? 1;
  const weeksToCover = leadWeeks + reviewWeeks;

  // Forecast demand over the coverage window.
  const forecastOverLead = weeklyForecast * weeksToCover;

  // Safety stock from forecast quantile spread (sigmaD) when available.
  const safetyStock = computeSafetyStock(forecast, leadWeeks, serviceLevel, weeklyForecast);

  const raw = forecastOverLead + safetyStock - effectiveStock;
  const qtyToOrder = Math.max(0, Math.ceil(raw));
  const trigger = qtyToOrder > 0 ? 'reorder' : 'none';

  const vendors = await listSourceableVendors(sku, product._id);

  const doc = await ReorderSuggestion.findOneAndUpdate(
    { sku, product: product._id },
    {
      product: product._id,
      sku,
      qtyToOrder,
      trigger,
      forecastOverLeadTime: round2(forecastOverLead),
      safetyStock: round2(safetyStock),
      onHand,
      reserved,
      method: forecast?.modelType || 'ses',
      vendors,
    },
    { upsert: true, new: true }
  ).lean();

  return doc;
}

/**
 * Reorder for every SKU that currently has a forecast snapshot.
 * @returns {Promise<Array<object>>}
 */
export async function recommendAll(opts = {}) {
  const skus = await Forecast.distinct('sku');
  const out = [];
  for (const sku of skus) {
    const rec = await recommendReorder(sku, opts);
    if (rec) out.push(rec);
  }
  return out;
}

/**
 * Vendors + current price able to source a product, cheapest first.
 * @returns {Promise<Array<object>>} see caller for shape
 */
export async function listSourceableVendors(sku, productId, { limit = 5 } = {}) {
  const today = new Date();
  const prices = await VendorPrice.find({
    product: productId,
    $or: [{ effTo: null }, { effTo: { $gte: today } }],
  })
    .sort({ price: 1 })
    .limit(limit * 3)
    .lean();

  const vendorIds = [...new Set(prices.map((p) => String(p.vendor)))];
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
  const vmap = new Map(vendors.map((v) => [String(v._id), v]));

  const out = [];
  for (const p of prices) {
    if (out.length >= limit) break;
    const v = vmap.get(String(p.vendor));
    out.push({
      vendorId: p.vendor,
      vendorCode: v?.vendorCode || null,
      name: v?.name || null,
      price: p.price,
      currency: p.currency || 'INR',
      uom: p.uom || 'units',
      moq: p.moq || 0,
      leadDays: p.leadDays || DEFAULT_LEAD_DAYS,
      priceType: p.priceType || 'list',
      source: p.source || 'seed',
      confidence: p.confidence || 'demo',
      sku,
    });
  }
  return out;
}

/**
 * Safety stock using King's formula, with sigmaD derived from the forecast's
 * quantile spread (p90 - p50 ~ 1.28 sigma) when present, else a capped heuristic.
 */
function computeSafetyStock(forecast, leadWeeks, serviceLevel, weeklyForecast) {
  const z = Z_BY_SERVICE[serviceLevel] ?? Z_BY_SERVICE[DEFAULT_SERVICE_LEVEL];
  let sigmaD;
  const q = forecast?.quantiles;
  if (q && typeof q.p90 === 'number' && typeof q.p50 === 'number') {
    // Spread p90 - p50 approximates 1.28 * sigma for a normal-ish distribution.
    sigmaD = Math.max(0, (q.p90 - q.p50) / 1.28);
  } else {
    sigmaD = Math.max(1, weeklyForecast * 0.35);
  }
  const meanD = Math.max(weeklyForecast, 0.1);
  const sigmaL = Math.max(0.5, leadWeeks * 0.3); // lead-time variability proxy
  return z * Math.sqrt(leadWeeks * sigmaD * sigmaD + meanD * meanD * sigmaL * sigmaL);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}