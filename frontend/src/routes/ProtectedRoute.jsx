import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Loader from '../components/ui/Loader'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader label="Loading StockSense..." />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <Outlet />
}
