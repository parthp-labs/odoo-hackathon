// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockLocations } from '../mocks/locations.mock'

export const getLocations = (params = {}) => {
  if (USE_MOCKS) {
    let items = [...mockLocations]
    if (params.warehouse) items = items.filter((l) => l.warehouse === params.warehouse)
    if (params.location_type) items = items.filter((l) => l.location_type === params.location_type)
    return mockResolve(items)
  }
  return client.get('/locations', { params })
}

export const getLocation = (id) => {
  if (USE_MOCKS) return mockResolve(mockLocations.find((l) => l._id === id) || null)
  return client.get(`/locations/${id}`)
}

export const createLocation = (payload) => {
  if (USE_MOCKS) {
    const created = { _id: `loc-${Date.now()}`, is_active: true, ...payload }
    mockLocations.push(created)
    return mockResolve(created)
  }
  return client.post('/locations', payload)
}

export const updateLocation = (id, payload) => {
  if (USE_MOCKS) {
    const existing = mockLocations.find((l) => l._id === id)
    if (existing) Object.assign(existing, payload)
    return mockResolve(existing || { _id: id, ...payload })
  }
  return client.put(`/locations/${id}`, payload)
}

export const deleteLocation = (id) => {
  if (USE_MOCKS) {
    const index = mockLocations.findIndex((l) => l._id === id)
    if (index !== -1) mockLocations.splice(index, 1)
    return mockResolve({ message: 'Location deleted' })
  }
  return client.delete(`/locations/${id}`)
}
