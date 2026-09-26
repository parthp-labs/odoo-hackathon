import { History } from 'lucide-react'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import { formatNumber, formatDateTime } from '../../utils/formatters'

export default function RecentActivity({ moves = [] }) {
  return (
    <Card title="Recent Activity">
      {moves.length === 0 ? (
        <EmptyState icon={History} title="No recent activity" message="Stock moves will appear here." />
      ) : (
        <div className="divide-y divide-gray-100">
          {moves.map((move) => (
            <div key={move._id} className="py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">{move.product_name}</p>
                <span className="text-xs font-medium text-gray-500">{move.reference}</span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {move.source_location_name} &rarr; {move.destination_location_name} &middot; Qty{' '}
                {formatNumber(move.quantity)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatDateTime(move.move_date)} &middot; {move.user}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
