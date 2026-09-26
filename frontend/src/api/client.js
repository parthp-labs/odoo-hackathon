import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Strip empty/null/undefined query params so filters like category=""
  // don't reach the backend as literal query string values.
  if (config.params) {
    const cleaned = {}
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== '' && value !== null && value !== undefined) cleaned[key] = value
    }
    config.params = cleaned
  }

  return config
})

client.interceptors.response.use(
  (response) => {
    // Backend wraps list/detail responses as { success, data }. Unwrap so callers
    // can treat response.data as the payload directly, like the rest of the app expects.
    // Pass { skipUnwrap: true } in a request config to keep the full envelope (e.g. when
    // sibling fields like `summary` alongside `data` are also needed).
    const body = response.data
    if (!response.config?.skipUnwrap && body && typeof body === 'object' && body.success === true && 'data' in body) {
      response.data = body.data
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default client
