// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { mockUser } from '../mocks/auth.mock'

export const getProfile = () => {
  if (USE_MOCKS) return mockResolve(mockUser)
  return client.get('/users/me')
}

export const updateProfile = (payload) => {
  if (USE_MOCKS) return mockResolve({ ...mockUser, ...payload })
  return client.put('/users/me', payload)
}

export const getUsers = (params) => {
  if (USE_MOCKS) return mockResolve([mockUser])
  return client.get('/users', { params })
}
