import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/productCategory.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getCategories)
  .post(authorize('admin', 'inventory_manager'), createCategory);

router
  .route('/:id')
  .get(getCategoryById)
  .put(authorize('admin', 'inventory_manager'), updateCategory)
  .delete(authorize('admin'), deleteCategory);

export default router;
