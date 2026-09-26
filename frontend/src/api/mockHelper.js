export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

const MOCK_DELAY_MS = 300

// Wraps mock data in a promise that resolves like a real network call.
export function mockResolve(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data }), MOCK_DELAY_MS)
  })
}

// Rejects with an axios-shaped error so callers can use err.response?.data?.message
export function mockReject(message, status = 400, extra = {}) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject({ response: { status, data: { message, ...extra } } })
    }, MOCK_DELAY_MS)
  })
}
