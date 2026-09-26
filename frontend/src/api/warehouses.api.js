// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockWarehouses } from '../mocks/warehouses.mock'

export const getWarehouses = (params) => {
  if (USE_MOCKS) return mockResolve(mockWarehouses)
  return client.get('/warehouses', { params })
}

export const getWarehouse = (id) => {
  if (USE_MOCKS) return mockResolve(mockWarehouses.find((w) => w._id === id) || null)
  return client.get(`/warehouses/${id}`)
}

export const createWarehouse = (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `wh-${Date.now()}`, ...payload }
    mockWarehouses.push(created)
    return mockResolve(created)
  }
  return client.post('/warehouses', payload)
}

export const updateWarehouse = (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockWarehouses.find((w) => w._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  return client.put(`/warehouses/${id}`, payload)
}

export const deleteWarehouse = (id) => {
  if (USE_MOCKS) {
    const index = mockWarehouses.findIndex((w) => w._id === id)
    if (index !== -1) mockWarehouses.splice(index, 1)
    return mockResolve({ message: 'Warehouse deleted' })
  }
  return client.delete(`/warehouses/${id}`)
}
