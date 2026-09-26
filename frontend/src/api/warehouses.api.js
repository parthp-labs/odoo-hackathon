import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockWarehouses } from '../mocks/warehouses.mock'

export const getWarehouses = async (params) => {
  if (USE_MOCKS) return mockResolve(mockWarehouses)
  const res = await client.get('/warehouses', { params })
  return { data: res.data.data || res.data }
}

export const getWarehouse = async (id) => {
  if (USE_MOCKS) return mockResolve(mockWarehouses.find((w) => w._id === id) || null)
  const res = await client.get(`/warehouses/${id}`)
  return { data: res.data.data || res.data }
}

export const createWarehouse = async (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `wh-${Date.now()}`, ...payload }
    mockWarehouses.push(created)
    return mockResolve(created)
  }
  const res = await client.post('/warehouses', payload)
  return { data: res.data.data || res.data }
}

export const updateWarehouse = async (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockWarehouses.find((w) => w._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  const res = await client.put(`/warehouses/${id}`, payload)
  return { data: res.data.data || res.data }
}

export const deleteWarehouse = async (id) => {
  if (USE_MOCKS) {
    const index = mockWarehouses.findIndex((w) => w._id === id)
    if (index !== -1) mockWarehouses.splice(index, 1)
    return mockResolve({ message: 'Warehouse deleted' })
  }
  const res = await client.delete(`/warehouses/${id}`)
  return { data: res.data }
}
