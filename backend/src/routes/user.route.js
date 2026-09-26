import express from 'express';
import { getMe, updateProfile, getUsers } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/me', getMe);
router.put('/me', updateProfile);
router.get('/', getUsers);

export default router;
