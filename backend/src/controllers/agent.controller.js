import asyncHandler from '../middlewares/async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import { runAgentTurn } from '../agent/loop.js';
import { canEscalateTo } from '../agent/modes.js';
import { createDbPort } from '../services/inventory/dbPort.js';

// @desc    Chat with the inventory LLM agent
// @route   POST /api/agent/chat
// @access  Private (requires Bearer token)
export const chat = asyncHandler(async (req, res, next) => {
  const { message, conversationId, mode } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return next(new ErrorResponse('Please provide a message', 400));
  }

  // If the client requests a mode, it must be within the acting role's ceiling.
  // The agent currently starts at SAFE, so escalation is validated from there.
  if (mode) {
    if (!canEscalateTo('SAFE', mode, req.user.role)) {
      return next(
        new ErrorResponse(
          `Role "${req.user.role}" may not escalate agent mode to "${mode}"`,
          400,
        ),
      );
    }
  }

  const result = await runAgentTurn({
      role: req.user.role,
      userId: String(req.user._id),
      conversationId,
      userMessage: message,
      port: createDbPort(),
    });

    res.status(200).json({
      success: true,
      data: {
        text: result.text,
        mode: result.mode,
        toolCalls: result.toolCalls,
        conversationId: result.conversationId,
      },
    });
  });