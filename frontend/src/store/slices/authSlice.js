import { createSlice } from '@reduxjs/toolkit'

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const initialState = {
  token: localStorage.getItem('token') || null,
  user: getStoredUser(),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token, user } = action.payload
      state.token = token
      state.user = user
      state.isAuthenticated = !!token
      state.loading = false
      if (token) {
        localStorage.setItem('token', token)
      }
      if (user) {
        localStorage.setItem('user', JSON.stringify(user))
      }
    },
    updateUser: (state, action) => {
      const updated = { ...state.user, ...action.payload }
      state.user = updated
      localStorage.setItem('user', JSON.stringify(updated))
    },
    logOut: (state) => {
      state.token = null
      state.user = null
      state.isAuthenticated = false
      state.loading = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
    setAuthLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const { setCredentials, updateUser, logOut, setAuthLoading } = authSlice.actions

export const selectCurrentUser = (state) => state.auth.user
export const selectCurrentToken = (state) => state.auth.token
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated

export default authSlice.reducer
