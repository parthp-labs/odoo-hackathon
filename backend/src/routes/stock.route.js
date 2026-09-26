import express from 'express';
import { getStockAvailability } from '../controllers/stockQuant.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getStockAvailability);

export default router;
