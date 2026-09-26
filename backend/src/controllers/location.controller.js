import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import Location from '../models/location.model.js';

// Default virtual external locations needed by double-entry inventory flow
const DEFAULT_VIRTUAL_LOCATIONS = [
  { name: 'Vendors', code: 'PARTNER/VENDORS', location_type: 'vendor' },
  { name: 'Customers', code: 'PARTNER/CUSTOMERS', location_type: 'customer' },
  { name: 'Inventory Loss / Scrap', code: 'VIRTUAL/LOSS', location_type: 'inventory_loss' },
  { name: 'Transit Location', code: 'VIRTUAL/TRANSIT', location_type: 'transit' },
];

// @desc    Get all locations (supports filtering by warehouse, location_type)
// @route   GET /api/locations
// @access  Private
export const getLocations = asyncHandler(async (req, res, next) => {
  const { warehouse, location_type, is_active } = req.query;

  const query = {};
  if (warehouse) query.warehouse = warehouse;
  if (location_type) query.location_type = location_type;
  if (is_active !== undefined) query.is_active = is_active === 'true';

  const locations = await Location.find(query)
    .populate('warehouse', 'name code')
    .populate('parent_location', 'name code')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: locations.length,
    data: locations,
  });
});

// @desc    Get single location by ID
// @route   GET /api/locations/:id
// @access  Private
export const getLocationById = asyncHandler(async (req, res, next) => {
  const location = await Location.findById(req.params.id)
    .populate('warehouse', 'name code address')
    .populate('parent_location', 'name code');

  if (!location) {
    return next(new ErrorResponse(`Location not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: location,
  });
});

// @desc    Create new location (internal rack/shelf or external)
// @route   POST /api/locations
// @access  Private (Admin / Manager)
export const createLocation = asyncHandler(async (req, res, next) => {
  const { warehouse, parent_location, name, code, location_type } = req.body;

  if (!name || !code) {
    return next(new ErrorResponse('Please provide location name and code', 400));
  }

  const location = await Location.create({
    warehouse: warehouse || null,
    parent_location: parent_location || null,
    name,
    code: code.toUpperCase().trim(),
    location_type: location_type || 'internal',
  });

  res.status(201).json({
    success: true,
    data: location,
  });
});

// @desc    Update location
// @route   PUT /api/locations/:id
// @access  Private (Admin / Manager)
export const updateLocation = asyncHandler(async (req, res, next) => {
  const { name, code, parent_location, is_active } = req.body;

  let location = await Location.findById(req.params.id);

  if (!location) {
    return next(new ErrorResponse(`Location not found with id of ${req.params.id}`, 404));
  }

  location.name = name || location.name;
  if (code) location.code = code.toUpperCase().trim();
  if (parent_location !== undefined) location.parent_location = parent_location || null;
  if (is_active !== undefined) location.is_active = is_active;

  await location.save();

  res.status(200).json({
    success: true,
    data: location,
  });
});

// @desc    Delete location
// @route   DELETE /api/locations/:id
// @access  Private (Admin)
export const deleteLocation = asyncHandler(async (req, res, next) => {
  const location = await Location.findById(req.params.id);

  if (!location) {
    return next(new ErrorResponse(`Location not found with id of ${req.params.id}`, 404));
  }

  await location.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Location deleted successfully',
  });
});

// @desc    Ensure default virtual locations exist (Vendors, Customers, Loss)
// @route   POST /api/locations/init-virtual
// @access  Private (Admin / Manager)
export const initVirtualLocations = asyncHandler(async (req, res, next) => {
  const created = [];

  for (const vLoc of DEFAULT_VIRTUAL_LOCATIONS) {
    const existing = await Location.findOne({ code: vLoc.code });
    if (!existing) {
      const loc = await Location.create(vLoc);
      created.push(loc);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Default virtual locations verified / initialized',
    createdCount: created.length,
  });
});
