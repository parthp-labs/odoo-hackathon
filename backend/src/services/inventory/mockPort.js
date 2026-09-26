import { assertPort, PORT_METHODS } from './port.js';

const matchText = (text) => {
  const q = String(text ?? '').trim().toLowerCase();
  return q.length === 0 ? () => true : (v) => String(v ?? '').toLowerCase().includes(q);
};

/**
 * Creates an in-memory InventoryPort adapter backed by seeded data. All state
 * is reachable via `port._data` for test assertions.
 */
export function createMockPort() {
  const data = {
    products: [
      { id: 'prod-1', name: 'Blue Widget', sku: 'BLU-001' },
      { id: 'prod-2', name: 'Red Gadget', sku: 'RED-002' },
      { id: 'prod-3', name: 'Green Spanner', sku: 'GRN-003' },
    ],
    locations: [
      { id: 'loc-1', name: 'Main Warehouse', code: 'WH-MAIN' },
      { id: 'loc-2', name: 'Overflow Yard', code: 'YD-OVER' },
    ],
    operations: [
      {
        id: 'op-draft-1',
        reference: 'DRAFT-1',
        status: 'draft',
        quantity: 5,
        productId: 'prod-1',
        locationId: 'loc-1',
      },
    ],
    quants: new Map(), // `${productId}|${locationId}` -> { quantity, reserved }
    seq: 1,
  };

  const getQuantKey = (productId, locationId) => `${productId}|${locationId}`;

  const port = {
    async searchProducts({ text }) {
      const match = matchText(text);
      return data.products.filter((p) => match(p.name) || match(p.sku));
    },

    async listLocations({ text }) {
      const match = matchText(text);
      return data.locations.filter((l) => match(l.name) || match(l.code));
    },

    async createOperation(input) {
      data.seq += 1;
      const reference = `DRAFT-${data.seq}`;
      const op = {
        id: `op-${data.seq}`,
        reference,
        status: 'draft',
        ...input,
      };
      data.operations.push(op);
      return { id: op.id, reference };
    },

    async validateOperation({ operationId, confirmedBy, modelReason }) {
      const op = data.operations.find((o) => o.id === operationId || o.reference === operationId);
      if (!op) return { operationId, ok: false, error: 'operation not found' };
      if (op.status === 'done') return { operationId, ok: true, status: 'done' };

      op.status = 'done';
      op.created_by = confirmedBy;
      op.model_reason = modelReason;

      // Bump the matching quant's on-hand quantity.
      const key = getQuantKey(op.productId, op.locationId);
      const cur = data.quants.get(key) ?? { quantity: 0, reserved: 0 };
      cur.quantity += op.quantity;
      data.quants.set(key, cur);

      return { operationId, ok: true, status: 'done' };
    },

    async cancelOperation({ operationId, modelReason }) {
      const op = data.operations.find((o) => o.id === operationId || o.reference === operationId);
      if (!op) return { operationId, ok: false, error: 'operation not found' };
      op.status = 'canceled';
      op.model_reason = modelReason;
      return { operationId, ok: true, status: 'canceled' };
    },

    async getQuant({ productId, locationId }) {
      return data.quants.get(getQuantKey(productId, locationId)) ?? { quantity: 0, reserved: 0 };
    },
  };

  Object.defineProperty(port, '_data', { value: data, enumerable: false });

  return assertPort(port);
}

// Re-export the contract's method list for convenience.
export { PORT_METHODS };