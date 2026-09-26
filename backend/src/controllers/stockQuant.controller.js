import asyncHandler from "../middlewares/async.middleware.js";
import ErrorResponse from "../utils/errorResponse.js";
import StockQuant from "../models/stockQuant.model.js";
import Location from "../models/location.model.js";
import Warehouse from "../models/warehouse.model.js";

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

// @desc    Get real-world visual warehouse rack and shelf layout with stored products
// @route   GET /api/stock/rack-layout
// @access  Private
export const getWarehouseRackLayout = asyncHandler(async (req, res, next) => {
  const { warehouse: warehouseId } = req.query;

  // 1. Determine active warehouse
  let targetWarehouse;
  if (warehouseId) {
    targetWarehouse = await Warehouse.findById(warehouseId);
    if (!targetWarehouse) {
      return next(new ErrorResponse(`Warehouse not found with id ${warehouseId}`, 404));
    }
  } else {
    targetWarehouse = await Warehouse.findOne().sort({ createdAt: 1 });
    if (!targetWarehouse) {
      return next(new ErrorResponse("No warehouses configured in system", 404));
    }
  }

  // 2. Fetch all internal locations under this warehouse
  const internalLocations = await Location.find({
    warehouse: targetWarehouse._id,
    location_type: "internal",
    is_active: true,
  }).sort({ zone: 1, aisle: 1, rack: 1, position_index: 1, shelf: 1 });

  const locationIds = internalLocations.map((l) => l._id);

  // 3. Fetch all active stock quants at these locations with product details
  const quants = await StockQuant.find({
    location: { $in: locationIds },
    quantity: { $gt: 0 },
  }).populate({
    path: "product",
    select: "name sku uom category is_active reordering_rules description",
    populate: { path: "category", select: "name" },
  });

  // 4. Map quants to their respective shelf location
  const locationQuantsMap = new Map();
  for (const q of quants) {
    if (!q.product || !q.product.is_active) continue;
    const locId = q.location.toString();
    if (!locationQuantsMap.has(locId)) {
      locationQuantsMap.set(locId, []);
    }

    const warehouseRule = q.product.reordering_rules?.find(
      (r) => r.warehouse.toString() === targetWarehouse._id.toString()
    );
    const minQty = warehouseRule ? warehouseRule.min_quantity : 0;

    locationQuantsMap.get(locId).push({
      productId: q.product._id,
      name: q.product.name,
      sku: q.product.sku,
      category: q.product.category?.name || "General",
      uom: q.product.uom,
      description: q.product.description || "",
      onHand: q.quantity,
      reserved: q.reserved_quantity,
      freeToUse: q.free_to_use,
      isLowStock: q.quantity <= minQty,
      minThreshold: minQty,
    });
  }

  // 5. Structure into Zones -> Racks -> Shelves hierarchy
  const zonesMap = new Map();

  for (const loc of internalLocations) {
    const zoneName = loc.zone || "Zone A";
    const rackName = loc.rack || loc.name.split(" ")[0] || "Rack 1";
    const shelfName = loc.shelf || loc.name;
    const maxCapacity = loc.max_capacity || 500;

    const storedProducts = locationQuantsMap.get(loc._id.toString()) || [];
    const totalStoredUnits = storedProducts.reduce((sum, p) => sum + p.onHand, 0);
    const occupancyPercentage = Math.min(
      100,
      Math.round((totalStoredUnits / maxCapacity) * 100)
    );

    let status = "empty";
    if (occupancyPercentage >= 90) status = "full";
    else if (occupancyPercentage > 0) status = "occupied";

    const shelfData = {
      locationId: loc._id,
      code: loc.code,
      name: loc.name,
      shelfLevel: shelfName,
      aisle: loc.aisle || "A1",
      positionIndex: loc.position_index || 1,
      maxCapacity,
      totalStoredUnits,
      occupancyPercentage,
      status, // 'empty' | 'occupied' | 'full'
      productsCount: storedProducts.length,
      products: storedProducts,
    };

    if (!zonesMap.has(zoneName)) {
      zonesMap.set(zoneName, new Map());
    }

    const racksMap = zonesMap.get(zoneName);
    if (!racksMap.has(rackName)) {
      racksMap.set(rackName, []);
    }
    racksMap.get(rackName).push(shelfData);
  }

  // 6. Convert maps to clean JSON response for visual rendering
  const zones = [];
  let totalWarehouseStoredUnits = 0;
  let totalShelvesCount = 0;
  let occupiedShelvesCount = 0;

  for (const [zoneName, racksMap] of zonesMap.entries()) {
    const racks = [];
    for (const [rackName, shelves] of racksMap.entries()) {
      // Sort shelves by position or shelf name
      shelves.sort((a, b) => a.positionIndex - b.positionIndex || a.shelfLevel.localeCompare(b.shelfLevel));
      
      const rackUnits = shelves.reduce((sum, s) => sum + s.totalStoredUnits, 0);
      const rackCapacity = shelves.reduce((sum, s) => sum + s.maxCapacity, 0);

      racks.push({
        rackId: rackName,
        rackName,
        totalShelves: shelves.length,
        totalStoredUnits: rackUnits,
        totalCapacity: rackCapacity,
        shelves,
      });

      totalWarehouseStoredUnits += rackUnits;
      totalShelvesCount += shelves.length;
      occupiedShelvesCount += shelves.filter((s) => s.status !== "empty").length;
    }

    zones.push({
      zoneName,
      totalRacks: racks.length,
      racks,
    });
  }

  res.status(200).json({
    success: true,
    warehouse: {
      id: targetWarehouse._id,
      name: targetWarehouse.name,
      code: targetWarehouse.code,
      address: targetWarehouse.address,
    },
    summary: {
      totalZones: zones.length,
      totalShelves: totalShelvesCount,
      occupiedShelves: occupiedShelvesCount,
      emptyShelves: totalShelvesCount - occupiedShelvesCount,
      totalStoredUnits: totalWarehouseStoredUnits,
      utilizationRate: totalShelvesCount > 0 ? Math.round((occupiedShelvesCount / totalShelvesCount) * 100) : 0,
    },
    data: zones,
  });
});
