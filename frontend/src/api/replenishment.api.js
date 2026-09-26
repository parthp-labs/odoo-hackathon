import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockReplenishment, mockForecastFor, mockModelInfo } from '../mocks/replenishment.mock'

// GET /replenishment/recommendations (all, or one SKU)
export const getRecommendations = async (params = {}) => {
  if (USE_MOCKS) {
    const { sku } = params
    if (sku) {
      const row = mockReplenishment.find((r) => r.sku === sku)
      return mockResolve(row || null)
    }
    return mockResolve(mockReplenishment)
  }
  const res = await client.get('/replenishment/recommendations', { params })
  return { data: res.data }
}

// GET /replenishment/forecast/:sku?horizon=&engine=svm|stats
export const getForecast = async (sku, { horizon = 8, engine = 'svm' } = {}) => {
  if (USE_MOCKS) {
    return mockResolve(mockForecastFor(sku, { horizon, engine }))
  }
  const res = await client.get(`/replenishment/forecast/${sku}`, { params: { horizon, engine } })
  return { data: res.data }
}

// GET /replenishment/model-info
export const getModelInfo = async () => {
  if (USE_MOCKS) {
    return mockResolve(mockModelInfo)
  }
  const res = await client.get('/replenishment/model-info')
  return { data: res.data }
}

// POST /replenishment/run  { horizon, engine }
export const runRefit = async ({ horizon = 8, engine = 'svm' } = {}) => {
  if (USE_MOCKS) {
    return mockResolve({ engine, count: mockReplenishment.length })
  }
  const res = await client.post('/replenishment/run', { horizon, engine })
  return { data: res.data }
}

// GET /product/:sku/vendors
export const getProductVendors = async (sku) => {
  if (USE_MOCKS) {
    const row = mockReplenishment.find((r) => r.sku === sku)
    return mockResolve({ product: row || null, vendors: row?.vendors || [], demoData: true })
  }
  const res = await client.get(`/product/${sku}/vendors`)
  return { data: res.data }
}

// GET /vendors/search?q=
export const searchVendors = async (q) => {
  if (USE_MOCKS) {
    return mockResolve([])
  }
  const res = await client.get('/vendors/search', { params: { q } })
  return { data: res.data }
}
