import { useEffect, useState } from 'react'
import { Plus, RotateCcw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Table, { Td, Tr } from '../../components/ui/Table'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import { getLocations } from '../../api/locations.api'
import client from '../../api/client'
import { formatNumber } from '../../utils/formatters'

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Location' },
  { key: 'current', label: 'Recorded On Hand', className: 'text-right' },
  { key: 'counted', label: 'Real Counted Qty', className: 'text-right' },
  { key: 'diff', label: 'Difference', className: 'text-right' },
  { key: 'action', label: '', className: 'text-right' },
]

export default function Adjustments() {
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [stockQuants, setStockQuants] = useState([])
  const [countedQuantities, setCountedQuantities] = useState({})
  const [status, setStatus] = useState('loading')
  const [adjustingId, setAdjustingId] = useState(null)

  async function loadInitial() {
    setStatus('loading')
    try {
      const [locRes, stockRes] = await Promise.all([
        getLocations({ location_type: 'internal' }),
        client.get('/stock'),
      ])
      const internalLocs = locRes.data || []
      setLocations(internalLocs)
      const rawQuants = stockRes.data.data || stockRes.data || []
      const normalized = rawQuants.map((q) => ({
        id: q._id || q.id,
        productId: q.product?._id?.toString() || (typeof q.product === 'string' ? q.product : '') || q.productId,
        productName: q.product?.name || q.productName || 'Unknown Product',
        sku: q.product?.sku || q.sku || '-',
        uom: q.product?.uom || q.uom || 'units',
        locationId: q.location?._id?.toString() || (typeof q.location === 'string' ? q.location : '') || q.locationId,
        locationName: q.location?.name || q.locationName || 'Unknown',
        locationCode: q.location?.code || q.locationCode || '',
        onHand: Number(q.quantity ?? q.onHand ?? 0),
      }))
      setStockQuants(normalized)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadInitial()
  }, [])

  // Functional update so this can't clobber a location the user already picked,
  // regardless of how many times loadInitial's effect fires (e.g. StrictMode).
  useEffect(() => {
    if (locations.length > 0) {
      setSelectedLocation((prev) => prev || locations[0]._id)
    }
  }, [locations])

  // Filter items in current selected location
  const locationItems = stockQuants.filter((q) => q.locationId === selectedLocation)

  function handleCountChange(quantId, val) {
    setCountedQuantities((prev) => ({
      ...prev,
      [quantId]: val,
    }))
  }

  async function handleApplyAdjustment(item) {
    const counted = countedQuantities[item.id]
    if (counted === undefined || counted === '') {
      toast.error('Please enter the real counted quantity')
      return
    }

    const diff = Number(counted) - (item.onHand || 0)
    if (diff === 0) {
      toast('No discrepancy detected (difference is 0)', { icon: 'ℹ️' })
      return
    }

    setAdjustingId(item.id)
    try {
      // Find virtual loss location
      const locRes = await client.get('/locations')
      const allLocs = locRes.data.data || locRes.data || []
      const lossLoc = allLocs.find((l) => l.location_type === 'inventory_loss')

      if (!lossLoc) {
        toast.error('Virtual loss location not found')
        return
      }

      // If diff < 0: Goods lost -> move from item.locationId to lossLoc._id
      // If diff > 0: Extra goods found -> move from lossLoc._id to item.locationId
      const isLoss = diff < 0
      const absQty = Math.abs(diff)

      const payload = {
        operation_type: 'adjustment',
        partner_name: 'Physical Count Adjustment',
        source_location: isLoss ? item.locationId : lossLoc._id,
        destination_location: isLoss ? lossLoc._id : item.locationId,
        notes: `Inventory adjustment count discrepancy: recorded ${item.onHand}, counted ${counted}`,
        lines: [
          {
            product: item.productId,
            quantity_demanded: absQty,
            quantity_done: absQty,
          },
        ],
      }

      const createRes = await client.post('/operations', payload)
      const opId = (createRes.data.data || createRes.data)._id

      // Immediately validate adjustment operation
      await client.post(`/operations/${opId}/validate`)
      toast.success(`Inventory balance adjusted! (${diff > 0 ? '+' : ''}${diff} ${item.uom})`)

      // Reload stock data
      const refreshStock = await client.get('/stock')
      const refreshRaw = refreshStock.data.data || refreshStock.data || []
      const refreshNormalized = refreshRaw.map((q) => ({
        id: q._id || q.id,
        productId: q.product?._id?.toString() || (typeof q.product === 'string' ? q.product : '') || q.productId,
        productName: q.product?.name || q.productName || 'Unknown Product',
        sku: q.product?.sku || q.sku || '-',
        uom: q.product?.uom || q.uom || 'units',
        locationId: q.location?._id?.toString() || (typeof q.location === 'string' ? q.location : '') || q.locationId,
        locationName: q.location?.name || q.locationName || 'Unknown',
        locationCode: q.location?.code || q.locationCode || '',
        onHand: Number(q.quantity ?? q.onHand ?? 0),
      }))
      setStockQuants(refreshNormalized)
      setCountedQuantities((prev) => ({ ...prev, [item.id]: '' }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust inventory')
    } finally {
      setAdjustingId(null)
    }
  }

  if (status === 'loading') return <Loader label="Loading stock records..." />
  if (status === 'error') return <ErrorState message="Could not load inventory items" onRetry={loadInitial} />

  const locationOptions = locations.map((l) => ({
    value: l._id,
    label: `${l.name} (${l.code})`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Physical Inventory Adjustments</h1>
          <p className="text-sm text-gray-500">Record stock counts and reconcile system records with physical floor counts</p>
        </div>
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-80">
            <Select
              label="Select Internal Location to Audit"
              options={locationOptions}
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            />
          </div>
        </div>

        {locationItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No active stock records found for this location.
          </div>
        ) : (
          <Table columns={COLUMNS}>
            {locationItems.map((item) => {
              const counted = countedQuantities[item.id]
              const hasCounted = counted !== undefined && counted !== ''
              const diff = hasCounted ? Number(counted) - (item.onHand || 0) : 0

              return (
                <Tr key={item.id}>
                  <Td className="font-semibold text-gray-800">{item.productName}</Td>
                  <Td className="text-gray-500">{item.sku}</Td>
                  <Td>{item.locationName} ({item.locationCode})</Td>
                  <Td className="text-right font-medium">{formatNumber(item.onHand)} {item.uom}</Td>
                  <Td className="text-right">
                    <div className="inline-block w-28">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Count"
                        value={counted ?? ''}
                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                      />
                    </div>
                  </Td>
                  <Td className="text-right">
                    {hasCounted ? (
                      <span
                        className={`font-semibold ${
                          diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff} {item.uom}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!hasCounted || adjustingId === item.id}
                      loading={adjustingId === item.id}
                      onClick={() => handleApplyAdjustment(item)}
                    >
                      Apply Adjustment
                    </Button>
                  </Td>
                </Tr>
              )
            })}
          </Table>
        )}
      </Card>
    </div>
  )
}
