import {
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '../../utils/formatters'

const HISTORY_COLOR = '#9CA3AF'
const FORECAST_COLOR = '#4F46E5'
const BAND_COLOR = '#4F46E5'

/**
 * Builds the chart series: trailing history weeks followed by the forecast
 * horizon, in the same shape Odoo's "Forecasted" report uses — actual demand
 * up to today, projected demand (with a confidence band) beyond it.
 */
function buildChartData(series = [], weekly = [], quantiles = {}) {
  const histWeeks = series.length
  const totalForecast = weekly.reduce((a, b) => a + b, 0) || 1
  // Spread the total p10/p90 band proportionally across each forecast week
  // so the band narrows/widens with the shape of the weekly forecast.
  const spreadLow = quantiles.p10 != null ? (quantiles.p50 - quantiles.p10) : null
  const spreadHigh = quantiles.p90 != null ? (quantiles.p90 - quantiles.p50) : null

  const history = series.map((v, i) => ({
    label: `W-${histWeeks - i}`,
    history: v,
  }))

  const forecast = weekly.map((v, i) => {
    const weight = v / totalForecast
    const low = spreadLow != null ? Math.max(0, v - spreadLow * weight) : null
    const high = spreadHigh != null ? v + spreadHigh * weight : null
    return {
      label: `F+${i + 1}`,
      forecast: v,
      band: high != null && low != null ? [low, high] : undefined,
    }
  })

  // Bridge point so the forecast line connects visually to the last history point.
  if (history.length && forecast.length) {
    forecast[0] = { ...forecast[0], bridge: history[history.length - 1].history }
    history[history.length - 1] = { ...history[history.length - 1], bridge: history[history.length - 1].history }
  }

  return [...history, ...forecast]
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const hist = payload.find((p) => p.dataKey === 'history')
  const fc = payload.find((p) => p.dataKey === 'forecast' || p.dataKey === 'bridge')
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-700">{label}</p>
      {hist && <p className="text-gray-500">Actual demand: {formatNumber(hist.value)}</p>}
      {fc && <p className="text-primary">Forecasted demand: {formatNumber(fc.value)}</p>}
    </div>
  )
}

export default function ForecastChart({ series = [], weekly = [], quantiles = {}, reorderPoint }) {
  const data = buildChartData(series, weekly, quantiles)
  const hasHistory = series.length > 0
  const hasForecast = weekly.length > 0

  if (!hasHistory && !hasForecast) {
    return <p className="py-8 text-center text-sm text-gray-500">Not enough demand history to forecast yet.</p>
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (value === 'history' ? 'Actual demand' : value === 'band' ? 'Forecast range' : 'Forecasted demand')}
          />
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill={BAND_COLOR}
            fillOpacity={0.12}
            isAnimationActive={false}
            connectNulls
          />
          <Bar dataKey="history" fill={HISTORY_COLOR} radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Line
            type="monotone"
            dataKey="bridge"
            stroke={FORECAST_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={FORECAST_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: FORECAST_COLOR }}
            connectNulls
          />
          {typeof reorderPoint === 'number' && (
            <ReferenceLine
              y={reorderPoint}
              stroke="#DC2626"
              strokeDasharray="4 4"
              label={{ value: 'Reorder point', position: 'insideTopRight', fontSize: 10, fill: '#DC2626' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
