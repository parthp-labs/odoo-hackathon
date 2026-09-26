import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, PackageMinus } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import Select from '../../components/ui/Select'
import { TableSkeleton } from '../../components/ui/Skeleton'
import ErrorState from '../../components/ui/ErrorState'
import Pagination from '../../components/ui/Pagination'
import OperationListTable from '../../components/operations/OperationListTable'
import { useDebounce } from '../../hooks/useDebounce'
import { usePagination } from '../../hooks/usePagination'
import { getOperations } from '../../api/operations.api'
import { OPERATION_STATUS_OPTIONS } from '../../utils/constants'

export default function Deliveries() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [operations, setOperations] = useState([])
  const [status, setStatus] = useState('loading')
  const { page, limit, setPage } = usePagination(1, 10)

  const debouncedSearch = useDebounce(search, 400)

  async function loadDeliveries() {
    setStatus('loading')
    try {
      const { data } = await getOperations({
        operation_type: 'delivery',
        status: statusFilter,
        search: debouncedSearch,
      })
      setOperations(data || [])
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadDeliveries()
  }, [debouncedSearch, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Deliveries</h1>
          <p className="text-sm text-gray-500">Outgoing shipments and customer delivery orders</p>
        </div>
        <Link to="/operations/new?type=delivery">
          <Button>
            <Plus className="h-4 w-4" /> New Delivery
          </Button>
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder="Search reference or customer..."
            />
          </div>
          <div className="w-full sm:w-52">
            <Select
              options={[{ value: '', label: 'All statuses' }, ...OPERATION_STATUS_OPTIONS]}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setSearchParams(e.target.value ? { status: e.target.value } : {})
                setPage(1)
              }}
            />
          </div>
        </div>

        {status === 'loading' && <TableSkeleton rows={5} />}
        {status === 'error' && <ErrorState message="Could not load deliveries" onRetry={loadDeliveries} />}
        {status === 'loaded' && (
          <>
          <OperationListTable
            operations={operations.slice((page - 1) * limit, page * limit)}
            emptyTitle="No deliveries found"
            emptyMessage="Create a new delivery to dispatch goods to customers."
          />
          <Pagination page={page} limit={limit} total={operations.length} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
