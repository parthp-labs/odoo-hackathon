import { getStatusBadgeClass, getStockStatusBadgeClass } from '../../utils/statusColors'
import { formatEnumLabel } from '../../utils/formatters'
import { STOCK_STATUS_LABELS } from '../../utils/constants'

export default function StatusBadge({ status, kind = 'operation' }) {
  const isStock = kind === 'stock'
  const badgeClass = isStock ? getStockStatusBadgeClass(status) : getStatusBadgeClass(status)
  const label = isStock ? STOCK_STATUS_LABELS[status] || formatEnumLabel(status) : formatEnumLabel(status)

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${badgeClass}`}
    >
      {label}
    </span>
  )
}
