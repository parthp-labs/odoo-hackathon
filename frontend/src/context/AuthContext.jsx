import { createContext, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import * as authApiAxios from '../api/auth.api'
import {
  setCredentials,
  updateUser as updateUserAction,
  logOut as logOutAction,
  setAuthLoading,
  selectCurrentUser,
  selectCurrentToken,
  selectIsAuthenticated,
} from '../store/slices/authSlice'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const dispatch = useDispatch()
  const user = useSelector(selectCurrentUser)
  const token = useSelector(selectCurrentToken)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const loading = useSelector((state) => state.auth.loading)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    if (storedUser && storedToken) {
      try {
        dispatch(
          setCredentials({
            user: JSON.parse(storedUser),
            token: storedToken,
          })
        )
      } catch {
        dispatch(logOutAction())
      }
    }
  }, [dispatch])

  async function login(credentials) {
    dispatch(setAuthLoading(true))
    try {
      const { data } = await authApiAxios.login(credentials)
      dispatch(
        setCredentials({
          token: data.token,
          user: data.user,
        })
      )
      return data.user
    } finally {
      dispatch(setAuthLoading(false))
    }
  }

  function logout() {
    dispatch(logOutAction())
  }

  function updateUser(patch) {
    dispatch(updateUserAction(patch))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
