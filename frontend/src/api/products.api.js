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

export const getProducts = async (params = {}) => {
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

  // Live Backend: fetch products and stock balances concurrently to compute on-hand and status
  const [productsRes, stockRes] = await Promise.all([
    client.get('/products', { params }),
    client.get('/stock'),
  ])

  let products = productsRes.data.data || []
  const stockQuants = stockRes.data.data || []

  // Build map of on-hand & reserved per product
  const stockMap = {}
  for (const q of stockQuants) {
    const pId = q.product?._id?.toString() || (typeof q.product === 'string' ? q.product : '') || q.productId
    if (!pId) continue
    if (!stockMap[pId]) {
      stockMap[pId] = { onHand: 0, reserved: 0 }
    }
    stockMap[pId].onHand += Number(q.quantity ?? q.onHand ?? 0)
    stockMap[pId].reserved += Number(q.reserved_quantity ?? q.reserved ?? 0)
  }

  let items = products.map((p) => {
    const sm = stockMap[p._id] || { onHand: 0, reserved: 0 }
    const onHand = sm.onHand
    const reserved = sm.reserved
    const minQty = (p.reordering_rules || []).reduce((sum, r) => sum + (Number(r.min_quantity) || 0), 0)

    let stock_status = 'in_stock'
    if (onHand <= 0) {
      stock_status = 'out_of_stock'
    } else if (minQty > 0 && onHand <= minQty) {
      stock_status = 'low_stock'
    }

    return {
      ...p,
      category: p.category?._id || p.category,
      category_name: p.category?.name || '',
      on_hand_quantity: onHand,
      reserved_quantity: reserved,
      stock_status,
    }
  })

  // Apply filters on client side if requested
  if (params.stock_status) {
    items = items.filter((p) => p.stock_status === params.stock_status)
  }

  const page = Number(params.page) || 1
  const limit = Number(params.limit) || 10
  const total = items.length
  const paginated = items.slice((page - 1) * limit, page * limit)

  return {
    data: {
      items: paginated,
      total,
      page,
      limit,
    },
  }
}

export const getProduct = async (id) => {
  if (USE_MOCKS) {
    const product = mockProducts.find((p) => p._id === id)
    return mockResolve(product ? toListItem(product) : null)
  }

  const [productRes, stockRes] = await Promise.all([
    client.get(`/products/${id}`),
    client.get(`/stock?product=${id}`),
  ])

  const product = productRes.data.data
  if (!product) return { data: null }

  const stockQuants = stockRes.data.data || []
  const onHand = stockQuants.reduce((sum, q) => sum + Number(q.quantity ?? q.onHand ?? 0), 0)
  const reserved = stockQuants.reduce((sum, q) => sum + Number(q.reserved_quantity ?? q.reserved ?? 0), 0)
  const minQty = (product.reordering_rules || []).reduce((sum, r) => sum + (Number(r.min_quantity) || 0), 0)

  let stock_status = 'in_stock'
  if (onHand <= 0) {
    stock_status = 'out_of_stock'
  } else if (minQty > 0 && onHand <= minQty) {
    stock_status = 'low_stock'
  }

  const normalizedRules = (product.reordering_rules || []).map((r) => ({
    ...r,
    warehouse: r.warehouse?._id || r.warehouse,
    warehouse_name: r.warehouse?.name || '',
    min_quantity: Number(r.min_quantity) || 0,
    max_quantity: Number(r.max_quantity) || 0,
  }))

  return {
    data: {
      ...product,
      category: product.category?._id || product.category,
      category_name: product.category?.name || '',
      reordering_rules: normalizedRules,
      on_hand_quantity: onHand,
      reserved_quantity: reserved,
      stock_status,
    },
  }
}

export const getProductStockByLocation = async (id) => {
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

  const res = await client.get(`/stock?product=${id}`)
  const quants = res.data.data || []
  const rows = quants.map((q) => {
    const locId = q.location?._id || q.locationId || ''
    const locName = q.location?.name || q.locationName || 'Unknown Location'
    const locCode = q.location?.code || q.locationCode || ''
    const whName = q.location?.warehouse?.name || q.warehouseName || ''
    const onHand = Number(q.quantity ?? q.onHand ?? 0)
    const reserved = Number(q.reserved_quantity ?? q.reserved ?? 0)
    const available = Number(q.free_to_use ?? q.freeToUse ?? Math.max(0, onHand - reserved))

    return {
      location_id: locId,
      location_name: `${whName ? whName + ' - ' : ''}${locName}${locCode ? ` (${locCode})` : ''}`,
      on_hand: onHand,
      reserved,
      available,
    }
  })

  return { data: rows }
}

function normalizeReorderingRules(rules = []) {
  return rules
    .filter((r) => r.warehouse)
    .map((r) => ({
      warehouse: r.warehouse?._id || r.warehouse,
      min_quantity: Number(r.min_quantity) || 0,
      max_quantity: Number(r.max_quantity) || 0,
    }))
}

export const createProduct = async (payload) => {
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

  const { initial_quantity, initial_location, reordering_rules, ...rest } = payload
  const res = await client.post('/products', {
    ...rest,
    reordering_rules: normalizeReorderingRules(reordering_rules),
  })

  const createdProduct = res.data.data

  // If initial quantity and location were selected, create an initial inventory adjustment or receipt
  if (initial_location && Number(initial_quantity) > 0 && createdProduct?._id) {
    try {
      const locRes = await client.get('/locations')
      const allLocs = locRes.data.data || []
      const vendorLoc = allLocs.find((l) => l.location_type === 'vendor') || allLocs.find((l) => l.location_type !== 'internal')

      if (vendorLoc?._id) {
        const opRes = await client.post('/operations', {
          operation_type: 'receipt',
          source_location: vendorLoc._id,
          destination_location: initial_location,
          partner_name: 'Opening Inventory Balance',
          notes: 'Initial stock intake upon product creation',
          lines: [
            {
              product: createdProduct._id,
              quantity_demanded: Number(initial_quantity),
              quantity_done: Number(initial_quantity),
            },
          ],
        })
        const opId = opRes.data?.data?._id
        if (opId) {
          await client.post(`/operations/${opId}/validate`)
        }
      }
    } catch (e) {
      console.warn('Initial stock assignment failed', e);
    }
  }

  return { data: createdProduct }
}

export const updateProduct = async (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockProducts.find((p) => p._id === id)
    if (existing) {
      const { initial_quantity, initial_location, reordering_rules, ...rest } = payload
      Object.assign(existing, rest, { reordering_rules: normalizeReorderingRules(reordering_rules) })
    }
    return mockResolve(existing ? toListItem(existing) : { _id: id, ...payload })
  }

  const { initial_quantity, initial_location, reordering_rules, ...rest } = payload
  const res = await client.put(`/products/${id}`, {
    ...rest,
    reordering_rules: normalizeReorderingRules(reordering_rules),
  })

  return { data: res.data.data }
}

export const deleteProduct = async (id) => {
  if (USE_MOCKS) {
    const index = mockProducts.findIndex((p) => p._id === id)
    if (index !== -1) mockProducts.splice(index, 1)
    return mockResolve({ message: 'Product deleted' })
  }

  const res = await client.delete(`/products/${id}`)
  return { data: res.data }
}
