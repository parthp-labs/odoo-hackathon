import { useNavigate } from 'react-router-dom'
import { PackageCheck } from 'lucide-react'
import Card from '../ui/Card'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import { formatNumber } from '../../utils/formatters'
import { STOCK_STATUS } from '../../utils/constants'

export default function LowStockPanel({ items = [] }) {
  const navigate = useNavigate()

  return (
    <Card title="Low Stock & Out of Stock">
      {items.length === 0 ? (
        <EmptyState icon={PackageCheck} title="All stocked up" message="No products are currently low or out of stock." />
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <button
              key={item._id}
              onClick={() => navigate(`/products/${item._id}`)}
              className="flex w-full items-center justify-between py-2.5 text-left hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.sku} &middot; On hand {formatNumber(item.on_hand)} / Min {formatNumber(item.min_quantity)}
                </p>
              </div>
              <StatusBadge
                status={item.status === STOCK_STATUS.OUT_OF_STOCK ? STOCK_STATUS.OUT_OF_STOCK : STOCK_STATUS.LOW_STOCK}
                kind="stock"
              />
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
