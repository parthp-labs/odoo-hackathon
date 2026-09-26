import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import Product from '../models/product.model.js';

// @desc    Get all products (supports category filter, smart search by SKU or Name)
// @route   GET /api/products
// @access  Private
export const getProducts = asyncHandler(async (req, res, next) => {
  const { category, search, is_active } = req.query;

  const query = {};

  if (category) {
    query.category = category;
  }

  if (is_active !== undefined) {
    query.is_active = is_active === 'true';
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
    ];
  }

  const products = await Product.find(query)
    .populate('category', 'name')
    .populate('reordering_rules.warehouse', 'name code')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Private
export const getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .populate('reordering_rules.warehouse', 'name code address');

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin / Manager)
export const createProduct = asyncHandler(async (req, res, next) => {
  const { name, sku, category, uom, description, reordering_rules } = req.body;

  if (!name || !sku) {
    return next(new ErrorResponse('Please provide product name and SKU', 400));
  }

  const product = await Product.create({
    name,
    sku: sku.toUpperCase().trim(),
    category: category || null,
    uom: uom || 'units',
    description: description || '',
    reordering_rules: reordering_rules || [],
  });

  res.status(201).json({
    success: true,
    data: product,
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin / Manager)
export const updateProduct = asyncHandler(async (req, res, next) => {
  const { name, sku, category, uom, description, is_active, reordering_rules } = req.body;

  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  product.name = name || product.name;
  if (sku) product.sku = sku.toUpperCase().trim();
  if (category !== undefined) product.category = category || null;
  if (uom) product.uom = uom;
  if (description !== undefined) product.description = description;
  if (is_active !== undefined) product.is_active = is_active;
  if (reordering_rules) product.reordering_rules = reordering_rules;

  await product.save();

  res.status(200).json({
    success: true,
    data: product,
  });
});

// @desc    Delete or deactivate product
// @route   DELETE /api/products/:id
// @access  Private (Admin / Manager)
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Soft deactivate so historical stock moves remain intact
  product.is_active = false;
  await product.save();

  res.status(200).json({
    success: true,
    message: 'Product deactivated successfully',
  });
});

// @desc    Set or update reordering rule for a product in a warehouse
// @route   POST /api/products/:id/reordering-rule
// @access  Private (Admin / Manager)
export const setReorderingRule = asyncHandler(async (req, res, next) => {
  const { warehouse_id, min_quantity, max_quantity } = req.body;

  if (!warehouse_id || min_quantity === undefined || max_quantity === undefined) {
    return next(new ErrorResponse('Please provide warehouse_id, min_quantity, and max_quantity', 400));
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorResponse(`Product not found with id of ${req.params.id}`, 404));
  }

  // Check if a rule for this warehouse already exists
  const existingRuleIndex = product.reordering_rules.findIndex(
    (rule) => rule.warehouse.toString() === warehouse_id.toString()
  );

  if (existingRuleIndex > -1) {
    product.reordering_rules[existingRuleIndex].min_quantity = min_quantity;
    product.reordering_rules[existingRuleIndex].max_quantity = max_quantity;
  } else {
    product.reordering_rules.push({
      warehouse: warehouse_id,
      min_quantity,
      max_quantity,
    });
  }

  await product.save();

  res.status(200).json({
    success: true,
    message: 'Reordering rule saved successfully',
    data: product.reordering_rules,
  });
});
