import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  prepareHeaders: (headers, { getState }) => {
    // Attempt to grab token from Redux auth slice or fallback to localStorage
    const token = getState()?.auth?.token || localStorage.getItem('token')
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
})

// Custom baseQuery wrapper to handle 401 Unauthorized globally
const baseQueryWithReauth = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error && result.error.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    api.dispatch({ type: 'auth/logOut' })
  }
  return result
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Product', 'Category', 'Warehouse', 'Location', 'Operation', 'Move', 'Dashboard'],
  endpoints: () => ({}),
})
