import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import {
  mockDashboardStats,
  mockLowStockItems,
  mockRecentMoves,
  mockStockByCategory,
  mockStockByWarehouse,
} from '../mocks/dashboard.mock'

export const getDashboardStats = async (params) => {
  if (USE_MOCKS) return mockResolve(mockDashboardStats)
  // Backend returns: { totalProductsInStock, lowStockCount, outOfStockCount, pendingReceipts, pendingDeliveries, internalTransfersScheduled }
  const res = await client.get('/dashboard/kpis', { params })
  const d = res.data.data || {}
  const stats = {
    total_products_in_stock: d.totalProductsInStock ?? 0,
    low_stock_count: d.lowStockCount ?? 0,
    out_of_stock_count: d.outOfStockCount ?? 0,
    pending_receipts: d.pendingReceipts ?? 0,
    pending_deliveries: d.pendingDeliveries ?? 0,
    transfers_scheduled: d.internalTransfersScheduled ?? 0,
  }
  return { data: stats }
}

export const getLowStockItems = async (params) => {
  if (USE_MOCKS) return mockResolve(mockLowStockItems)
  const res = await client.get('/dashboard/low-stock', { params })
  const alerts = res.data.data || []
  // Adapt to LowStockPanel shape: { _id, name, sku, category, on_hand, min_quantity, status }
  const items = alerts.map((a) => ({
    _id: a.productId,
    name: a.productName,
    sku: a.sku,
    category: a.category,
    on_hand: a.onHand,
    min_quantity: a.minThreshold,
    status: a.isOutOfStock ? 'out_of_stock' : 'low_stock',
  }))
  return { data: items }
}

export const getRecentActivity = async (params) => {
  if (USE_MOCKS) return mockResolve(mockRecentMoves)
  const res = await client.get('/moves', { params })
  const moves = res.data.data || []
  // Adapt to RecentActivity shape: { _id, reference, product_name, source_location_name, destination_location_name, quantity, move_date, user }
  const formatted = moves.slice(0, 10).map((m) => ({
    _id: m.id,
    reference: m.reference,
    product_name: m.productName,
    source_location_name: m.fromLocation,
    destination_location_name: m.toLocation,
    quantity: m.quantity,
    move_date: m.date,
    user: m.validatedBy,
  }))
  return { data: formatted }
}

export const getStockByCategory = async (params) => {
  if (USE_MOCKS) return mockResolve(mockStockByCategory)
  // Aggregate stock availability by category
  const res = await client.get('/stock', { params })
  const quants = res.data.data || []
  const categoryMap = {}
  for (const q of quants) {
    const cat = q.product?.category?.name || q.category || 'Uncategorized'
    const qty = Number(q.quantity ?? q.onHand ?? 0)
    categoryMap[cat] = (categoryMap[cat] || 0) + qty
  }
  const byCategory = Object.entries(categoryMap).map(([label, quantity]) => ({
    label,
    quantity,
  }))
  return { data: byCategory }
}

export const getStockByWarehouse = async (params) => {
  if (USE_MOCKS) return mockResolve(mockStockByWarehouse)
  // Aggregate stock availability by warehouse
  const res = await client.get('/stock', { params })
  const quants = res.data.data || []
  const whMap = {}
  for (const q of quants) {
    const wh = q.location?.warehouse?.name || q.warehouseName || 'Main Warehouse'
    const qty = Number(q.quantity ?? q.onHand ?? 0)
    whMap[wh] = (whMap[wh] || 0) + qty
  }
  const byWarehouse = Object.entries(whMap).map(([label, quantity]) => ({
    label,
    quantity,
  }))
  return { data: byWarehouse }
}
