// ReplenishPort — the service boundary for the combined replenishment flow.
// Callers depend ONLY on this interface (reorder + forecast), so implementations
// can be swapped without touching Express routes.

import { recommendReorder, recommendAll, listSourceableVendors } from './reorderService.js';

/**
 * @typedef {Object} ReplenishPort
 * @property {(sku:string, opts?:object)=>Promise<object|null>} recommendReorder
 * @property {(opts?:object)=>Promise<Array<object>>} recommendAll
 * @property {(sku:string, productId:string, opts?:object)=>Promise<Array<object>>} listSourceableVendors
 */

export function createReplenishPort() {
  return { recommendReorder, recommendAll, listSourceableVendors };
}

export { recommendReorder, recommendAll, listSourceableVendors };