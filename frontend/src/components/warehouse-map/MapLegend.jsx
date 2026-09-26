import { STOCK_STATUS } from '../../utils/constants'

const LEGEND_ITEMS = [
  { status: STOCK_STATUS.IN_STOCK, label: 'In Stock', dot: 'bg-green-500' },
  { status: STOCK_STATUS.LOW_STOCK, label: 'Low Stock', dot: 'bg-amber-500' },
  { status: STOCK_STATUS.OUT_OF_STOCK, label: 'Out of Stock', dot: 'bg-red-500' },
]

export default function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.status} className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
