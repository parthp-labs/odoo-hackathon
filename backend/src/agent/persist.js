// Conversation persistence helpers — thin async wrappers over the
// Conversation model. Mode changes are validated against the acting role's
// ceiling using src/agent/modes.js (ceiling + canEscalateTo).
//
// Design decision (documented per task spec): setMode REFUSES an illegal
// escalation to a mode above the role's ceiling by THROWING ForbiddenActionError
// (not by returning {ok:false, reason}). This lets callers take the non-2xx
// path via try/catch and keeps the happy path return value as simply the
// updated document.
import { canEscalateTo, ceiling } from './modes.js';
import Conversation from '../models/conversation.model.js';

export class ForbiddenActionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenActionError';
  }
}

// Returns the conversation document, or null when it does not exist.
export async function loadConversation(id) {
  return Conversation.findById(id);
}

// Creates a new conversation for a user, returning the saved document.
export async function newConversation(userId, { title = '' } = {}) {
  return Conversation.create({ user: userId, title });
}

// Pushes a message onto the conversation's timeline and persists it.
// `msg` is { role, content, toolCalls?, createdAt? }.
export async function appendMessage(convId, msg) {
  const conv = await Conversation.findById(convId);
  if (!conv) return null;
  conv.messages.push(msg);
  await conv.save();
  return conv;
}

// Set a conversation's mode on behalf of `role`. Raising the mode above the
// role's ceiling is refused (throws ForbiddenActionError); lowering or staying
// put is always allowed. Returns the updated conversation.
export async function setMode(convId, mode, role) {
  const conv = await Conversation.findById(convId);
  if (!conv) return null;

  if (!canEscalateTo(conv.mode, mode, role)) {
    const msg =
      `role "${role}" may not escalate conversation ${convId} ` +
      `from ${conv.mode} to ${mode} (ceiling: ${ceiling(role)})`;
    throw new ForbiddenActionError(msg);
  }

  conv.mode = mode;
  await conv.save();
  return conv;
}

// Returns the current mode string, or null when the conversation is missing.
export async function getMode(convId) {
  const conv = await Conversation.findById(convId);
  return conv ? conv.mode : null;
}