import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { chat } from '../controllers/agent.controller.js';

const router = express.Router();

// Chat with the inventory LLM agent (protected).
router.post('/chat', protect, chat);

export default router;