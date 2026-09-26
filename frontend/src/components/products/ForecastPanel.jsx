import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Card from '../ui/Card'
import Loader from '../ui/Loader'
import ForecastChart from './ForecastChart'
import { formatNumber, formatDateTime } from '../../utils/formatters'
import { getForecast } from '../../api/replenishment.api'

const ENGINES = [
  { value: 'svm', label: 'SVM (trained)' },
  { value: 'stats', label: 'Statistical' },
]
const HORIZONS = [4, 8, 12]

export default function ForecastPanel({ sku, reorderPoint }) {
  const [engine, setEngine] = useState('svm')
  const [horizon, setHorizon] = useState(8)
  const [forecast, setForecast] = useState(null)
  const [status, setStatus] = useState('loading')

  async function load() {
    setStatus('loading')
    try {
      const res = await getForecast(sku, { horizon, engine })
      setForecast(res.data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (sku) load()
  }, [sku, engine, horizon]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card
      title="Demand forecast"
      action={
        <div className="flex items-center gap-2">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600"
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
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600"
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h} weeks
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Refresh forecast"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      {status === 'loading' && <Loader label="Forecasting..." />}
      {status === 'error' && <p className="py-8 text-center text-sm text-gray-500">Could not load a forecast for this SKU.</p>}
      {status === 'loaded' && forecast && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Forecasted demand ({horizon}w)</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-800">{formatNumber(forecast.forecastedDemand)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Range (p10 - p90)</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-800">
                {formatNumber(forecast.quantiles?.p10)} - {formatNumber(forecast.quantiles?.p90)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Model</p>
              <p className="mt-0.5 text-lg font-semibold capitalize text-gray-800">{forecast.modelType}</p>
            </div>
          </div>
          <ForecastChart
            series={forecast.series}
            weekly={forecast.weekly}
            quantiles={forecast.quantiles}
            reorderPoint={reorderPoint}
          />
          <p className="text-right text-xs text-gray-400">Generated {formatDateTime(forecast.generatedAt)}</p>
        </div>
      )}
    </Card>
  )
}
