import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Td, Tr } from '../ui/Table'
import Loader from '../ui/Loader'
import ForecastChart from '../products/ForecastChart'
import TriggerBadge from './TriggerBadge'
import { formatNumber } from '../../utils/formatters'
import { getForecast } from '../../api/replenishment.api'

export default function ReplenishmentRow({ rec, product, engine, horizon }) {
  const [open, setOpen] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [status, setStatus] = useState('idle')

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && status === 'idle') {
      setStatus('loading')
      try {
        const res = await getForecast(rec.sku, { horizon, engine })
        setForecast(res.data)
        setStatus('loaded')
      } catch {
        setStatus('error')
      }
    }
  }

  const bestVendor = rec.vendors?.[0]
  const available = (rec.onHand || 0) - (rec.reserved || 0)
  const reorderPoint = (rec.forecastOverLeadTime || 0) + (rec.safetyStock || 0)

  return (
    <>
      <Tr onClick={toggle} className="cursor-pointer hover:bg-gray-50">
        <Td>
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
            <div>
              <p className="font-medium text-gray-800">{product?.name || rec.sku}</p>
              <p className="text-xs text-gray-400">{rec.sku}</p>
            </div>
          </div>
        </Td>
        <Td className="text-right">{formatNumber(available)}</Td>
        <Td className="text-right">{formatNumber(rec.forecastOverLeadTime)}</Td>
        <Td className="text-right">{formatNumber(rec.safetyStock)}</Td>
        <Td className="text-right font-semibold text-gray-800">{formatNumber(rec.qtyToOrder)}</Td>
        <Td>
          <TriggerBadge trigger={rec.trigger} />
        </Td>
        <Td className="capitalize text-xs text-gray-500">{rec.method}</Td>
        <Td>
          {bestVendor ? (
            <div>
              <p className="text-gray-700">{bestVendor.name}</p>
              <p className="text-xs text-gray-400">
                {bestVendor.currency} {formatNumber(bestVendor.price)}/{bestVendor.uom} &middot; {bestVendor.leadDays}d lead
              </p>
            </div>
          ) : (
            <span className="text-xs text-gray-400">No vendor</span>
          )}
        </Td>
      </Tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-4 py-4">
            {status === 'loading' && <Loader label="Loading forecast..." />}
            {status === 'error' && <p className="py-4 text-center text-sm text-gray-500">Could not load forecast.</p>}
            {status === 'loaded' && forecast && (
              <ForecastChart
                series={forecast.series}
                weekly={forecast.weekly}
                quantiles={forecast.quantiles}
                reorderPoint={reorderPoint}
              />
            )}
          </td>
        </tr>
      )}
    </>
  )
}
