import express from 'express';
import {
  getStockAvailability,
  getWarehouseRackLayout,
} from '../controllers/stockQuant.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getStockAvailability);
router.get('/rack-layout', getWarehouseRackLayout);

export default router;
