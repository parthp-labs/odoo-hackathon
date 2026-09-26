import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RoleRoute({ allowedRoles }) {
  const { user } = useAuth()

  if (!allowedRoles.includes(user?.role)) return <Navigate to="/dashboard" replace />

  return <Outlet />
}
