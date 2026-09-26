import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, PackageSearch } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import SearchInput from '../../components/ui/SearchInput'
import Select from '../../components/ui/Select'
import Pagination from '../../components/ui/Pagination'
import { TableSkeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import ProductTable from '../../components/products/ProductTable'
import { useDebounce } from '../../hooks/useDebounce'
import { usePagination } from '../../hooks/usePagination'
import { getProducts } from '../../api/products.api'
import { getCategories } from '../../api/categories.api'
import { STOCK_STATUS, STOCK_STATUS_LABELS } from '../../utils/constants'

const STOCK_STATUS_OPTIONS = Object.values(STOCK_STATUS).map((value) => ({
  value,
  label: STOCK_STATUS_LABELS[value],
}))

export default function ProductList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { page, limit, setPage } = usePagination(1, 10)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [stockStatus, setStockStatus] = useState(searchParams.get('stock') || '')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading')

  const debouncedSearch = useDebounce(search, 400)

  useEffect(() => {
    getCategories().then(({ data }) => setCategories(data))
  }, [])

  async function loadProducts() {
    setStatus('loading')
    try {
      const { data } = await getProducts({
        search: debouncedSearch,
        category,
        stock_status: stockStatus,
        page,
        limit,
      })
      setProducts(data.items)
      setTotal(data.total)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadProducts()
  }, [debouncedSearch, category, stockStatus, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryMap = Object.fromEntries(categories.map((c) => [c._id, c.name]))
  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }))

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Products</h1>
        <Button onClick={() => navigate('/products/new')}>
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Search by name or SKU..."
            className="sm:w-72"
          />
          <Select
            options={categoryOptions}
            placeholder="All categories"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="sm:w-56"
          />
          <Select
            options={STOCK_STATUS_OPTIONS}
            placeholder="All stock statuses"
            value={stockStatus}
            onChange={(e) => {
              setStockStatus(e.target.value)
              setPage(1)
            }}
            className="sm:w-56"
          />
        </div>

        {status === 'loading' && <TableSkeleton rows={6} cols={6} />}

        {status === 'error' && <ErrorState message="Could not load products" onRetry={loadProducts} />}

        {status === 'loaded' && products.length === 0 && (
          <EmptyState
            icon={PackageSearch}
            title="No products found"
            message="Try adjusting your search or filters, or add a new product."
            actionLabel="New Product"
            onAction={() => navigate('/products/new')}
          />
        )}

        {status === 'loaded' && products.length > 0 && (
          <>
            <ProductTable products={products} categoryMap={categoryMap} />
            <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
