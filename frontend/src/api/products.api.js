// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import {
  mockProducts,
  getOnHandQuantity,
  getReservedQuantity,
  getStockStatus,
} from '../mocks/products.mock'
import { mockLocations } from '../mocks/locations.mock'

function toListItem(product) {
  return {
    ...product,
    on_hand_quantity: getOnHandQuantity(product),
    reserved_quantity: getReservedQuantity(product),
    stock_status: getStockStatus(product),
  }
}

export const getProducts = (params = {}) => {
  if (USE_MOCKS) {
    const { search = '', category = '', stock_status = '', page = 1, limit = 10 } = params
    let items = mockProducts.map(toListItem)

    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      )
    }
    if (category) {
      items = items.filter((p) => p.category === category)
    }
    if (stock_status) {
      items = items.filter((p) => p.stock_status === stock_status)
    }

    const total = items.length
    const start = (Number(page) - 1) * Number(limit)
    const paginated = items.slice(start, start + Number(limit))

    return mockResolve({ items: paginated, total, page: Number(page), limit: Number(limit) })
  }
  return client.get('/products', { params })
}

export const getProduct = (id) => {
  if (USE_MOCKS) {
    const product = mockProducts.find((p) => p._id === id)
    return mockResolve(product ? toListItem(product) : null)
  }
  return client.get(`/products/${id}`)
}

export const getProductStockByLocation = (id) => {
  if (USE_MOCKS) {
    const product = mockProducts.find((p) => p._id === id)
    const rows = (product?.stock || []).map((s) => {
      const location = mockLocations.find((l) => l._id === s.location)
      return {
        location_id: s.location,
        location_name: location?.name || 'Unknown',
        on_hand: s.quantity,
        reserved: s.reserved_quantity,
        available: s.quantity - s.reserved_quantity,
      }
    })
    return mockResolve(rows)
  }
  return client.get(`/products/${id}/stock-by-location`)
}

function normalizeReorderingRules(rules = []) {
  return rules
    .filter((r) => r.warehouse)
    .map((r) => ({
      warehouse: r.warehouse,
      min_quantity: Number(r.min_quantity) || 0,
      max_quantity: Number(r.max_quantity) || 0,
    }))
}

export const createProduct = (payload) => {
  if (USE_MOCKS) {
    const { initial_quantity, initial_location, reordering_rules, ...rest } = payload
    const stock = []
    if (initial_location && Number(initial_quantity) > 0) {
      stock.push({ location: initial_location, quantity: Number(initial_quantity), reserved_quantity: 0 })
    }
    const created = {
      _id: `prod-${Date.now()}`,
      ...rest,
      is_active: true,
      reordering_rules: normalizeReorderingRules(reordering_rules),
      stock,
    }
    mockProducts.push(created)
    return mockResolve(toListItem(created))
  }
  return client.post('/products', payload)
}

export const updateProduct = (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockProducts.find((p) => p._id === id)
    if (existing) {
      const { initial_quantity, initial_location, reordering_rules, ...rest } = payload
      Object.assign(existing, rest, { reordering_rules: normalizeReorderingRules(reordering_rules) })
    }
    return mockResolve(existing ? toListItem(existing) : { _id: id, ...payload })
  }
  return client.put(`/products/${id}`, payload)
}

export const deleteProduct = (id) => {
  if (USE_MOCKS) {
    const index = mockProducts.findIndex((p) => p._id === id)
    if (index !== -1) mockProducts.splice(index, 1)
    return mockResolve({ message: 'Product deleted' })
  }
  return client.delete(`/products/${id}`)
}
