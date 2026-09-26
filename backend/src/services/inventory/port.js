/**
 * InventoryPort — the service boundary contract for the inventory domain.
 *
 * The real Mongoose + transaction-backed inventory domain is NOT built yet; it
 * will be plugged into this port later. The agent (and tests) depend ONLY on
 * this interface, so the implementor can be swapped (mock today, real DB later)
 * without touching the caller.
 *
 * Every method returns a Promise. Signatures are documented in the
 * `InventoryPort` @typedef below and enforced at startup by `assertPort`.
 */

export const PORT_METHODS = [
  'searchProducts',
  'listLocations',
  'createOperation',
  'validateOperation',
  'cancelOperation',
  'getQuant',
];

/**
 * Error thrown by `assertPort` when a required method is missing or not a
 * function — an early, loud failure instead of a silently no-op agent.
 */
export class PortNotImplementedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PortNotImplementedError';
  }
}

/**
 * Verifies at startup that `port` implements every method in PORT_METHODS.
 * @param {object} port The candidate InventoryPort implementation.
 * @throws {PortNotImplementedError} If any method is missing or not a function.
 */
export function assertPort(port) {
  const missing = PORT_METHODS.filter((m) => typeof port?.[m] !== 'function');
  if (missing.length > 0) {
    throw new PortNotImplementedError(
      `InventoryPort missing method(s): ${missing.join(', ')}`
    );
  }
  return port;
}

/**
 * @typedef {Object} Product - A discoverable inventory product.
 * @property {string} id
 * @property {string} name
 * @property {string} sku
 */

/**
 * @typedef {Object} Location - A stock location.
 * @property {string} id
 * @property {string} name
 * @property {string} code
 */

/**
 * @typedef {Object} OperationInput - Payload to create a stock operation.
 * @property {string} productId
 * @property {string} locationId
 * @property {number} quantity
 * @property {string} [createdBy] Operator accountable for the operation.
 * @property {string} [reference]
 */

/**
 * @typedef {Object} Operation - A stored stock operation.
 * @property {string} id
 * @property {string} reference
 * @property {string} status - 'draft' | 'done' | 'canceled'
 * @property {string} [created_by] Accountable operator/provenance.
 * @property {string} [model_reason] Why the model/agent performed the action.
 * @property {number} quantity
 * @property {string} productId
 * @property {string} locationId
 */

/**
 * @typedef {Object} Quant
 * @property {number} quantity - On-hand quantity.
 * @property {number} reserved - Reserved quantity.
 */

/**
 * @typedef {Object} InventoryPort
 * Full interface for the inventory service boundary. All methods async.
 *
 * @property {(args: {text: string}) => Promise<Array<Product>>} searchProducts
 *   Case-insensitive product search by name/sku containing `text`.
 * @property {(args: {text: string}) => Promise<Array<Location>>} listLocations
 *   Case-insensitive location search by name/code containing `text`.
 * @property {(input: OperationInput) => Promise<{id: string, reference: string}>} createOperation
 *    Creates a draft operation, returns its id and generated reference (e.g. DRAFT-<n>).
 * @property {(args: {operationId: string, confirmedBy: string, modelReason: string}) => Promise<any>} validateOperation
 *   Marks an operation 'done' and applies its quantity to inventory.
 * @property {(args: {operationId: string, modelReason: string}) => Promise<any>} cancelOperation
 *   Marks an operation 'canceled'.
 * @property {(args: {productId: string, locationId: string}) => Promise<Quant>} getQuant
 *   Returns {quantity, reserved} for a product+location (0 if none).
 */
export const InventoryPort = Object.freeze({});