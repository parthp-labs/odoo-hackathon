import asyncHandler from '../middlewares/async.middleware.js';
import StockOperation from '../models/stockOperation.model.js';
import StockQuant from '../models/stockQuant.model.js';
import Product from '../models/product.model.js';
import Location from '../models/location.model.js';

// @desc    Get inventory dashboard KPIs (Total In Stock, Low/Out of Stock, Pending Receipts/Deliveries/Transfers)
// @route   GET /api/dashboard/kpis
// @access  Private
export const getDashboardKPIs = asyncHandler(async (req, res, next) => {
  const { warehouse } = req.query;

  // 1. Build Location filter for physical internal locations
  const locationQuery = { location_type: 'internal' };
  if (warehouse) {
    locationQuery.warehouse = warehouse;
  }
  const internalLocations = await Location.find(locationQuery).select('_id warehouse');
  const internalLocIds = internalLocations.map((l) => l._id);

  // 2. Compute Total Products In Stock & Stock Quant balances
  const stockQuants = await StockQuant.find({
    location: { $in: internalLocIds },
    quantity: { $gt: 0 },
  }).populate('product', 'name sku reordering_rules is_active');

  // Aggregation per product across locations
  const productStockMap = new Map();
  for (const quant of stockQuants) {
    if (!quant.product || !quant.product.is_active) continue;
    const pId = quant.product._id.toString();
    const current = productStockMap.get(pId) || {
      product: quant.product,
      totalQty: 0,
      warehouseQtyMap: new Map(),
    };
    current.totalQty += quant.quantity;

    // Track per-warehouse quantity
    const quantWh = internalLocations.find((l) => l._id.equals(quant.location))?.warehouse?.toString();
    if (quantWh) {
      const whQty = current.warehouseQtyMap.get(quantWh) || 0;
      current.warehouseQtyMap.set(quantWh, whQty + quant.quantity);
    }

    productStockMap.set(pId, current);
  }

  const totalProductsInStock = productStockMap.size;
  let totalUnitsInStock = 0;
  for (const item of productStockMap.values()) {
    totalUnitsInStock += item.totalQty;
  }

  // 3. Compute Low Stock & Out of Stock counts
  const allActiveProducts = await Product.find({ is_active: true });
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const prod of allActiveProducts) {
    const stockInfo = productStockMap.get(prod._id.toString());
    const onHand = stockInfo ? stockInfo.totalQty : 0;

    if (onHand === 0) {
      outOfStockCount++;
    }

    // Determine min threshold based on warehouse filter or global reordering rules
    let minThreshold = 0;
    if (warehouse && prod.reordering_rules?.length) {
      const rule = prod.reordering_rules.find((r) => r.warehouse.toString() === warehouse.toString());
      minThreshold = rule ? rule.min_quantity : 0;
    } else if (prod.reordering_rules?.length) {
      minThreshold = Math.max(...prod.reordering_rules.map((r) => r.min_quantity));
    }

    if (minThreshold > 0 && onHand > 0 && onHand <= minThreshold) {
      lowStockCount++;
    }
  }

  // 4. Pending Operations Count
  const opFilter = {};
  if (warehouse) {
    opFilter.$or = [
      { source_location: { $in: internalLocIds } },
      { destination_location: { $in: internalLocIds } },
    ];
  }

  const [pendingReceipts, pendingDeliveries, internalTransfersScheduled] = await Promise.all([
    StockOperation.countDocuments({
      ...opFilter,
      operation_type: 'receipt',
      status: { $in: ['waiting', 'ready', 'draft'] },
    }),
    StockOperation.countDocuments({
      ...opFilter,
      operation_type: 'delivery',
      status: { $in: ['waiting', 'ready', 'draft'] },
    }),
    StockOperation.countDocuments({
      ...opFilter,
      operation_type: 'internal_transfer',
      status: { $in: ['waiting', 'ready', 'draft'] },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalProductsInStock,
      totalUnitsInStock,
      lowStockCount,
      outOfStockCount,
      pendingReceipts,
      pendingDeliveries,
      internalTransfersScheduled,
    },
  });
});

// @desc    Get dashboard operations list with dynamic multi-dimensional filters
// @route   GET /api/dashboard/operations
// @access  Private
export const getDashboardOperations = asyncHandler(async (req, res, next) => {
  const { type, status, warehouse, location, category, search, page = 1, limit = 20 } = req.query;

  const query = {};

  // Filter by document type
  if (type) {
    query.operation_type = type;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by warehouse or location
  if (location) {
    query.$or = [{ source_location: location }, { destination_location: location }];
  } else if (warehouse) {
    const whLocations = await Location.find({ warehouse }).select('_id');
    const locIds = whLocations.map((l) => l._id);
    query.$or = [{ source_location: { $in: locIds } }, { destination_location: { $in: locIds } }];
  }

  // Filter by search string
  if (search) {
    query.$or = [
      { reference: { $regex: search, $options: 'i' } },
      { partner_name: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  let operations = await StockOperation.find(query)
    .populate('source_location', 'name code location_type')
    .populate('destination_location', 'name code location_type')
    .populate('created_by', 'name email role')
    .populate({
      path: 'lines.product',
      select: 'name sku uom category',
      populate: { path: 'category', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Category filter if specified
  if (category) {
    operations = operations.filter((op) =>
      op.lines.some(
        (l) => l.product && l.product.category && l.product.category._id.toString() === category.toString()
      )
    );
  }

  const total = await StockOperation.countDocuments(query);

  res.status(200).json({
    success: true,
    count: operations.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: operations,
  });
});

// @desc    Get detailed list of low-stock and out-of-stock items for alert notifications
// @route   GET /api/dashboard/low-stock
// @access  Private
export const getLowStockAlerts = asyncHandler(async (req, res, next) => {
  const { warehouse } = req.query;

  const locationQuery = { location_type: 'internal' };
  if (warehouse) locationQuery.warehouse = warehouse;
  const internalLocs = await Location.find(locationQuery).select('_id warehouse');
  const locIds = internalLocs.map((l) => l._id);

  const products = await Product.find({ is_active: true })
    .populate('category', 'name')
    .populate('reordering_rules.warehouse', 'name code');

  const alerts = [];

  for (const product of products) {
    const quants = await StockQuant.find({
      product: product._id,
      location: { $in: locIds },
    });

    const totalOnHand = quants.reduce((sum, q) => sum + q.quantity, 0);

    for (const rule of product.reordering_rules) {
      if (warehouse && rule.warehouse._id.toString() !== warehouse.toString()) continue;

      if (totalOnHand <= rule.min_quantity) {
        alerts.push({
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          uom: product.uom,
          category: product.category?.name || 'Uncategorized',
          warehouseName: rule.warehouse.name,
          warehouseCode: rule.warehouse.code,
          onHand: totalOnHand,
          minThreshold: rule.min_quantity,
          maxTarget: rule.max_quantity,
          isOutOfStock: totalOnHand === 0,
        });
      }
    }
  }

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts,
  });
});
