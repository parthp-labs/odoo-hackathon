import { useEffect, useState } from 'react'
import { Plus, History } from 'lucide-react'
import Card from '../../components/ui/Card'
import Table, { Td, Tr } from '../../components/ui/Table'
import SearchInput from '../../components/ui/SearchInput'
import Select from '../../components/ui/Select'
import StatusBadge from '../../components/ui/StatusBadge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import { useDebounce } from '../../hooks/useDebounce'
import { getMoves } from '../../api/moves.api'
import { formatDateTime, formatNumber } from '../../utils/formatters'

const COLUMNS = [
  { key: 'date', label: 'Date & Time' },
  { key: 'reference', label: 'Operation Ref' },
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'from', label: 'Source Location' },
  { key: 'to', label: 'Destination Location' },
  { key: 'qty', label: 'Quantity', className: 'text-right' },
  { key: 'user', label: 'Validated By' },
  { key: 'status', label: 'Status' },
]

export default function MoveHistory() {
  const [search, setSearch] = useState('')
  const [moves, setMoves] = useState([])
  const [status, setStatus] = useState('loading')

  const debouncedSearch = useDebounce(search, 300)

  async function loadMoves() {
    setStatus('loading')
    try {
      const { data } = await getMoves({ search: debouncedSearch })
      setMoves(data || [])
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadMoves()
  }, [debouncedSearch])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Stock Move History Ledger</h1>
        <p className="text-sm text-gray-500">Immutable double-entry audit trail of all physical inventory movements</p>
      </div>

      <Card>
        <div className="mb-4 w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference or product..."
          />
        </div>

        {status === 'loading' && <TableSkeleton rows={6} />}
        {status === 'error' && <ErrorState message="Could not load move history" onRetry={loadMoves} />}
        {status === 'loaded' && moves.length === 0 && (
          <EmptyState
            icon={History}
            title="No stock moves recorded"
            message="Stock movements will appear here once operations are validated."
          />
        )}
        {status === 'loaded' && moves.length > 0 && (
          <Table columns={COLUMNS}>
            {moves.map((m) => (
              <Tr key={m.id || m._id}>
                <Td className="text-gray-500 text-xs">{formatDateTime(m.date || m.move_date)}</Td>
                <Td className="font-semibold text-primary">{m.reference}</Td>
                <Td className="font-medium text-gray-800">{m.productName || m.product_name}</Td>
                <Td className="text-gray-500">{m.sku || '-'}</Td>
                <Td>{m.fromLocation || m.source_location_name}</Td>
                <Td>{m.toLocation || m.destination_location_name}</Td>
                <Td className="text-right font-medium text-gray-900">
                  {formatNumber(m.quantity)} {m.uom || ''}
                </Td>
                <Td className="text-gray-600 text-xs">{m.validatedBy || m.user || 'System'}</Td>
                <Td>
                  <StatusBadge status={m.status || 'done'} kind="operation" />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
