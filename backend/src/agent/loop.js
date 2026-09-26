// Task 7: the agentic streamText loop — wire the typed, guarded tools into a
// Vercel AI SDK agent loop against the yolo-auto provider, with conversation
// persistence and mode-aware authorization.
//
// The unit tests must run WITHOUT hitting the real network, so the loop is
// factored into two layers:
//   * pure, injectable helpers (buildMessages, buildSystemPrompt,
//     getOperationFor, executeToolCall, reshapeToolsForSDK) that a fake model
//     can drive with zero network IO, and
//   * runAgentTurn, which wires them together and persists the turn.
import { streamText, zodSchema } from 'ai';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';

import { makeModel } from './provider.js';
import { createTools } from './tools.js';
import {
  loadConversation,
  newConversation,
  appendMessage,
  getMode,
  ForbiddenActionError as PersistForbiddenError,
} from './persist.js';
import { ForbiddenActionError as GuardForbiddenError } from './guard.js';
import {
  assertPort,
  PortNotImplementedError,
} from '../services/inventory/port.js';
import { createMockPort } from '../services/inventory/mockPort.js';

// --- error classification ---------------------------------------------------

// Is an exception one of the agent-refusal signals the loop must convert into
// a helpful reply rather than rethrowing?
export function isRefusalError(err) {
  return (
    err instanceof GuardForbiddenError ||
    err instanceof PersistForbiddenError ||
    err instanceof PortNotImplementedError ||
    err?.name === 'ForbiddenActionError'
  );
}

function refusalReason(err) {
  const msg = err?.message || String(err);
  const kind = err?.name === 'ForbiddenActionError' ? 'refused' : 'unavailable';
  return `[${kind}] ${msg}`;
}

// Result payload returned by a refused tool so streamText keeps flowing.
function refusalPayload(err) {
  return { ok: false, refused: true, reason: refusalReason(err) };
}

// --- userId normalization ---------------------------------------------------
// The Conversation model stores `user` as a required ObjectId. Real deployments
// pass a Mongo ObjectId; the smoke test and some unit tests pass plain strings
// ('u1'), which mongoose cannot cast. Since the loop only ever looks a
// conversation up by conversationId, we deterministically map non-ObjectId
// strings to a valid 24-hex ObjectId so creation never fails while remaining
// stable for the same logical user.
function toUserId(userId) {
  if (!userId) throw new Error('userId is required');
  const s = String(userId);
  if (mongoose.isValidObjectId(s)) return s;
  return createHash('sha256').update(s).digest('hex').slice(0, 24);
}

// --- pure building blocks (unit-testable without a network) -----------------

/**
 * Map a persisted conversation's messages (persist.js {role, content,
 * toolCalls?}) onto AI SDK messages, then append the new user message.
 * toolCalls are folded into the assistant content so earlier tool work is
 * visible to the model on the next turn.
 */
export function buildMessages(conversation, userMessage) {
  const history = (conversation?.messages || []).map((m) => {
    let content = m.content ?? '';
    if (Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      const serialized = JSON.stringify(m.toolCalls);
      content = content ? `${content}\n${serialized}` : serialized;
    }
    return { role: m.role === 'user' ? 'user' : 'assistant', content };
  });
  return [...history, { role: 'user', content: userMessage }];
}

/**
 * The system prompt: who the agent is, its tools, the current mode + role, and
 * the hard rules the model must follow.
 */
export function buildSystemPrompt({ mode, role, tools }) {
  const toolLines = Object.entries(tools)
    .map(([name, t]) => `- ${name}: ${t.description ?? ''}`)
    .join('\n');

  return [
    'You are an inventory assistant for an Odoo-style warehousing system. ',
    'You help users search products, check quantities, and manage stock operations.',
    '',
    'AVAILABLE TOOLS:',
    toolLines,
    '',
    'CURRENT CONTEXT:',
    `- MODE: ${mode} (SAFE < REVIEW < AGENT — higher modes unlock riskier writes)`,
    `- ROLE: ${role ?? 'user'}`,
    '',
    'HARD RULES:',
    '1. NEVER guess a product or location from free text. Resolve it through the ',
    '   provided tools first. When a tool returns a disambiguation prompt, ASK the ',
    '   user which option they mean — never assume.',
    '2. Every write operation MUST provide a modelReason explaining why it was done.',
    '3. validate_operation requires the EXACT confirmReference of the target ',
    '   operation. Do not fabricate it — if you do not know it, ask the user.',
    '4. Respect the current MODE and the acting ROLE: refuse actions that would ',
    '   exceed what MODE/ROLE permit, and say so clearly.',
    '',
    'Answer concisely in plain language.',
  ].join('\n');
}

/**
 * The port exposes no reference getter, so validate_operation needs an injected
 * operationLookup. Today only the mock port exists, so this scans its injected
 * `_data.operations` (documented as the only implementation available now;
 * a real InventoryPort can supply its own lookup later).
 */
export async function getOperationFor(port, operationId) {
  const data = port?._data;
  if (!data || !Array.isArray(data.operations)) return null;
  return (
    data.operations.find(
      (op) => op.id === operationId || op.reference === operationId,
    ) ?? null
  );
}

/**
 * Invoke a single tool's .execute for a tool name + validated args. This is the
 * testable pure layer: it lets a test drive the tool-call -> execute -> result
 * path directly, asserting refusals/disambiguations without any model call.
 */
export async function executeToolCall(tools, toolName, args) {
  const t = tools?.[toolName];
  if (!t || typeof t.execute !== 'function') {
    throw new PortNotImplementedError(`tool "${toolName}" is not available`);
  }
  return t.execute(args ?? {});
}

/**
 * Reshape createTools()' ai.tool()-shaped objects (which expose `description`
 * + `inputSchema` + `execute`) into the shape streamText expects for a tool
 * (`type`, `parameters` as a zod Schema). Also wraps execute so a refusal is
 * returned as a RESULT instead of a thrown SDK error, keeping the stream
 * flowing with a helpful reply.
 */
export function reshapeToolsForSDK(tools, { wrapRefusals = true } = {}) {
  const reshaped = {};
  for (const [name, t] of Object.entries(tools)) {
    const execute = async (args) => {
      try {
        return await t.execute(args);
      } catch (err) {
        if (wrapRefusals && isRefusalError(err)) return refusalPayload(err);
        throw err;
      }
    };
    reshaped[name] = {
      type: 'function',
      description: t.description,
      parameters: zodSchema(t.inputSchema),
      execute,
    };
  }
  return reshaped;
}

// --- the agentic turn -------------------------------------------------------

/**
 * Run one agent turn: load/create the conversation, build the guarded tools,
 * drive a single streamText step (tools auto-executed by the SDK), collect the
 * streamed text + tool record, persist user + assistant messages, and return
 * { text, mode, toolCalls, conversationId }.
 *
 * A ForbiddenActionError or PortNotImplementedError anywhere in the path is
 * converted into a helpful { text: [...], ... } reply rather than thrown.
 */
// The Conversation schema requires a non-empty `content`. A single-step agent
// turn often yields no trailing text (the model just fired a tool), so we fall
// back to a descriptive reply built from the recorded tool outcomes.
function assistantContent(text, toolCalls) {
  if (text && text.trim()) return text;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return toolCalls
      .map((rec) => {
        const result = JSON.stringify(rec.result ?? {});
        return `${rec.name} -> ${result}`;
      })
      .join('\n');
  }
  return 'No response generated.';
}

export async function runAgentTurn({ role, userId, conversationId, userMessage, model, port }) {
  port = port ?? createMockPort();
  assertPort(port);

  // Load the requested conversation, else start a new one for this user.
    let conv = conversationId ? await loadConversation(conversationId) : null;
    if (conv && String(conv.user) !== String(toUserId(userId))) {
      // The conversation belongs to someone else — treat it as not found so a
      // caller can never read or continue another user's chat history (IDOR).
      conv = null;
    }
    if (!conv) {
      conv = await newConversation(toUserId(userId));
      conversationId = conv._id;
    } else {
      conversationId = conv._id;
    }

  const mode = (await getMode(conversationId)) || 'SAFE';

  const tools = createTools({
    port,
    getMode: async () => getMode(conversationId),
    getRole: async () => role,
    currentUserId: userId,
    operationLookup: async (operationId) => getOperationFor(port, operationId),
  });

  const system = buildSystemPrompt({ mode, role, tools });
  const messages = buildMessages(conv, userMessage);
  const modelInstance = model || makeModel();

  const toolCalls = [];
  const toolCallsById = new Map();
  let text = '';

  try {
    const result = streamText({
      model: modelInstance,
      tools: reshapeToolsForSDK(tools),
      system,
      messages,
    });

    // Aggregate the streamed output ourselves (more robust than the SDK's
    // result.text getter across fake and real models alike).
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        text += part.textDelta;
      } else if (part.type === 'tool-call') {
        const rec = { name: part.toolName, args: part.args, result: undefined };
        toolCallsById.set(part.toolCallId, rec);
        toolCalls.push(rec);
      } else if (part.type === 'tool-result') {
        const rec = toolCallsById.get(part.toolCallId);
        if (rec) rec.result = part.error ? { error: String(part.error) } : part.result;
      }
    }
  } catch (err) {
    if (isRefusalError(err)) {
      return {
        text: refusalReason(err),
        mode,
        toolCalls: [],
        conversationId,
        refused: true,
      };
    }
    throw err;
  }

  // Persist the turn: the user's message and the assistant's reply.
  await appendMessage(conversationId, { role: 'user', content: userMessage });
  const finalReply = assistantContent(text, toolCalls);
  await appendMessage(conversationId, {
    role: 'assistant',
    content: finalReply,
    toolCalls,
  });

  return { text: finalReply, mode, toolCalls, conversationId };
}