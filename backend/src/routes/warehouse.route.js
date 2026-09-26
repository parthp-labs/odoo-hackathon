import express from 'express';
import {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from '../controllers/warehouse.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect); // All warehouse routes require authentication

router
  .route('/')
  .get(getWarehouses)
  .post(authorize('admin', 'inventory_manager'), createWarehouse);

router
  .route('/:id')
  .get(getWarehouseById)
  .put(authorize('admin', 'inventory_manager'), updateWarehouse)
  .delete(authorize('admin'), deleteWarehouse);

export default router;
