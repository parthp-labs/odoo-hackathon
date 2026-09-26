// MarketPort — service boundary for vendor + price sourcing.
import { searchProducts, getBestPricesForProduct, searchVendors } from './vendorService.js';

/**
 * @typedef {Object} MarketPort
 * @property {(query:string, opts?:object)=>Promise<Array<object>>} searchProducts
 * @property {(productId:string|object, opts?:object)=>Promise<Array<object>>} getBestPricesForProduct
 * @property {(query:string, opts?:object)=>Promise<Array<object>>} searchVendors
 */

export function createMarketPort() {
  return { searchProducts, getBestPricesForProduct, searchVendors };
}

export { searchProducts, getBestPricesForProduct, searchVendors };