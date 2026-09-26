import asyncHandler from "../middlewares/async.middleware.js";
import StockQuant from "../models/stockQuant.model.js";

// @desc    Get real-time stock availability per product & location
// @route   GET /api/stock
// @access  Private
export const getStockAvailability = asyncHandler(async (req, res, next) => {
  const { product, location, warehouse, search } = req.query;

  const query = {};

  if (product) query.product = product;
  if (location) query.location = location;

  let quants = await StockQuant.find(query)
    .populate({
      path: "product",
      select: "name sku uom category is_active reordering_rules",
      populate: { path: "category", select: "name" },
    })
    .populate({
      path: "location",
      select: "name code location_type warehouse",
      populate: { path: "warehouse", select: "name code" },
    })
    .sort({ "product.name": 1 });

  // Filter out any quants with zero quantity if needed or virtual locations
  quants = quants.filter(
    (q) => q.product && q.location && q.location.location_type === "internal",
  );

  // Filter by warehouse if provided
  if (warehouse) {
    quants = quants.filter(
      (q) =>
        q.location.warehouse &&
        q.location.warehouse._id.toString() === warehouse.toString(),
    );
  }

  // Filter by search string (Product name or SKU)
  if (search) {
    const s = search.toLowerCase();
    quants = quants.filter(
      (q) =>
        q.product.name.toLowerCase().includes(s) ||
        q.product.sku.toLowerCase().includes(s) ||
        q.location.code.toLowerCase().includes(s),
    );
  }

  // Format into clean view model matching the UI wireframe
  const formatted = quants.map((q) => {
    // Check if item is below minimum reordering threshold
    const warehouseRule = q.product.reordering_rules?.find(
      (r) =>
        q.location.warehouse &&
        r.warehouse.toString() === q.location.warehouse._id.toString(),
    );

    const minQty = warehouseRule ? warehouseRule.min_quantity : 0;
    const isLowStock = q.quantity <= minQty;

    return {
      id: q._id,
      productId: q.product._id,
      productName: q.product.name,
      sku: q.product.sku,
      category: q.product.category?.name || "Uncategorized",
      uom: q.product.uom,
      locationId: q.location._id,
      locationName: q.location.name,
      locationCode: q.location.code,
      warehouseName: q.location.warehouse?.name || "N/A",
      warehouseCode: q.location.warehouse?.code || "N/A",
      onHand: q.quantity,
      reserved: q.reserved_quantity,
      freeToUse: q.free_to_use,
      isLowStock,
      minThreshold: minQty,
    };
  });

  res.status(200).json({
    success: true,
    count: formatted.length,
    data: formatted,
  });
});
