import { USER_ROLES, USER_STATUS } from '../utils/constants'

export const MOCK_VALID_OTP = '123456'

export const mockUser = {
  _id: 'user-admin-1',
  name: 'Aditya Sharma',
  email: 'aditya.sharma@stocksense.in',
  role: USER_ROLES.ADMIN,
  is_email_verified: true,
  status: USER_STATUS.ACTIVE,
}

export const mockToken = 'mock-jwt-token-abc123'
