import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  getRecommendations,
  getForecast,
  getModelInfo,
  runRefit,
  getProductVendors,
  searchVendors,
} from '../controllers/replenishment.controller.js';

const router = express.Router();

// Replenishment flow (all protected).
router.get('/replenishment/recommendations', protect, getRecommendations);
router.get('/replenishment/forecast/:sku', protect, getForecast);
router.get('/replenishment/model-info', protect, getModelInfo);
router.post('/replenishment/run', protect, runRefit);

// Vendor search.
router.get('/product/:sku/vendors', protect, getProductVendors);
router.get('/vendors/search', protect, searchVendors);

export default router;