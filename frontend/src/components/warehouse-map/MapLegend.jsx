import { RACK_STATUS } from '../../hooks/useWarehouseMap'

const LEGEND_ITEMS = [
  { status: RACK_STATUS.IN_STOCK, label: 'In Stock', dot: 'bg-green-500' },
  { status: RACK_STATUS.LOW_STOCK, label: 'Low Stock', dot: 'bg-amber-500' },
  { status: RACK_STATUS.OUT_OF_STOCK, label: 'Out of Stock', dot: 'bg-red-500' },
  { status: RACK_STATUS.NO_RULE, label: 'No Rule', dot: 'bg-gray-400' },
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
