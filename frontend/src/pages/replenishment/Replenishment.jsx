import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PackageSearch, AlertTriangle, ListChecks, RefreshCw, Cpu } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import KpiCard from '../../components/dashboard/KpiCard'
import ReplenishmentTable from '../../components/replenishment/ReplenishmentTable'
import { formatDateTime } from '../../utils/formatters'
import { getRecommendations, getModelInfo, runRefit } from '../../api/replenishment.api'
import { getProductCatalog } from '../../api/products.api'

const ENGINES = [
  { value: 'svm', label: 'SVM (trained)' },
  { value: 'stats', label: 'Statistical' },
]
const HORIZONS = [4, 8, 12]

export default function Replenishment() {
  const [recommendations, setRecommendations] = useState([])
  const [productMap, setProductMap] = useState({})
  const [modelInfo, setModelInfo] = useState(null)
  const [engine, setEngine] = useState('svm')
  const [horizon, setHorizon] = useState(8)
  const [search, setSearch] = useState('')
  const [onlyReorder, setOnlyReorder] = useState(false)
  const [status, setStatus] = useState('loading')
  const [running, setRunning] = useState(false)

  async function loadData() {
    setStatus('loading')
    try {
      const [recRes, infoRes, productsRes] = await Promise.all([
        getRecommendations(),
        getModelInfo(),
        getProductCatalog(),
      ])
      setRecommendations(Array.isArray(recRes.data) ? recRes.data : [])
      setModelInfo(infoRes.data)
      const pMap = Object.fromEntries(
        (productsRes.data || []).map((p) => [p.sku, p]),
      )
      setProductMap(pMap)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRun() {
    setRunning(true)
    try {
      await runRefit({ horizon, engine })
      toast.success('Forecast refit complete')
      await loadData()
    } catch {
      toast.error('Could not run the forecast refit')
    } finally {
      setRunning(false)
    }
  }

  const filtered = useMemo(() => {
    let rows = recommendations
    if (onlyReorder) rows = rows.filter((r) => r.trigger === 'reorder')
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) => r.sku.toLowerCase().includes(q) || productMap[r.sku]?.name?.toLowerCase().includes(q),
      )
    }
    return rows
  }, [recommendations, onlyReorder, search, productMap])

  const kpis = useMemo(() => {
    const needReorder = recommendations.filter((r) => r.trigger === 'reorder')
    const totalToOrder = needReorder.reduce((sum, r) => sum + (r.qtyToOrder || 0), 0)
    return { total: recommendations.length, needReorder: needReorder.length, totalToOrder }
  }, [recommendations])

  if (status === 'loading') return <Loader label="Loading replenishment data..." />
  if (status === 'error') return <ErrorState message="Could not load replenishment data" onRetry={loadData} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Replenishment</h1>
          <p className="text-sm text-gray-500">Demand-forecast driven reorder recommendations, per SKU.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600"
          >
            {ENGINES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600"
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h}-week horizon
              </option>
            ))}
          </select>
          <Button onClick={handleRun} loading={running}>
            <RefreshCw className="h-4 w-4" /> Run forecast
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={PackageSearch} label="Forecasted SKUs" value={kpis.total} accent="primary" />
        <KpiCard icon={AlertTriangle} label="Need reordering" value={kpis.needReorder} accent="amber" />
        <KpiCard icon={ListChecks} label="Total units to order" value={kpis.totalToOrder} accent="blue" />
      </div>

      {modelInfo && (
        <Card>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <Cpu className="h-3.5 w-3.5" /> {modelInfo.model}
            </span>
            <span>Version {modelInfo.version}</span>
            {modelInfo.metrics?.wape != null && <span>WAPE {(modelInfo.metrics.wape * 100).toFixed(1)}%</span>}
            <span>Trained {formatDateTime(modelInfo.trainedAt)}</span>
          </div>
        </Card>
      )}

      <Card
        title="Recommendations"
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input type="checkbox" checked={onlyReorder} onChange={(e) => setOnlyReorder(e.target.checked)} />
              Needs reorder only
            </label>
            <input
              type="text"
              placeholder="Search SKU or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
            />
          </div>
        }
      >
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No SKUs match this view.</p>
        ) : (
          <ReplenishmentTable recommendations={filtered} productMap={productMap} engine={engine} horizon={horizon} />
        )}
      </Card>
    </div>
  )
}
