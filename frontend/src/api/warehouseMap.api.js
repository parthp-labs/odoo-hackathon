// TODO: backend
// Real endpoint: GET /api/stock?warehouse=<id> — "real-time stock balances across
// locations" (see /api/docs). Returns quants; product/location details are merged
// client-side in useWarehouseMap from getProducts()/getLocations().
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockProducts } from '../mocks/products.mock'
import { mockLocations } from '../mocks/locations.mock'

function buildMockStockQuants() {
  const quants = []
  mockProducts.forEach((product) => {
    ;(product.stock || []).forEach((s) => {
      quants.push({
        product_id: product._id,
        location_id: s.location,
        quantity: s.quantity,
        reserved_quantity: s.reserved_quantity,
      })
    })
  })
  return quants
}

export const getStockQuants = (params = {}) => {
  if (USE_MOCKS) {
    let items = buildMockStockQuants()
    if (params.warehouse) {
      const locationIds = new Set(
        mockLocations.filter((l) => l.warehouse === params.warehouse).map((l) => l._id),
      )
      items = items.filter((q) => locationIds.has(q.location_id))
    }
    if (params.location) items = items.filter((q) => q.location_id === params.location)
    if (params.product) items = items.filter((q) => q.product_id === params.product)
    return mockResolve(items)
  }
  return client.get('/stock', { params })
}
