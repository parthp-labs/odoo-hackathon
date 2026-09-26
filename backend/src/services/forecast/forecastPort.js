// ForecastPort — the service boundary the reorder/vendor layers depend on.
// Callers depend ONLY on this interface so the forecast source (real ledger,
// synthetic generator, or future managed API) can be swapped without touching callers.

import { getForecast, refitAll, aggregateWeeklyDemand } from './forecastService.js';

/**
 * ForecastPort interface.
 * @typedef {Object} ForecastPort
 * @property {(sku:string, opts?:object)=>Promise<object|null>} getForecast
 * @property {(opts?:object)=>Promise<Array<object>>} refitAll
 * @property {(productId:string, opts?:object)=>Promise<object>} aggregateWeeklyDemand
 */

/**
 * Build the default ForecastPort backed by the real ledger + StatsForecast-style
 * pure methods (forecastService). Returns an object satisfying ForecastPort.
 */
export function createForecastPort() {
  return {
    getForecast,
    refitAll,
    aggregateWeeklyDemand,
  };
}

export { getForecast, refitAll, aggregateWeeklyDemand };