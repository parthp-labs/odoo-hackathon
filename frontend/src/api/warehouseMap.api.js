// Always hits the live backend — this feature does not use mock data, regardless
// of VITE_USE_MOCKS (matches the same real-only pattern used by operations.api.js).
import client from './client'

// GET /api/warehouses -> { success, count, data: Warehouse[] } (unwrapped by client.js)
export const getWarehouses = () => client.get('/warehouses')

// GET /api/stock/rack-layout?warehouse=<id>
// -> { success, warehouse, summary, data: Zone[] } — kept as the full envelope
// (skipUnwrap) because `warehouse` and `summary` are useful alongside `data`.
export const getRackLayout = (params = {}) =>
  client.get('/stock/rack-layout', { params, skipUnwrap: true })
