// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import {
  mockDashboardStats,
  mockLowStockItems,
  mockRecentMoves,
  mockStockByCategory,
  mockStockByWarehouse,
} from '../mocks/dashboard.mock'

export const getDashboardStats = (params) => {
  if (USE_MOCKS) return mockResolve(mockDashboardStats)
  return client.get('/dashboard/stats', { params })
}

export const getLowStockItems = (params) => {
  if (USE_MOCKS) return mockResolve(mockLowStockItems)
  return client.get('/dashboard/low-stock', { params })
}

export const getRecentActivity = (params) => {
  if (USE_MOCKS) return mockResolve(mockRecentMoves)
  return client.get('/dashboard/recent-activity', { params })
}

export const getStockByCategory = (params) => {
  if (USE_MOCKS) return mockResolve(mockStockByCategory)
  return client.get('/dashboard/stock-by-category', { params })
}

export const getStockByWarehouse = (params) => {
  if (USE_MOCKS) return mockResolve(mockStockByWarehouse)
  return client.get('/dashboard/stock-by-warehouse', { params })
}
