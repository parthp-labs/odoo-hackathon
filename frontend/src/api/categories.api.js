import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockCategories } from '../mocks/categories.mock'

export const getCategories = async (params) => {
  if (USE_MOCKS) return mockResolve(mockCategories)
  const res = await client.get('/categories', { params })
  return { data: res.data.data || res.data }
}

export const getCategory = async (id) => {
  if (USE_MOCKS) return mockResolve(mockCategories.find((c) => c._id === id) || null)
  const res = await client.get(`/categories/${id}`)
  return { data: res.data.data || res.data }
}

export const createCategory = async (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `cat-${Date.now()}`, ...payload }
    mockCategories.push(created)
    return mockResolve(created)
  }
  const res = await client.post('/categories', payload)
  return { data: res.data.data || res.data }
}

export const updateCategory = async (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockCategories.find((c) => c._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  const res = await client.put(`/categories/${id}`, payload)
  return { data: res.data.data || res.data }
}

export const deleteCategory = async (id) => {
  if (USE_MOCKS) {
    const index = mockCategories.findIndex((c) => c._id === id)
    if (index !== -1) mockCategories.splice(index, 1)
    return mockResolve({ message: 'Category deleted' })
  }
  const res = await client.delete(`/categories/${id}`)
  return { data: res.data }
}
