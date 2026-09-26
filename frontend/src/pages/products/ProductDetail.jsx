import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import StatusBadge from '../../components/ui/StatusBadge'
import StockByLocation from '../../components/products/StockByLocation'
import { formatNumber, formatEnumLabel } from '../../utils/formatters'
import { getProduct, getProductStockByLocation } from '../../api/products.api'
import { getWarehouses } from '../../api/warehouses.api'
import { getCategories } from '../../api/categories.api'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [stockRows, setStockRows] = useState([])
  const [warehouseMap, setWarehouseMap] = useState({})
  const [categoryMap, setCategoryMap] = useState({})
  const [status, setStatus] = useState('loading')

  async function loadData() {
    setStatus('loading')
    try {
      const [productRes, stockRes, warehousesRes, categoriesRes] = await Promise.all([
        getProduct(id),
        getProductStockByLocation(id),
        getWarehouses(),
        getCategories(),
      ])
      if (!productRes.data) {
        setStatus('error')
        return
      }
      setProduct(productRes.data)
      setStockRows(stockRes.data)
      setWarehouseMap(Object.fromEntries(warehousesRes.data.map((w) => [w._id, w.name])))
      setCategoryMap(Object.fromEntries(categoriesRes.data.map((c) => [c._id, c.name])))
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadData()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <Loader />
  if (status === 'error') return <ErrorState message="Could not load product" onRetry={loadData} />
  if (!product) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{product.name}</h1>
          <p className="text-sm text-gray-500">{product.sku}</p>
        </div>
        <Link to={`/products/${id}/edit`}>
          <Button variant="secondary">
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </Link>
      </div>

      <Card title="Product information">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Category</dt>
            <dd className="mt-1 text-sm text-gray-800">{categoryMap[product.category] || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Unit of measure</dt>
            <dd className="mt-1 text-sm capitalize text-gray-800">{formatEnumLabel(product.uom)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Stock status</dt>
            <dd className="mt-1">
              <StatusBadge status={product.stock_status} kind="stock" />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">On hand</dt>
            <dd className="mt-1 text-sm text-gray-800">{formatNumber(product.on_hand_quantity)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Reserved</dt>
            <dd className="mt-1 text-sm text-gray-800">{formatNumber(product.reserved_quantity)}</dd>
          </div>
          {product.description && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Description</dt>
              <dd className="mt-1 text-sm text-gray-800">{product.description}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card title="Stock by location">
        <StockByLocation rows={stockRows} />
      </Card>

      <Card title="Reordering rules">
        {(!product.reordering_rules || product.reordering_rules.length === 0) && (
          <p className="text-sm text-gray-500">No reordering rules configured.</p>
        )}
        {product.reordering_rules && product.reordering_rules.length > 0 && (
          <div className="space-y-2">
            {product.reordering_rules.map((rule, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm"
              >
                <span className="font-medium text-gray-700">
                  {rule.warehouse_name || warehouseMap[rule.warehouse?._id || rule.warehouse] || (typeof rule.warehouse === 'object' ? rule.warehouse?.name : rule.warehouse) || 'Warehouse'}
                </span>
                <span className="text-gray-500">
                  Min {formatNumber(rule.min_quantity)} &middot; Max {formatNumber(rule.max_quantity)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
