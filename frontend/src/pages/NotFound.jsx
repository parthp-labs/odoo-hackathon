import { Link } from 'react-router-dom'
import { PackageSearch } from 'lucide-react'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <div className="rounded-full bg-primary-50 p-4">
        <PackageSearch className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-800">404 - Page not found</h1>
      <p className="max-w-sm text-sm text-gray-500">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/dashboard">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  )
}
