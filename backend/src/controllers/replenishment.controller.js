import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import { createForecastPort } from '../services/forecast/forecastPort.js';
import { createReplenishPort } from '../services/replenishment/replenishPort.js';
import { createMarketPort } from '../services/vendors/marketPort.js';

const forecastPort = createForecastPort();
const replenishPort = createReplenishPort();
const marketPort = createMarketPort();

/**
 * GET /api/replenishment/recommendations?sku=...  (or all when sku omitted)
 */
export const getRecommendations = asyncHandler(async (req, res, next) => {
  const { sku } = req.query;
  const serviceLevel = Number(req.query.serviceLevel) || undefined;
  const leadDays = Number(req.query.leadDays) || undefined;
  const opts = { serviceLevel, leadDays };

  if (sku) {
    const rec = await replenishPort.recommendReorder(sku, opts);
    if (!rec) return next(new ErrorResponse(`No such SKU: ${sku}`, 404));
    return res.status(200).json({ success: true, data: rec });
  }
  const all = await replenishPort.recommendAll(opts);
  return res.status(200).json({ success: true, count: all.length, data: all });
});

/**
 * GET /api/replenishment/forecast/:sku?horizon=8
 */
export const getForecast = asyncHandler(async (req, res, next) => {
  const sku = String(req.params.sku || '').toUpperCase();
  const horizon = Number(req.query.horizon) || 8;
  if (horizon < 1 || horizon > 26) {
    return next(new ErrorResponse('horizon must be between 1 and 26 weeks', 400));
  }
  const f = await forecastPort.getForecast(sku, { horizonWeeks: horizon });
  if (!f) return next(new ErrorResponse(`No forecast for SKU: ${sku}`, 404));
  return res.status(200).json({ success: true, data: f });
});

/**
 * POST /api/replenishment/run  — refit all forecasts (batch).
 */
export const runRefit = asyncHandler(async (req, res) => {
  const horizon = Number(req.body?.horizon) || 8;
  const results = await forecastPort.refitAll({ horizonWeeks: horizon });
  return res.status(200).json({ success: true, count: results.length, data: results });
});

/**
 * GET /api/product/:sku/vendors  — vendors + prices for one product.
 */
export const getProductVendors = asyncHandler(async (req, res, next) => {
  const sku = String(req.params.sku || '').toUpperCase();
  const [product] = await marketPort.searchProducts(sku, { limit: 1 });
  if (!product) return next(new ErrorResponse(`No such SKU: ${sku}`, 404));
  const prices = await marketPort.getBestPricesForProduct(product, { live: true });
  return res.status(200).json({ success: true, data: { product, vendors: prices } });
});

/**
 * GET /api/vendors/search?q=  — search vendors by name/city.
 */
export const searchVendors = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '');
  const vendors = await marketPort.searchVendors(q, { limit: 20 });
  return res.status(200).json({ success: true, count: vendors.length, data: vendors });
});