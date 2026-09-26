import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, ChevronDown, User, LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useDebounce } from '../hooks/useDebounce'
import { getProducts } from '../api/products.api'
import { initialsFromName, formatEnumLabel } from '../utils/formatters'

const PAGE_TITLES = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/products', title: 'Products' },
  { prefix: '/categories', title: 'Categories' },
  { prefix: '/operations/receipts', title: 'Receipts' },
  { prefix: '/operations/deliveries', title: 'Deliveries' },
  { prefix: '/operations/transfers', title: 'Internal Transfers' },
  { prefix: '/operations/adjustments', title: 'Adjustments' },
  { prefix: '/operations', title: 'Operations' },
  { prefix: '/moves', title: 'Move History' },
  { prefix: '/settings/warehouses', title: 'Warehouses' },
  { prefix: '/settings/locations', title: 'Locations' },
  { prefix: '/profile', title: 'My Profile' },
]

function getPageTitle(pathname) {
  const match = PAGE_TITLES.find((p) => pathname.startsWith(p.prefix))
  return match?.title || 'StockSense'
}

export default function Topbar({ onMenuClick }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const searchRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      return
    }
    let active = true
    setSearching(true)
    getProducts({ search: debouncedQuery, limit: 5 })
      .then(({ data }) => {
        if (active) setResults(data.items)
      })
      .finally(() => {
        if (active) setSearching(false)
      })
    return () => {
      active = false
    }
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function goToProduct(id) {
    setQuery('')
    setShowResults(false)
    navigate(`/products/${id}`)
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <button type="button" className="text-gray-500 lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold text-gray-800">{getPageTitle(location.pathname)}</h1>

      <div className="ml-auto flex items-center gap-3">
        <div ref={searchRef} className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search by SKU or name..."
            className="w-56 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary md:w-72"
          />
          {showResults && query && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
              {searching && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">No products found</div>
              )}
              {!searching &&
                results.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => goToProduct(p._id)}
                    className="flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-500">{p.sku}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {initialsFromName(user?.name)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-gray-800">{user?.name}</p>
              <p className="text-xs text-gray-500">{formatEnumLabel(user?.role)}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/profile')
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4" /> My Profile
              </button>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
