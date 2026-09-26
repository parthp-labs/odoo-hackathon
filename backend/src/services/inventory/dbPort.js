// dbPort.js — real Mongoose-backed InventoryPort for the LLM agent.
//
// Implements the same inventory boundary contract as the in-memory mockPort
// (port.js / PORT_METHODS) but reads and writes the actual seeded catalog,
// stock quants, locations and operations. This lets the agent answer real
// questions ("what's low on hand?", "where is SKU X?") against live data
// instead of three hardcoded fixtures.
import { assertPort, PORT_METHODS } from './port.js';
import Product from '../../models/product.model.js';
import StockQuant from '../../models/stockQuant.model.js';
import Location from '../../models/location.model.js';
import StockOperation from '../../models/stockOperation.model.js';

const matchRe = (q) => {
  const s = String(q ?? '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return s.length === 0 ? null : new RegExp(s, 'i');
};

/**
 * Create a real DB-backed InventoryPort. Every method hits Mongo.
 */
export function createDbPort() {
  const port = {
    async searchProducts({ text }) {
      const re = matchRe(text);
      const q = re ? { is_active: true, $or: [{ name: re }, { sku: re }] } : { is_active: true };
      const rows = await Product.find(q)
        .select('name sku')
        .limit(25)
        .lean();
      return rows.map((p) => ({ id: String(p._id), name: p.name, sku: p.sku }));
    },

    async listLocations({ text }) {
      const re = matchRe(text);
      const q = re ? { $or: [{ name: re }, { code: re }] } : {};
      const rows = await Location.find(q)
        .select('name code')
        .limit(25)
        .lean();
      return rows.map((l) => ({ id: String(l._id), name: l.name, code: l.code }));
    },

    async getQuant({ productId, locationId }) {
      const q = await StockQuant.findOne({
        product: productId,
        location: locationId,
      }).lean();
      if (!q) return { productId, locationId, quantity: 0, reserved: 0 };
      return {
        productId,
        locationId,
        quantity: q.quantity || 0,
        reserved: q.reserved_quantity || 0,
      };
    },

    // Create a real draft operation. We reuse the seeded reference naming the
    // rest of the app uses (REC/2026/NNNN, DEL/2026/NNNN, ...).
    async createOperation(input) {
      const { operationType, partnerName, locationId, productId, quantity, createdBy, modelReason } = input;
      const lines = Array.isArray(input.lines) && input.lines.length
        ? input.lines
        : [{ product: productId, quantity_demanded: quantity ?? 0, quantity_done: 0 }];

      const type = String(operationType || 'adjustment').toLowerCase();
      const prefix = type.includes('deliveri')
        ? 'DEL'
        : type.includes('transfer')
          ? 'INT'
          : type.includes('receipt')
            ? 'REC'
            : 'ADJ';

      const seq = await StockOperation.countDocuments({
        reference: new RegExp(`^${prefix}/${new Date().getFullYear()}/`),
      });
      const reference = `${prefix}/${new Date().getFullYear()}/${String(seq + 1).padStart(4, '0')}`;

      // For location we may only get a single resolved location; mirroring the
      // app's two-location model, default source==destination when one given.
      const loc = locationId || null;
      const op = await StockOperation.create({
        reference,
        operation_type: type.includes('receipt') ? 'receipt'
          : type.includes('deliveri') ? 'delivery'
            : type.includes('transfer') ? 'internal_transfer'
              : 'adjustment',
        status: 'draft',
        partner_name: partnerName || '',
        source_location: loc,
        destination_location: loc,
        created_by: createdBy || null,
        notes: modelReason || 'created by inventory agent',
        lines,
      });
      return { id: String(op._id), reference: op.reference };
    },

    async validateOperation({ operationId, confirmedBy, modelReason }) {
      const op = await StockOperation.findById(operationId);
      if (!op) return { operationId, ok: false, error: 'operation not found' };
      if (op.status === 'done') return { operationId, ok: true, status: 'done' };
      op.status = 'done';
      op.validated_at = new Date();
      await op.save();

      // Apply on-hand: for receipt/transfer (into dest) add, for delivery/subtract.
      const sign = op.operation_type === 'delivery' ? -1 : 1;
      for (const line of op.lines || []) {
        const targetLoc = op.operation_type === 'delivery' ? op.source_location : op.destination_location;
        let q = await StockQuant.findOne({ product: line.product, location: targetLoc });
        if (!q) {
          q = new StockQuant({ product: line.product, location: targetLoc, quantity: 0, reserved_quantity: 0 });
        }
        q.quantity = Math.max(0, (q.quantity || 0) + sign * (line.quantity_done ?? line.quantity_demanded ?? 0));
        await q.save();
      }
      return { operationId, ok: true, status: 'done' };
    },

    async cancelOperation({ operationId, modelReason }) {
      const op = await StockOperation.findById(operationId);
      if (!op) return { operationId, ok: false, error: 'operation not found' };
      op.status = 'canceled';
      op.notes = [op.notes, modelReason ? `canceled: ${modelReason}` : 'canceled'].filter(Boolean).join(' | ');
      await op.save();
      return { operationId, ok: true, status: 'canceled' };
    },
  };

  return assertPort(port);
}

export { PORT_METHODS };