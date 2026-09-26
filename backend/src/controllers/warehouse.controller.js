import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import Warehouse from '../models/warehouse.model.js';
import Location from '../models/location.model.js';

// @desc    Get all warehouses
// @route   GET /api/warehouses
// @access  Private
export const getWarehouses = asyncHandler(async (req, res, next) => {
  const warehouses = await Warehouse.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: warehouses.length,
    data: warehouses,
  });
});

// @desc    Get single warehouse by ID
// @route   GET /api/warehouses/:id
// @access  Private
export const getWarehouseById = asyncHandler(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new ErrorResponse(`Warehouse not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: warehouse,
  });
});

// @desc    Create new warehouse
// @route   POST /api/warehouses
// @access  Private (Admin / Manager)
export const createWarehouse = asyncHandler(async (req, res, next) => {
  const { name, code, address } = req.body;

  if (!name || !code) {
    return next(new ErrorResponse('Please provide warehouse name and code', 400));
  }

  const warehouse = await Warehouse.create({
    name,
    code: code.toUpperCase().trim(),
    address,
  });

  // Automatically create a default internal 'Stock' location for this warehouse
  await Location.create({
    warehouse: warehouse._id,
    name: 'Stock',
    code: `${warehouse.code}/STOCK`,
    location_type: 'internal',
  });

  res.status(201).json({
    success: true,
    data: warehouse,
  });
});

// @desc    Update warehouse
// @route   PUT /api/warehouses/:id
// @access  Private (Admin / Manager)
export const updateWarehouse = asyncHandler(async (req, res, next) => {
  const { name, code, address } = req.body;

  let warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new ErrorResponse(`Warehouse not found with id of ${req.params.id}`, 404));
  }

  warehouse.name = name || warehouse.name;
  if (code) warehouse.code = code.toUpperCase().trim();
  if (address !== undefined) warehouse.address = address;

  await warehouse.save();

  res.status(200).json({
    success: true,
    data: warehouse,
  });
});

// @desc    Delete warehouse
// @route   DELETE /api/warehouses/:id
// @access  Private (Admin)
export const deleteWarehouse = asyncHandler(async (req, res, next) => {
  const warehouse = await Warehouse.findById(req.params.id);

  if (!warehouse) {
    return next(new ErrorResponse(`Warehouse not found with id of ${req.params.id}`, 404));
  }

  // Delete attached locations
  await Location.deleteMany({ warehouse: warehouse._id });
  await warehouse.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Warehouse and associated locations deleted successfully',
  });
});
