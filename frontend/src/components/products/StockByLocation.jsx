import Table, { Td, Tr } from '../ui/Table'
import EmptyState from '../ui/EmptyState'
import { formatNumber } from '../../utils/formatters'
import { MapPin } from 'lucide-react'

const COLUMNS = [
  { key: 'location', label: 'Location' },
  { key: 'on_hand', label: 'On Hand', className: 'text-right' },
  { key: 'reserved', label: 'Reserved', className: 'text-right' },
  { key: 'available', label: 'Available', className: 'text-right' },
]

export default function StockByLocation({ rows }) {
  if (!rows || rows.length === 0) {
    return <EmptyState icon={MapPin} title="No stock recorded" message="This product has no stock at any location yet." />
  }

  return (
    <Table columns={COLUMNS}>
      {rows.map((row) => (
        <Tr key={row.location_id}>
          <Td className="font-medium text-gray-800">{row.location_name}</Td>
          <Td className="text-right">{formatNumber(row.on_hand)}</Td>
          <Td className="text-right">{formatNumber(row.reserved)}</Td>
          <Td className="text-right">{formatNumber(row.available)}</Td>
        </Tr>
      ))}
    </Table>
  )
}
