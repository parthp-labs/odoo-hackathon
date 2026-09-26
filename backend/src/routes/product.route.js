import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  setReorderingRule,
} from '../controllers/product.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getProducts)
  .post(authorize('admin', 'inventory_manager'), createProduct);

router.post('/:id/reordering-rule', authorize('admin', 'inventory_manager'), setReorderingRule);

router
  .route('/:id')
  .get(getProductById)
  .put(authorize('admin', 'inventory_manager'), updateProduct)
  .delete(authorize('admin', 'inventory_manager'), deleteProduct);

export default router;
