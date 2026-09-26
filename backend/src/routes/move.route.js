import express from 'express';
import { getMoveHistory } from '../controllers/stockMove.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getMoveHistory);

export default router;
