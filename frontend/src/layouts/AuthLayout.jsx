import { Outlet } from 'react-router-dom'
import { Boxes } from 'lucide-react'

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="rounded-lg bg-primary p-2">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-800">StockSense</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
