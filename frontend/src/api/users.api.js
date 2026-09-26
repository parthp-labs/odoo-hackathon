import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockUser } from '../mocks/auth.mock'

export const getProfile = async () => {
  if (USE_MOCKS) return mockResolve(mockUser)
  // Backend returns { success: true, user: { ... } } at /api/auth/me
  const res = await client.get('/auth/me')
  return { data: res.data.user || res.data }
}

export const updateProfile = (payload) => {
  if (USE_MOCKS) return mockResolve({ ...mockUser, ...payload })
  return client.put('/users/me', payload)
}

export const getUsers = (params) => {
  if (USE_MOCKS) return mockResolve([mockUser])
  return client.get('/users', { params })
}
