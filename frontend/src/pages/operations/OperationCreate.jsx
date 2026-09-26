import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Loader from '../../components/ui/Loader'
import { getLocations } from '../../api/locations.api'
import { getProducts } from '../../api/products.api'
import { createOperation } from '../../api/operations.api'
import { OPERATION_TYPES, OPERATION_TYPE_OPTIONS } from '../../utils/constants'

export default function OperationCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type') || OPERATION_TYPES.RECEIPT

  const [operationType, setOperationType] = useState(initialType)
  const [partnerName, setPartnerName] = useState('')
  const [sourceLocation, setSourceLocation] = useState('')
  const [destinationLocation, setDestinationLocation] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([{ product: '', quantity_demanded: 1, quantity_done: 0 }])

  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const [locRes, prodRes] = await Promise.all([
          getLocations(),
          getProducts({ limit: 100 }),
        ])
        setLocations(locRes.data || [])
        setProducts(prodRes.data?.items || [])

        // Set intelligent default locations based on operation type
        const locs = locRes.data || []
        const vendorLoc = locs.find((l) => l.location_type === 'vendor')
        const custLoc = locs.find((l) => l.location_type === 'customer')
        const internalLocs = locs.filter((l) => l.location_type === 'internal')

        if (initialType === OPERATION_TYPES.RECEIPT) {
          if (vendorLoc) setSourceLocation(vendorLoc._id)
          if (internalLocs.length > 0) setDestinationLocation(internalLocs[0]._id)
        } else if (initialType === OPERATION_TYPES.DELIVERY) {
          if (internalLocs.length > 0) setSourceLocation(internalLocs[0]._id)
          if (custLoc) setDestinationLocation(custLoc._id)
        } else if (initialType === OPERATION_TYPES.INTERNAL_TRANSFER) {
          if (internalLocs.length > 0) setSourceLocation(internalLocs[0]._id)
          if (internalLocs.length > 1) setDestinationLocation(internalLocs[1]._id)
        }
      } catch {
        toast.error('Could not load locations or products')
      } finally {
        setLoading(false)
      }
    }
    loadFormOptions()
  }, [initialType])

  function handleAddLine() {
    setLines([...lines, { product: '', quantity_demanded: 1, quantity_done: 0 }])
  }

  function handleRemoveLine(index) {
    if (lines.length === 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  function handleLineChange(index, field, value) {
    const updated = [...lines]
    updated[index][field] = value
    setLines(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sourceLocation || !destinationLocation) {
      toast.error('Please select source and destination locations')
      return
    }

    const validLines = lines.filter((l) => l.product && Number(l.quantity_demanded) > 0)
    if (validLines.length === 0) {
      toast.error('Please add at least one product with quantity > 0')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        operation_type: operationType,
        partner_name: partnerName,
        source_location: sourceLocation,
        destination_location: destinationLocation,
        scheduled_date: scheduledDate || undefined,
        notes,
        lines: validLines.map((l) => ({
          product: l.product,
          quantity_demanded: Number(l.quantity_demanded),
          quantity_done: Number(l.quantity_done || 0),
        })),
      }

      const { data } = await createOperation(payload)
      toast.success(`Operation ${data.reference || ''} created!`)
      navigate(`/operations/${data._id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create operation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader label="Loading form..." />

  const locationOptions = locations.map((l) => ({
    value: l._id,
    label: `${l.name} (${l.code}) [${l.location_type}]`,
  }))

  const productOptions = products.map((p) => ({
    value: p._id,
    label: `${p.name} - SKU: ${p.sku}`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-xl font-semibold text-gray-800">Create New Operation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Document Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Operation Type"
              options={OPERATION_TYPE_OPTIONS}
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              required
            />
            <Input
              label={operationType === OPERATION_TYPES.RECEIPT ? 'Vendor / Supplier' : 'Customer / Contact'}
              placeholder="e.g. Acme Supplies Inc."
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
            />
            <Input
              label="Scheduled Date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
            <Select
              label="Source Location"
              options={locationOptions}
              value={sourceLocation}
              onChange={(e) => setSourceLocation(e.target.value)}
              required
            />
            <Select
              label="Destination Location"
              options={locationOptions}
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              required
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Notes / Instructions"
                placeholder="Optional notes or shipping details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Product Lines"
          action={
            <Button type="button" variant="secondary" onClick={handleAddLine}>
              <Plus className="h-4 w-4" /> Add Line
            </Button>
          }
        >
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={idx} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <Select
                    label={idx === 0 ? 'Product' : ''}
                    options={productOptions}
                    value={line.product}
                    onChange={(e) => handleLineChange(idx, 'product', e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Input
                    label={idx === 0 ? 'Demand Qty' : ''}
                    type="number"
                    min="1"
                    value={line.quantity_demanded}
                    onChange={(e) => handleLineChange(idx, 'quantity_demanded', e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Input
                    label={idx === 0 ? 'Done Qty' : ''}
                    type="number"
                    min="0"
                    value={line.quantity_done}
                    onChange={(e) => handleLineChange(idx, 'quantity_done', e.target.value)}
                  />
                </div>
                {lines.length > 1 && (
                  <div className={`flex items-end ${idx === 0 ? 'pt-6' : ''}`}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveLine(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={submitting}>
            Create Operation
          </Button>
        </div>
      </form>
    </div>
  )
}
