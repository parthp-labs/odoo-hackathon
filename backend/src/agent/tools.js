// Task 6: the typed, guarded, wallet-wrapped agent tool surface.
//
// Every tool exposed to the model is:
//   1. TYPED   — a zod input schema consumed by ai.tool() so the provider
//                validates arguments before execution.
//   2. GUARDED — the body calls requireFor(action, mode) which authorizes the
//                acting role at the *current* agent mode before doing anything
//                else, and throws ForbiddenActionError when refused.
//   3. WALLET-WRAPPED — write tools resolve every free-text product/location
//                query to a concrete id first; an ambiguous query short-circuits
//                to a DISAMBIGUATION payload (never a port mutation), and every
//                port write carries provenance (confirmedBy + modelReason).
//
// createTools() takes injected dependencies so tests can drive it with a spy
// port and fixed mode/role/user.
import { tool } from 'ai';
import { z } from 'zod';
import { authorize, ForbiddenActionError } from './guard.js';
import {
  resolveEntity,
  promptForDisambiguation,
} from './entityResolution.js';

// Tool name -> authorized action. The action drives both the minimum mode level
// (modes.js ACTION_MIN_LEVEL) and the role ceiling check.
const ACTION_FOR_TOOL = {
  search_products: 'read',
  list_locations: 'read',
  get_quant: 'read',
  create_draft_operation: 'create_draft',
  validate_operation: 'validate',
  cancel_operation: 'cancel',
};

function disambiguationPayload(candidates, action) {
  return {
    disambiguation: true,
    question: promptForDisambiguation(candidates),
    action,
  };
}

export function createTools({ port, getMode, getRole, currentUserId, operationLookup }) {
  const resolveRole = () =>
    typeof getRole === 'function' ? getRole() : undefined;

  // Authorize `action` at the current (or explicitly provided) mode. Throws
  // ForbiddenActionError when the role is not permitted at that mode.
  async function requireFor(action, mode) {
    const m = mode ?? (await getMode());
    const role = await resolveRole();
    if (!authorize({ action, mode: m, role })) {
      const label = role === undefined ? 'user' : `role "${role}"`;
      throw new ForbiddenActionError(
        `action "${action}" not permitted in mode ${m} for ${label}`,
      );
    }
    return m;
  }

  // Resolve a free-text query against the port catalog for the given kind.
  async function resolveField(kind, query) {
    const catalog =
      kind === 'product'
        ? await port.searchProducts({ text: query })
        : await port.listLocations({ text: query });
    return resolveEntity({
      queryText: query,
      catalog,
      key: kind === 'product' ? 'sku' : 'code',
    });
  }

  // Resolve a single field, returning either the resolved entity or a
  // ready-to-return disambiguation payload (no port mutation is touched).
  async function requireResolved(kind, query, action) {
    const r = await resolveField(kind, query);
    if (r.ambiguous) {
      return { disambiguation: disambiguationPayload(r.candidates, action) };
    }
    return { resolved: r.resolved };
  }

  // --- read tools ---------------------------------------------------------

  async function runSearch({ query }) {
    await requireFor('read');
    const results = await port.searchProducts({ text: query });
    return { query, results };
  }

  async function runList({ query }) {
    await requireFor('read');
    const results = await port.listLocations({ text: query });
    return { query, results };
  }

  async function runGetQuant({ productQuery, locationQuery }) {
    await requireFor('read');
    const product = await requireResolved('product', productQuery, 'read');
    if (product.disambiguation) return product.disambiguation;
    const location = await requireResolved('location', locationQuery, 'read');
    if (location.disambiguation) return location.disambiguation;
    const quant = await port.getQuant({
      productId: product.resolved.id,
      locationId: location.resolved.id,
    });
    return { product: product.resolved, location: location.resolved, ...quant };
  }

  // --- write tools --------------------------------------------------------

  async function runCreateDraft({ operationType, partnerName, lines, locationQuery, modelReason }) {
    await requireFor('create_draft');

    // Resolve every free-text reference BEFORE any mutation so an ambiguous
    // query never half-applies an operation.
    let locationId = null;
    if (locationQuery) {
      const loc = await requireResolved('location', locationQuery, 'create_draft');
      if (loc.disambiguation) return loc.disambiguation;
      locationId = loc.resolved.id;
    }

    const resolved = [];
    for (const line of lines) {
      const product = await requireResolved('product', line.productQuery, 'create_draft');
      if (product.disambiguation) return product.disambiguation;
      resolved.push({ productId: product.resolved.id, quantity: line.quantity });
    }

    // Wallet-wrapped write: provenance attached to every port mutation.
    const created = [];
    for (const line of resolved) {
      const result = await port.createOperation({
        operationType,
        partnerName,
        ...(locationId !== null ? { locationId } : {}),
        ...line,
        createdBy: currentUserId,
        confirmedBy: currentUserId,
        modelReason: modelReason ?? '',
      });
      created.push(result);
    }
    return { ok: true, result: created };
  }

  async function runValidate({ operationId, confirmReference, modelReason }) {
    await requireFor('validate');

    // The user must confirm EXACTLY the target operation's reference. The port
    // exposes no lookup, so we consult the injected operationLookup accessor.
    const target =
      typeof operationLookup === 'function' ? await operationLookup(operationId) : null;
    const expectedRef = target?.reference ?? null;
    if (expectedRef === null || confirmReference !== expectedRef) {
      // Refuse before touching the port.
      return { ok: false, error: 'confirm_reference_mismatch' };
    }

    return port.validateOperation({
      operationId,
      confirmedBy: currentUserId,
      modelReason,
    });
  }

  async function runCancel({ operationId, modelReason }) {
    await requireFor('cancel');
    return port.cancelOperation({
      operationId,
      confirmedBy: currentUserId,
      modelReason,
    });
  }

  // --- the typed tool surface ----------------------------------------------

  return {
    search_products: tool({
      description: 'Search the product catalog by free-text name or SKU.',
      inputSchema: z.object({ query: z.string() }),
      execute: ({ query }) => runSearch({ query }),
    }),

    list_locations: tool({
      description: 'Search stock locations by free-text name or code.',
      inputSchema: z.object({ query: z.string() }),
      execute: ({ query }) => runList({ query }),
    }),

    get_quant: tool({
      description: 'Resolve a product and location, then report its on-hand quantity.',
      inputSchema: z.object({
        productQuery: z.string(),
        locationQuery: z.string(),
      }),
      execute: ({ productQuery, locationQuery }) =>
        runGetQuant({ productQuery, locationQuery }),
    }),

    create_draft_operation: tool({
      description:
        'Create a draft stock operation. Every line resolves its product query; an ambiguous one returns a disambiguation question instead of writing.',
      inputSchema: z.object({
        operationType: z.string(),
        partnerName: z.string(),
        lines: z.array(
          z.object({ productQuery: z.string(), quantity: z.number() }),
        ),
        locationQuery: z.string().optional(),
        modelReason: z.string().optional(),
      }),
      execute: (input) => runCreateDraft(input),
    }),

    validate_operation: tool({
      description:
        'Approve a draft operation, only if confirmReference exactly equals the operation reference.',
      inputSchema: z.object({
        operationId: z.string(),
        confirmReference: z.string(),
        modelReason: z.string(),
      }),
      execute: (input) => runValidate(input),
    }),

    cancel_operation: tool({
      description: 'Cancel a stock operation (admin at AGENT mode).',
      inputSchema: z.object({
        operationId: z.string(),
        modelReason: z.string(),
      }),
      execute: (input) => runCancel(input),
    }),
  };
}

export { ACTION_FOR_TOOL };