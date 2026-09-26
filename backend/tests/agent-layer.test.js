import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LADDER,
  MAX_BY_ROLE,
  level,
  ceiling,
  canEscalateTo,
  ACTION_MIN_LEVEL,
} from '../src/agent/modes.js';
import { authorize, ForbiddenActionError } from '../src/agent/guard.js';
import {
  resolveEntity,
  promptForDisambiguation,
} from '../src/agent/entityResolution.js';
import { createMockPort } from '../src/services/inventory/mockPort.js';
import { createTools } from '../src/agent/tools.js';
import {
  buildSystemPrompt,
  buildMessages,
  getOperationFor,
  executeToolCall,
  reshapeToolsForSDK,
  isRefusalError,
} from '../src/agent/loop.js';
import { PortNotImplementedError } from '../src/services/inventory/port.js';

// --- modes ------------------------------------------------------------------
describe('modes', () => {
  it('ladder is SAFE < REVIEW < AGENT', () => {
    assert.deepEqual(LADDER, ['SAFE', 'REVIEW', 'AGENT']);
    assert.equal(level('SAFE'), 0);
    assert.equal(level('REVIEW'), 1);
    assert.equal(level('AGENT'), 2);
    assert.equal(level('BOGUS'), -1);
  });

  it('role ceilings', () => {
    assert.equal(ceiling('admin'), 'AGENT');
    assert.equal(ceiling('inventory_manager'), 'REVIEW');
    assert.equal(ceiling('warehouse_staff'), 'SAFE');
    assert.equal(ceiling('mystery_role'), 'SAFE');
  });

  it('canEscalateTo permits descent always, escalation only within ceiling', () => {
    // warehouse_staff may stay at or drop to SAFE, but not rise to REVIEW/AGENT.
    assert.equal(canEscalateTo('SAFE', 'SAFE', 'warehouse_staff'), true);
    assert.equal(canEscalateTo('AGENT', 'SAFE', 'warehouse_staff'), true);
    assert.equal(canEscalateTo('SAFE', 'REVIEW', 'warehouse_staff'), false);
    assert.equal(canEscalateTo('SAFE', 'AGENT', 'warehouse_staff'), false);
    // admin may rise all the way to AGENT.
    assert.equal(canEscalateTo('SAFE', 'AGENT', 'admin'), true);
    // inventory_manager may rise to REVIEW, but not AGENT.
    assert.equal(canEscalateTo('SAFE', 'REVIEW', 'inventory_manager'), true);
    assert.equal(canEscalateTo('SAFE', 'AGENT', 'inventory_manager'), false);
  });

  it('ACTION_MIN_LEVEL baseline', () => {
    assert.equal(ACTION_MIN_LEVEL.read, 0);
    assert.equal(ACTION_MIN_LEVEL.create_draft, 0);
    assert.equal(ACTION_MIN_LEVEL.validate, 1);
    assert.equal(ACTION_MIN_LEVEL.cancel, 2);
  });
});

// --- guard ------------------------------------------------------------------
describe('guard.authorize', () => {
  it('read is authorized at SAFE for every role', () => {
    for (const role of ['admin', 'inventory_manager', 'warehouse_staff']) {
      assert.equal(authorize({ action: 'read', mode: 'SAFE', role }), true, role);
    }
  });

  it('validate is denied at SAFE but allowed at REVIEW for inventory_manager', () => {
    assert.equal(authorize({ action: 'validate', mode: 'SAFE', role: 'inventory_manager' }), false);
    assert.equal(authorize({ action: 'validate', mode: 'REVIEW', role: 'inventory_manager' }), true);
    // warehouse_staff ceiling is SAFE, so validate is impossible even at REVIEW.
    assert.equal(authorize({ action: 'validate', mode: 'REVIEW', role: 'warehouse_staff' }), false);
  });

  it('cancel needs AGENT + admin', () => {
    assert.equal(authorize({ action: 'cancel', mode: 'AGENT', role: 'admin' }), true);
    assert.equal(authorize({ action: 'cancel', mode: 'REVIEW', role: 'admin' }), false);
    assert.equal(authorize({ action: 'cancel', mode: 'AGENT', role: 'inventory_manager' }), false);
  });

  it('unknown action throws', () => {
    assert.throws(() => authorize({ action: 'nope', mode: 'SAFE', role: 'admin' }), /unknown action/);
  });
});

// --- entity resolution ------------------------------------------------------
describe('entityResolution', () => {
  const mockCatalog = [
    { id: 'prod-1', name: 'Blue Widget', sku: 'BLU-001' },
    { id: 'prod-2', name: 'Red Gadget', sku: 'RED-002' },
    { id: 'prod-3', name: 'Green Spanner', sku: 'GRN-003' },
  ];

  it('exact SKU resolves unambiguously', () => {
    const r = resolveEntity({ queryText: 'BLU-001', catalog: mockCatalog, key: 'sku' });
    assert.equal(r.ambiguous, false);
    assert.ok(r.resolved);
    assert.equal(r.resolved.id, 'prod-1');
  });

  it('a generic term shared by multiple items is ambiguous', () => {
    const catalog = [
      { id: 'a', name: 'Blue Widget', sku: 'BLU-001' },
      { id: 'b', name: 'Red Widget', sku: 'RED-002' },
    ];
    const r = resolveEntity({ queryText: 'widget', catalog, key: 'sku' });
    assert.equal(r.ambiguous, true);
    assert.equal(r.resolved, null);
    assert.ok(r.candidates.length >= 2);
  });

  it('no match is ambiguous with no candidates', () => {
    const r = resolveEntity({ queryText: 'zzz-nothing', catalog: mockCatalog, key: 'sku' });
    assert.equal(r.ambiguous, true);
    assert.equal(r.resolved, null);
    assert.deepEqual(r.candidates, []);
  });

  it('promptForDisambiguation renders candidate labels', () => {
    assert.equal(
      promptForDisambiguation([{ name: 'Blue Widget' }, { name: 'Red Widget' }]),
      'Did you mean: Blue Widget, Red Widget?',
    );
    assert.equal(promptForDisambiguation([]), 'Did you mean...? No clear match found.');
  });
});

// --- mockPort ---------------------------------------------------------------
describe('mockPort', () => {
  it('implements every PORT_METHOD as a function', () => {
    const port = createMockPort();
    for (const m of ['searchProducts', 'listLocations', 'createOperation', 'validateOperation', 'cancelOperation', 'getQuant']) {
      assert.equal(typeof port[m], 'function', m);
    }
  });

  it('searchProducts is case-insensitive by name/sku', async () => {
    const port = createMockPort();
    assert.deepEqual((await port.searchProducts({ text: 'widget' })).map((p) => p.id), ['prod-1']);
    assert.deepEqual((await port.searchProducts({ text: 'blu-001' })).map((p) => p.id), ['prod-1']);
    assert.deepEqual(await port.searchProducts({ text: 'nothing' }), []);
  });

  it('createOperation builds a draft and returns id + reference', async () => {
    const port = createMockPort();
    const { id, reference } = await port.createOperation({ productId: 'prod-2', locationId: 'loc-2', quantity: 3, createdBy: 'u1' });
    assert.ok(id);
    assert.match(reference, /^DRAFT-2$/);
    const created = port._data.operations.find((o) => o.id === id);
    assert.equal(created.status, 'draft');
    assert.equal(created.createdBy, 'u1');
  });

  it('validateOperation marks done and bumps the quant', async () => {
    const port = createMockPort();
    const before = await port.getQuant({ productId: 'prod-1', locationId: 'loc-1' });
    assert.deepEqual(before, { quantity: 0, reserved: 0 });
    const res = await port.validateOperation({ operationId: 'op-draft-1', confirmedBy: 'u1', modelReason: 'test' });
    assert.equal(res.ok, true);
    assert.equal(res.status, 'done');
    const after = await port.getQuant({ productId: 'prod-1', locationId: 'loc-1' });
    assert.equal(after.quantity, 5);
  });

  it('cancelOperation marks canceled', async () => {
    const port = createMockPort();
    const res = await port.cancelOperation({ operationId: 'op-draft-1', modelReason: 'test' });
    assert.equal(res.ok, true);
    assert.equal(res.status, 'canceled');
    assert.equal(port._data.operations.find((o) => o.id === 'op-draft-1').status, 'canceled');
  });
});

// --- tools (spy port) -------------------------------------------------------
// Wrap a mock port and record every call so tests can assert refusal paths
// never touch the port.
function spyPort() {
  const inner = createMockPort();
  const calls = { searchProducts: 0, listLocations: 0, createOperation: 0, validateOperation: 0, cancelOperation: 0, getQuant: 0 };
  const port = {
    get _data() { return inner._data; },
  };
  for (const m of Object.keys(calls)) {
    port[m] = async (...args) => {
      calls[m] += 1;
      return inner[m](...args);
    };
  }
  port._calls = calls;
  return port;
}

function makeTools({ mode, role, port, operationLookup }) {
  return createTools({
    port,
    getMode: async () => mode,
    getRole: async () => role,
    currentUserId: 'u1',
    operationLookup,
  });
}

describe('tools.createTools', () => {
  it('returns exactly 6 tool entries, each with a .execute function', () => {
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port: spyPort() });
    const names = ['search_products', 'list_locations', 'get_quant', 'create_draft_operation', 'validate_operation', 'cancel_operation'];
    assert.deepEqual(Object.keys(tools).sort(), [...names].sort());
    for (const name of names) {
      assert.equal(typeof tools[name].execute, 'function', name);
    }
  });

  it('read tools work at SAFE for warehouse_staff', async () => {
    const port = spyPort();
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port });
    const res = await tools.search_products.execute({ query: 'widget' });
    assert.deepEqual(res.results.map((p) => p.id), ['prod-1']);
    assert.equal(port._calls.searchProducts, 1);
  });

  it('validate_operation refuses on a wrong confirmReference WITHOUT touching the port', async () => {
    const port = spyPort();
    const tools = makeTools({
      mode: 'REVIEW',
      role: 'inventory_manager',
      port,
      operationLookup: async () => ({ reference: 'DRAFT-1' }),
    });
    const res = await tools.validate_operation.execute({
      operationId: 'op-draft-1',
      confirmReference: 'WRONG',
      modelReason: 'test',
    });
    assert.deepEqual(res, { ok: false, error: 'confirm_reference_mismatch' });
    assert.equal(port._calls.validateOperation, 0);
  });

  it('validate_operation accepts an exact match reference', async () => {
    const port = spyPort();
    const tools = makeTools({
      mode: 'REVIEW',
      role: 'inventory_manager',
      port,
      operationLookup: async () => ({ reference: 'DRAFT-1' }),
    });
    const res = await tools.validate_operation.execute({
      operationId: 'op-draft-1',
      confirmReference: 'DRAFT-1',
      modelReason: 'test',
    });
    assert.equal(res.ok, true);
    assert.equal(port._calls.validateOperation, 1);
  });

  it('cancel_operation is refused at mode SAFE (ForbiddenActionError)', async () => {
    const port = spyPort();
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port });
    await assert.rejects(
      tools.cancel_operation.execute({ operationId: 'op-draft-1', modelReason: 'test' }),
      ForbiddenActionError,
    );
    assert.equal(port._calls.cancelOperation, 0);
  });

  it('get_quant returns an ambiguous disambiguation instead of touching the port', async () => {
    const port = spyPort();
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port });
    const res = await tools.get_quant.execute({ productQuery: 'nothing-xyz', locationQuery: 'Main' });
    assert.equal(res.disambiguation, true);
    assert.equal(port._calls.getQuant, 0);
  });
});

// --- loop pure helpers ------------------------------------------------------
describe('loop pure helpers', () => {
  it('buildSystemPrompt includes mode, role, and tool descriptions', () => {
    const tools = createTools({ port: createMockPort(), getMode: async () => 'SAFE', getRole: async () => 'admin', currentUserId: 'u1' });
    const prompt = buildSystemPrompt({ mode: 'AGENT', role: 'admin', tools });
    assert.ok(prompt.includes('AGENT'));
    assert.ok(prompt.includes('admin'));
    assert.ok(prompt.includes('search_products'));
  });

  it('buildMessages appends the user message and folds toolCalls into assistant content', () => {
    const conversation = {
      messages: [
        { role: 'assistant', content: 'hi', toolCalls: [{ name: 'x', result: {} }] },
      ],
    };
    const msgs = buildMessages(conversation, 'next request');
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'assistant');
    assert.ok(msgs[0].content.includes('"name":"x"'));
    assert.equal(msgs[1].role, 'user');
    assert.equal(msgs[1].content, 'next request');
  });

  it('getOperationFor finds an operation by id or reference', async () => {
    const port = createMockPort();
    assert.equal((await getOperationFor(port, 'op-draft-1')).reference, 'DRAFT-1');
    assert.equal((await getOperationFor(port, 'DRAFT-1')).id, 'op-draft-1');
    assert.equal(await getOperationFor(port, 'missing'), null);
  });

  it('executeToolCall invokes a known tool and throws for an unknown one', async () => {
    const port = spyPort();
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port });
    const res = await executeToolCall(tools, 'search_products', { query: 'widget' });
    assert.deepEqual(res.results.map((p) => p.id), ['prod-1']);
    await assert.rejects(executeToolCall(tools, 'nope', {}), PortNotImplementedError);
  });

  it('reshapeToolsForSDK wraps refusals into a result payload', async () => {
    const port = spyPort();
    const tools = makeTools({ mode: 'SAFE', role: 'warehouse_staff', port });
    const renamed = reshapeToolsForSDK(tools);
    assert.ok(renamed.search_products.type, 'function');
    const refused = await renamed.cancel_operation.execute({ operationId: 'op-draft-1', modelReason: 'x' });
    assert.equal(refused.refused, true);
    assert.equal(refused.ok, false);
  });

  it('isRefusalError recognizes guard and port errors', () => {
    assert.equal(isRefusalError(new ForbiddenActionError('no')), true);
    assert.equal(isRefusalError(new PortNotImplementedError('no')), true);
    assert.equal(isRefusalError(new Error('plain')), false);
  });
});

// --- conversation model (import only; no DB hangs) --------------------------
describe('conversation model compile', () => {
  it('registers a Conversation model with SAFE default mode', async () => {
    const { default: Conversation } = await import('../src/models/conversation.model.js');
    assert.ok(Conversation);
    assert.equal(Conversation.modelName, 'Conversation');
    assert.equal(Conversation.schema.paths.mode.defaultValue, 'SAFE');
    assert.equal(Conversation.schema.paths.status.defaultValue, 'active');
  });
});