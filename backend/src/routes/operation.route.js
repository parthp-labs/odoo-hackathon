import express from 'express';
import {
  getOperations,
  getOperationById,
  createOperation,
  updateOperation,
  updateLineQuantity,
  validateOperation,
  cancelOperation,
  markOperationReady,
} from '../controllers/stockOperation.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getOperations).post(createOperation);
router.route('/:id').get(getOperationById).put(updateOperation);
router.patch('/:id/lines/:lineId', updateLineQuantity);
router.post('/:id/mark-ready', markOperationReady);
router.post('/:id/validate', validateOperation);
router.post('/:id/cancel', cancelOperation);

export default router;
