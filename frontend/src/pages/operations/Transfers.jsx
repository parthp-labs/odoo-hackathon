import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, ArrowLeftRight } from 'lucide-react'
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

export default function Transfers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [operations, setOperations] = useState([])
  const [status, setStatus] = useState('loading')
  const { page, limit, setPage } = usePagination(1, 10)

  const debouncedSearch = useDebounce(search, 400)

  async function loadTransfers() {
    setStatus('loading')
    try {
      const { data } = await getOperations({
        operation_type: 'internal_transfer',
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
    loadTransfers()
  }, [debouncedSearch, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Internal Transfers</h1>
          <p className="text-sm text-gray-500">Relocate inventory between racks, zones, or warehouses</p>
        </div>
        <Link to="/operations/new?type=internal_transfer">
          <Button>
            <Plus className="h-4 w-4" /> New Transfer
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
              placeholder="Search reference..."
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
        {status === 'error' && <ErrorState message="Could not load transfers" onRetry={loadTransfers} />}
        {status === 'loaded' && (
          <>
          <OperationListTable
            operations={operations.slice((page - 1) * limit, page * limit)}
            emptyTitle="No transfers found"
            emptyMessage="Create a new transfer to move stock between internal warehouse locations."
          />
          <Pagination page={page} limit={limit} total={operations.length} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
