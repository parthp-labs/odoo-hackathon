import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Table, { Td, Tr } from '../ui/Table'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import { formatDateTime } from '../../utils/formatters'
import { Truck } from 'lucide-react'

const COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'partner', label: 'Partner / Vendor' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'lines', label: 'Items' },
  { key: 'status', label: 'Status' },
  { key: 'date', label: 'Date' },
]

export default function OperationListTable({
  operations = [],
  emptyTitle = 'No operations found',
  emptyMessage = 'There are no operations matching your criteria.',
}) {
  const navigate = useNavigate()

  if (!operations || operations.length === 0) {
    return <EmptyState icon={Truck} title={emptyTitle} message={emptyMessage} />
  }

  return (
    <Table columns={COLUMNS}>
      {operations.map((op) => {
        const itemCount = (op.lines || []).reduce((sum, l) => sum + (l.demand_quantity || 0), 0)
        return (
          <Tr key={op._id} onClick={() => navigate(`/operations/${op._id}`)}>
            <Td className="font-semibold text-primary">{op.reference}</Td>
            <Td className="font-medium text-gray-800">{op.partner_name || '-'}</Td>
            <Td>{op.source_location?.name || 'External'}</Td>
            <Td>{op.destination_location?.name || 'External'}</Td>
            <Td>{itemCount} units ({op.lines?.length || 0} products)</Td>
            <Td>
              <StatusBadge status={op.status} kind="operation" />
            </Td>
            <Td className="text-gray-500">{formatDateTime(op.createdAt)}</Td>
          </Tr>
        )
      })}
    </Table>
  )
}
