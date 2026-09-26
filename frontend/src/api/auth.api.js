// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve, mockReject } from './mockHelper'
import { mockUser, mockToken, MOCK_VALID_OTP } from '../mocks/auth.mock'
import { OTP_MAX_ATTEMPTS } from '../utils/constants'

const attemptsByPurpose = {}

function checkMockOtp(otp, purpose) {
  attemptsByPurpose[purpose] = attemptsByPurpose[purpose] ?? OTP_MAX_ATTEMPTS
  if (otp === MOCK_VALID_OTP) {
    attemptsByPurpose[purpose] = OTP_MAX_ATTEMPTS
    return true
  }
  attemptsByPurpose[purpose] -= 1
  return false
}

export const signup = (payload) => {
  if (USE_MOCKS) return mockResolve({ email: payload.email, message: 'Signup successful. Please verify your email.' })
  return client.post('/auth/signup', payload)
}

export const login = (payload) => {
  if (USE_MOCKS) return mockResolve({ token: mockToken, user: mockUser })
  return client.post('/auth/login', payload)
}

export const verifyEmail = ({ email, otp }) => {
  if (USE_MOCKS) {
    if (checkMockOtp(otp, 'email_verification')) {
      return mockResolve({ message: 'Email verified successfully' })
    }
    return mockReject('Invalid or expired code', 400, {
      attempts_left: attemptsByPurpose.email_verification,
    })
  }
  return client.post('/auth/verify-email', { email, otp })
}

export const resendOtp = ({ email, purpose }) => {
  if (USE_MOCKS) {
    attemptsByPurpose[purpose] = OTP_MAX_ATTEMPTS
    return mockResolve({ message: 'A new code has been sent' })
  }
  return client.post('/auth/resend-otp', { email, purpose })
}

export const forgotPassword = ({ email }) => {
  if (USE_MOCKS) return mockResolve({ message: 'Reset code sent to your email' })
  return client.post('/auth/forgot-password', { email })
}

export const resetPassword = ({ email, otp, password }) => {
  if (USE_MOCKS) {
    if (checkMockOtp(otp, 'password_reset')) {
      return mockResolve({ message: 'Password reset successfully' })
    }
    return mockReject('Invalid or expired code', 400, {
      attempts_left: attemptsByPurpose.password_reset,
    })
  }
  return client.post('/auth/reset-password', { email, otp, password })
}

export const changePassword = (payload) => {
  if (USE_MOCKS) return mockResolve({ message: 'Password changed successfully' })
  return client.post('/auth/change-password', payload)
}

export const getMe = () => {
  if (USE_MOCKS) return mockResolve(mockUser)
  return client.get('/auth/me')
}
