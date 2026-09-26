import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle, Ban, PlayCircle, Edit3 } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusBadge from '../../components/ui/StatusBadge'
import Table, { Td, Tr } from '../../components/ui/Table'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import {
  getOperation,
  updateLineQuantity,
  markOperationReady,
  validateOperation,
  cancelOperation,
} from '../../api/operations.api'
import { formatDateTime, formatEnumLabel } from '../../utils/formatters'
import { OPERATION_STATUS } from '../../utils/constants'

const LINE_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'uom', label: 'UoM' },
  { key: 'demanded', label: 'Demand', className: 'text-right' },
  { key: 'done', label: 'Quantity Done', className: 'text-right' },
  { key: 'action', label: '', className: 'text-right' },
]

export default function OperationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [operation, setOperation] = useState(null)
  const [status, setStatus] = useState('loading')

  // Edit line done quantity modal state
  const [editingLine, setEditingLine] = useState(null)
  const [editQtyDone, setEditQtyDone] = useState('')
  const [updatingLine, setUpdatingLine] = useState(false)

  // Action button states
  const [actionLoading, setActionLoading] = useState(false)

  async function loadData() {
    setStatus('loading')
    try {
      const { data } = await getOperation(id)
      setOperation(data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleMarkReady() {
    setActionLoading(true)
    try {
      await markOperationReady(id)
      toast.success('Operation marked as Ready!')
      await loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark operation ready')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleValidate() {
    setActionLoading(true)
    try {
      await validateOperation(id)
      toast.success('Operation validated! Stock moves recorded.')
      await loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Validation failed. Check inventory balances.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this operation?')) return
    setActionLoading(true)
    try {
      await cancelOperation(id)
      toast.success('Operation canceled')
      await loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel operation')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSaveLineQuantity(e) {
    e.preventDefault()
    if (!editingLine) return
    setUpdatingLine(true)
    try {
      await updateLineQuantity(id, editingLine._id, editQtyDone)
      toast.success('Quantity updated')
      setEditingLine(null)
      await loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update line quantity')
    } finally {
      setUpdatingLine(false)
    }
  }

  if (status === 'loading') return <Loader label="Loading operation details..." />
  if (status === 'error') return <ErrorState message="Could not load operation" onRetry={loadData} />
  if (!operation) return null

  const isEditable = operation.status === OPERATION_STATUS.DRAFT || operation.status === OPERATION_STATUS.WAITING || operation.status === OPERATION_STATUS.READY
  const canValidate = operation.status === OPERATION_STATUS.READY || operation.status === OPERATION_STATUS.DRAFT || operation.status === OPERATION_STATUS.WAITING

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{operation.reference}</h1>
              <StatusBadge status={operation.status} kind="operation" />
            </div>
            <p className="text-xs text-gray-500 capitalize">
              {formatEnumLabel(operation.operation_type)} &middot; Created by {operation.created_by?.name || 'Staff'}
            </p>
          </div>
        </div>

        {/* Action workflow buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {operation.status === OPERATION_STATUS.DRAFT && (
            <Button
              variant="secondary"
              onClick={handleMarkReady}
              disabled={actionLoading}
            >
              <PlayCircle className="h-4 w-4" /> Mark as Ready
            </Button>
          )}

          {canValidate && operation.status !== OPERATION_STATUS.DONE && operation.status !== OPERATION_STATUS.CANCELED && (
            <Button
              variant="primary"
              onClick={handleValidate}
              disabled={actionLoading}
            >
              <CheckCircle2 className="h-4 w-4" /> Validate Transfer
            </Button>
          )}

          {isEditable && (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Metadata card */}
      <Card title="Operation Details">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Partner / Contact</dt>
            <dd className="mt-1 text-sm font-medium text-gray-800">{operation.partner_name || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Source Location</dt>
            <dd className="mt-1 text-sm font-medium text-gray-800">
              {operation.source_location?.name || 'External'} ({operation.source_location?.code || '-'})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Destination Location</dt>
            <dd className="mt-1 text-sm font-medium text-gray-800">
              {operation.destination_location?.name || 'External'} ({operation.destination_location?.code || '-'})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Scheduled Date</dt>
            <dd className="mt-1 text-sm font-medium text-gray-800">
              {operation.scheduled_date ? formatDateTime(operation.scheduled_date) : 'Immediate'}
            </dd>
          </div>
          {operation.notes && (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs uppercase tracking-wide text-gray-400">Notes / Instructions</dt>
              <dd className="mt-1 text-sm text-gray-700">{operation.notes}</dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Lines table */}
      <Card title="Product Items">
        <Table columns={LINE_COLUMNS}>
          {(operation.lines || []).map((line) => {
            const isFilled = (line.quantity_done || 0) >= (line.quantity_demanded || 0)
            return (
              <Tr key={line._id}>
                <Td className="font-medium text-gray-800">{line.product?.name || 'Item'}</Td>
                <Td className="text-gray-500">{line.product?.sku || '-'}</Td>
                <Td className="capitalize">{line.product?.uom || 'units'}</Td>
                <Td className="text-right font-medium">{line.quantity_demanded}</Td>
                <Td className="text-right">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      isFilled
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {line.quantity_done || 0}
                  </span>
                </Td>
                <Td className="text-right">
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingLine(line)
                        setEditQtyDone(line.quantity_done !== undefined ? line.quantity_done : line.quantity_demanded)
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Set Done
                    </Button>
                  )}
                </Td>
              </Tr>
            )
          })}
        </Table>
      </Card>

      {/* Edit Line Done Quantity Modal */}
      {editingLine && (
        <Modal
          open={!!editingLine}
          onClose={() => setEditingLine(null)}
          title={`Update Done Quantity: ${editingLine.product?.name || ''}`}
        >
          <form onSubmit={handleSaveLineQuantity} className="space-y-4">
            <p className="text-xs text-gray-500">
              Demand quantity for this item is <strong>{editingLine.quantity_demanded}</strong>.
            </p>
            <Input
              label="Quantity Done / Picked"
              type="number"
              min="0"
              value={editQtyDone}
              onChange={(e) => setEditQtyDone(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditingLine(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={updatingLine} disabled={updatingLine}>
                Save Quantity
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
