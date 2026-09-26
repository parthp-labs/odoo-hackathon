import express from 'express';
import { handleChatMessage } from '../controllers/chatbot.controller.js';

const router = express.Router();

router.post('/message', handleChatMessage);
router.post('/chat', handleChatMessage);

export default router;
