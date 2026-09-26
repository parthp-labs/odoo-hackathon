// Vendor search service — product -> available vendors with current price,
// with honest provenance (source + confidence) so the UI can always tell
// seed data apart from live data.

import Product from '../../models/product.model.js';
import Vendor from '../../models/vendor.model.js';
import VendorPrice from '../../models/vendorPrice.model.js';
import { fetchCommodityPrice } from './commodityAdapter.js';

/**
 * Search products by SKU (exact) or name/sku text; returns matching products.
 * @param {string} query
 * @param {object} opts { limit }
 */
export async function searchProducts(query, { limit = 20 } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const text = await Product.find({ $text: { $search: q }, is_active: true })
    .select('_id name sku category uom')
    .limit(limit)
    .lean()
    .catch(() => []);
  if (text.length) return text;
  // fallback to regex when no text index match
  return Product.find({
    is_active: true,
    $or: [{ sku: new RegExp(escapeRe(q), 'i') }, { name: new RegExp(escapeRe(q), 'i') }],
  })
    .select('_id name sku category uom')
    .limit(limit)
    .lean();
}

/**
 * Get the available vendors + current prices for ONE product, cheapest first.
 * Optionally augments with a live commodity price when the product's category
 * maps to a commodity name.
 * @param {string|object} productIdOrProduct
 * @param {object} opts { limit, categoryToCommodity, agmarknetKey, cedaKey }
 */
export async function getBestPricesForProduct(productIdOrProduct, opts = {}) {
  const product =
    typeof productIdOrProduct === 'string' || productIdOrProduct instanceof Object
      ? await resolveProduct(productIdOrProduct)
      : productIdOrProduct;
  if (!product) return [];

  const today = new Date();
  // productIdOrProduct may be a full doc we already have.
  const prices = await VendorPrice.find({
    product: product._id,
    $or: [{ effTo: null }, { effTo: { $gte: today } }],
  })
    .sort({ price: 1 })
    .limit((opts.limit || 10) * 2)
    .lean();

  const vendorIds = [...new Set(prices.map((p) => String(p.vendor)))];
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
  const vmap = new Map(vendors.map((v) => [String(v._id), v]));

  const out = [];
  for (const p of prices) {
    if (out.length >= (opts.limit || 10)) break;
    const v = vmap.get(String(p.vendor));
    out.push({
      vendorId: p.vendor,
      vendorCode: v?.vendorCode || null,
      name: v?.name || null,
      city: v?.city || null,
      state: v?.state || null,
      gstin: v?.gstin || null,
      isVerified: v?.isVerified || false,
      price: p.price,
      currency: p.currency || 'INR',
      uom: p.uom || product.uom || 'units',
      moq: p.moq || 0,
      leadDays: p.leadDays || 0,
      priceType: p.priceType || 'list',
      source: p.source || 'seed',
      confidence: p.confidence || 'demo',
    });
  }

  // Optional live garnish from a commodity price API when the category maps.
  const commodity = opts.categoryToCommodity?.[String(product.category)] || categoryGuess(product);
  if (commodity && opts.live !== false) {
    try {
      const live = await fetchCommodityPrice(commodity, {
        agmarknetKey: opts.agmarknetKey,
        cedaKey: opts.cedaKey,
      });
      if (live.live) {
        out.push({
          vendorId: null,
          vendorCode: null,
          name: `${live.source.toUpperCase()} market (${live.market || 'govt'} rate)`,
          city: null,
          state: null,
          gstin: null,
          isVerified: true,
          price: live.modalPrice ?? live.maxPrice ?? live.minPrice ?? 0,
          currency: 'INR',
          uom: live.unit || 'quintal',
          moq: 0,
          leadDays: 0,
          priceType: 'contract',
          source: live.source,
          confidence: 'live',
          commodity,
          priceDate: live.date || null,
        });
      }
    } catch (_) {
      // live garnish is optional; never break the demo
    }
  }

  return out;
}

/** Search vendors by name/city text (for a directory-style search). */
export async function searchVendors(query, { limit = 20 } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const text = await Vendor.find({ $text: { $search: q } })
    .select('vendorCode name city state gstin source isVerified')
    .limit(limit)
    .lean()
    .catch(() => []);
  if (text.length) return text;
  return Vendor.find({
    $or: [{ name: new RegExp(escapeRe(q), 'i') }, { city: new RegExp(escapeRe(q), 'i') }],
  })
    .select('vendorCode name city state gstin source isVerified')
    .limit(limit)
    .lean();
}

function resolveProduct(idOrObj) {
  if (typeof idOrObj === 'string') return Product.findById(idOrObj).lean();
  if (idOrObj?._id) return idOrObj; // already a populated doc/lean
  return Product.findById(idOrObj).lean();
}

function categoryGuess(product) {
  // Best-effort: no robust mapping without the category name; return null.
  return null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}