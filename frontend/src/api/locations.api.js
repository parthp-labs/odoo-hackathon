import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockLocations } from '../mocks/locations.mock'

export const getLocations = async (params = {}) => {
  if (USE_MOCKS) {
    let items = [...mockLocations]
    if (params.warehouse) items = items.filter((l) => l.warehouse === params.warehouse)
    if (params.location_type) items = items.filter((l) => l.location_type === params.location_type)
    return mockResolve(items)
  }
  const res = await client.get('/locations', { params })
  return { data: res.data.data || res.data }
}

export const getLocation = async (id) => {
  if (USE_MOCKS) return mockResolve(mockLocations.find((l) => l._id === id) || null)
  const res = await client.get(`/locations/${id}`)
  return { data: res.data.data || res.data }
}

export const createLocation = async (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `loc-${Date.now()}`, is_active: true, ...payload }
    mockLocations.push(created)
    return mockResolve(created)
  }
  const res = await client.post('/locations', payload)
  return { data: res.data.data || res.data }
}

export const updateLocation = async (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockLocations.find((l) => l._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  const res = await client.put(`/locations/${id}`, payload)
  return { data: res.data.data || res.data }
}

export const deleteLocation = async (id) => {
  if (USE_MOCKS) {
    const index = mockLocations.findIndex((l) => l._id === id)
    if (index !== -1) mockLocations.splice(index, 1)
    return mockResolve({ message: 'Location deleted' })
  }
  const res = await client.delete(`/locations/${id}`)
  return { data: res.data }
}
