import express from 'express';
import {
  getDashboardKPIs,
  getDashboardOperations,
  getLowStockAlerts,
} from '../controllers/dashboard.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/kpis', getDashboardKPIs);
router.get('/operations', getDashboardOperations);
router.get('/low-stock', getLowStockAlerts);

export default router;
