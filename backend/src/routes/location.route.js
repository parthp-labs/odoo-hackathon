import express from 'express';
import {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
  initVirtualLocations,
} from '../controllers/location.controller.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect); // All location routes require authentication

router.post('/init-virtual', authorize('admin', 'inventory_manager'), initVirtualLocations);

router
  .route('/')
  .get(getLocations)
  .post(authorize('admin', 'inventory_manager'), createLocation);

router
  .route('/:id')
  .get(getLocationById)
  .put(authorize('admin', 'inventory_manager'), updateLocation)
  .delete(authorize('admin'), deleteLocation);

export default router;
