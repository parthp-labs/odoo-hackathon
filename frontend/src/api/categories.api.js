// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockCategories } from '../mocks/categories.mock'

export const getCategories = (params) => {
  if (USE_MOCKS) return mockResolve(mockCategories)
  return client.get('/categories', { params })
}

export const getCategory = (id) => {
  if (USE_MOCKS) return mockResolve(mockCategories.find((c) => c._id === id) || null)
  return client.get(`/categories/${id}`)
}

export const createCategory = (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `cat-${Date.now()}`, ...payload }
    mockCategories.push(created)
    return mockResolve(created)
  }
  return client.post('/categories', payload)
}

export const updateCategory = (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockCategories.find((c) => c._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  return client.put(`/categories/${id}`, payload)
}

export const deleteCategory = (id) => {
  if (USE_MOCKS) {
    const index = mockCategories.findIndex((c) => c._id === id)
    if (index !== -1) mockCategories.splice(index, 1)
    return mockResolve({ message: 'Category deleted' })
  }
  return client.delete(`/categories/${id}`)
}
