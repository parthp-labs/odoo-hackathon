import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  PackageMinus,
  ArrowLeftRight,
  ClipboardList,
  History,
  Warehouse,
  LayoutGrid,
  MapPin,
  Boxes,
  TrendingUp,
  X,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { USER_ROLES } from '../utils/constants'

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
const linkInactive = 'text-gray-600 hover:bg-gray-100'
const linkActive = 'bg-primary-50 text-primary'

function NavItem({ to, icon: Icon, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function SectionLabel({ children }) {
  return <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</p>
}

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth()
  const showSettings = user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.INVENTORY_MANAGER

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary p-1.5">
                <Boxes className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-800">StockSense</span>
            </div>
            <button type="button" className="p-1 text-gray-400 lg:hidden" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" onNavigate={onClose} />
            <NavItem to="/warehouse-map" icon={LayoutGrid} label="Warehouse Map" onNavigate={onClose} />
            <NavItem to="/replenishment" icon={TrendingUp} label="Replenishment" onNavigate={onClose} />

            <SectionLabel>Products</SectionLabel>
            <NavItem to="/products" icon={Package} label="Products" onNavigate={onClose} />
            <NavItem to="/categories" icon={Tags} label="Categories" onNavigate={onClose} />

            <SectionLabel>Operations</SectionLabel>
            <NavItem to="/operations/receipts" icon={Truck} label="Receipts" onNavigate={onClose} />
            <NavItem to="/operations/deliveries" icon={PackageMinus} label="Deliveries" onNavigate={onClose} />
            <NavItem to="/operations/transfers" icon={ArrowLeftRight} label="Internal Transfers" onNavigate={onClose} />
            <NavItem to="/operations/adjustments" icon={ClipboardList} label="Adjustments" onNavigate={onClose} />
            <NavItem to="/moves" icon={History} label="Move History" onNavigate={onClose} />

            {showSettings && (
              <>
                <SectionLabel>Settings</SectionLabel>
                <NavItem to="/settings/warehouses" icon={Warehouse} label="Warehouses" onNavigate={onClose} />
                <NavItem to="/settings/locations" icon={MapPin} label="Locations" onNavigate={onClose} />
              </>
            )}
          </nav>
        </div>
      </aside>
    </>
  )
}
