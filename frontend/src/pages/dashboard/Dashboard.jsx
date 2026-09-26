import { useEffect, useState } from 'react'
import { Boxes, AlertTriangle, Truck, PackageMinus, ArrowLeftRight } from 'lucide-react'
import KpiCard from '../../components/dashboard/KpiCard'
import DashboardFilters from '../../components/dashboard/DashboardFilters'
import LowStockPanel from '../../components/dashboard/LowStockPanel'
import RecentActivity from '../../components/dashboard/RecentActivity'
import StockChart from '../../components/dashboard/StockChart'
import ErrorState from '../../components/ui/ErrorState'
import Skeleton from '../../components/ui/Skeleton'
import { useFilters } from '../../hooks/useFilters'
import {
  getDashboardStats,
  getLowStockItems,
  getRecentActivity,
  getStockByCategory,
  getStockByWarehouse,
} from '../../api/dashboard.api'
import { getWarehouses } from '../../api/warehouses.api'
import { getCategories } from '../../api/categories.api'
import { OPERATION_STATUS, STOCK_STATUS } from '../../utils/constants'

const DEFAULT_FILTERS = { type: '', status: '', warehouse: '', category: '' }

export default function Dashboard() {
  const { filters, setFilter } = useFilters(DEFAULT_FILTERS)
  const [warehouses, setWarehouses] = useState([])
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [lowStockItems, setLowStockItems] = useState([])
  const [recentMoves, setRecentMoves] = useState([])
  const [byCategory, setByCategory] = useState([])
  const [byWarehouse, setByWarehouse] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getWarehouses().then(({ data }) => setWarehouses(data))
    getCategories().then(({ data }) => setCategories(data))
  }, [])

  async function loadDashboard() {
    setStatus('loading')
    try {
      const [statsRes, lowStockRes, activityRes, byCategoryRes, byWarehouseRes] = await Promise.all([
        getDashboardStats(filters),
        getLowStockItems(filters),
        getRecentActivity(filters),
        getStockByCategory(filters),
        getStockByWarehouse(filters),
      ])
      setStats(statsRes.data)
      setLowStockItems(lowStockRes.data)
      setRecentMoves(activityRes.data)
      setByCategory(byCategoryRes.data)
      setByWarehouse(byWarehouseRes.data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'error') {
    return <ErrorState message="Could not load dashboard data" onRetry={loadDashboard} />
  }

  return (
    <div className="space-y-6">
      <DashboardFilters filters={filters} onChange={setFilter} warehouses={warehouses} categories={categories} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {status === 'loading' || !stats ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <KpiCard
              icon={Boxes}
              label="Total Products in Stock"
              value={stats.total_products_in_stock}
              to="/products"
              accent="primary"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Low Stock / Out of Stock"
              value={stats.low_stock_count + stats.out_of_stock_count}
              to={`/products?stock=${STOCK_STATUS.LOW_STOCK}`}
              accent="amber"
            />
            <KpiCard
              icon={Truck}
              label="Pending Receipts"
              value={stats.pending_receipts}
              to={`/operations/receipts?status=${OPERATION_STATUS.READY}`}
              accent="blue"
            />
            <KpiCard
              icon={PackageMinus}
              label="Pending Deliveries"
              value={stats.pending_deliveries}
              to={`/operations/deliveries?status=${OPERATION_STATUS.READY}`}
              accent="blue"
            />
            <KpiCard
              icon={ArrowLeftRight}
              label="Internal Transfers Scheduled"
              value={stats.transfers_scheduled}
              to={`/operations/transfers?status=${OPERATION_STATUS.WAITING}`}
              accent="green"
            />
          </>
        )}
      </div>

      <StockChart byCategory={byCategory} byWarehouse={byWarehouse} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LowStockPanel items={lowStockItems} />
        <RecentActivity moves={recentMoves} />
      </div>
    </div>
  )
}
