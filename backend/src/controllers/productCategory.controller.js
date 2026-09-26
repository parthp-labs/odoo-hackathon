import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import ProductCategory from '../models/productCategory.model.js';
import Product from '../models/product.model.js';

// @desc    Get all product categories (hierarchical parent-child support)
// @route   GET /api/categories
// @access  Private
export const getCategories = asyncHandler(async (req, res, next) => {
  const categories = await ProductCategory.find()
    .populate('parent', 'name')
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: categories.length,
    data: categories,
  });
});

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Private
export const getCategoryById = asyncHandler(async (req, res, next) => {
  const category = await ProductCategory.findById(req.params.id).populate('parent', 'name');

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

// @desc    Create category
// @route   POST /api/categories
// @access  Private (Admin / Manager)
export const createCategory = asyncHandler(async (req, res, next) => {
  const { name, parent, description } = req.body;

  if (!name) {
    return next(new ErrorResponse('Please provide a category name', 400));
  }

  const category = await ProductCategory.create({
    name,
    parent: parent || null,
    description: description || '',
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin / Manager)
export const updateCategory = asyncHandler(async (req, res, next) => {
  const { name, parent, description } = req.body;

  let category = await ProductCategory.findById(req.params.id);

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  category.name = name || category.name;
  if (parent !== undefined) category.parent = parent || null;
  if (description !== undefined) category.description = description;

  await category.save();

  res.status(200).json({
    success: true,
    data: category,
  });
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
export const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await ProductCategory.findById(req.params.id);

  if (!category) {
    return next(new ErrorResponse(`Category not found with id of ${req.params.id}`, 404));
  }

  // Check if any product belongs to this category
  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    return next(
      new ErrorResponse(
        `Cannot delete category. ${productCount} products are currently assigned to it.`,
        400
      )
    );
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Category deleted successfully',
  });
});
