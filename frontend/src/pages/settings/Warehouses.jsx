import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Table, { Td, Tr } from '../../components/ui/Table'
import { TableSkeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import WarehouseForm from '../../components/settings/WarehouseForm'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../../api/warehouses.api'
import { usePagination } from '../../hooks/usePagination'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'address', label: 'Address' },
  { key: 'actions', label: '', className: 'text-right' },
]

const FORM_ID = 'warehouse-form'

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([])
  const [status, setStatus] = useState('loading')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [deletingWarehouse, setDeletingWarehouse] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { page, limit, setPage } = usePagination(1, 10)

  async function loadWarehouses() {
    setStatus('loading')
    try {
      const { data } = await getWarehouses()
      setWarehouses(data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadWarehouses()
  }, [])

  function openCreate() {
    setEditingWarehouse(null)
    setModalOpen(true)
  }

  function openEdit(warehouse) {
    setEditingWarehouse(warehouse)
    setModalOpen(true)
  }

  async function handleSubmit(values) {
    setSaving(true)
    try {
      if (editingWarehouse) {
        await updateWarehouse(editingWarehouse._id, values)
        toast.success('Warehouse updated')
      } else {
        await createWarehouse(values)
        toast.success('Warehouse created')
      }
      setModalOpen(false)
      loadWarehouses()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save warehouse')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteWarehouse(deletingWarehouse._id)
      toast.success('Warehouse deleted')
      setDeletingWarehouse(null)
      loadWarehouses()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete warehouse')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Warehouses</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Warehouse
        </Button>
      </div>

      <Card>
        {status === 'loading' && <TableSkeleton rows={4} cols={4} />}
        {status === 'error' && <ErrorState message="Could not load warehouses" onRetry={loadWarehouses} />}

        {status === 'loaded' && warehouses.length === 0 && (
          <EmptyState
            icon={WarehouseIcon}
            title="No warehouses yet"
            message="Add your first warehouse to start tracking stock locations."
            actionLabel="New Warehouse"
            onAction={openCreate}
          />
        )}

        {status === 'loaded' && warehouses.length > 0 && (
          <>
          <Table columns={COLUMNS}>
            {warehouses.slice((page - 1) * limit, page * limit).map((warehouse) => (
              <Tr key={warehouse._id}>
                <Td className="font-medium text-gray-800">{warehouse.name}</Td>
                <Td>{warehouse.code}</Td>
                <Td className="max-w-sm truncate">{warehouse.address}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(warehouse)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingWarehouse(warehouse)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
          <Pagination page={page} limit={limit} total={warehouses.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarehouse ? 'Edit warehouse' : 'New warehouse'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} loading={saving} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <WarehouseForm formId={FORM_ID} warehouse={editingWarehouse} onSubmit={handleSubmit} />
      </Modal>

      <ConfirmDialog
        open={!!deletingWarehouse}
        onClose={() => setDeletingWarehouse(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete warehouse"
        message={`Are you sure you want to delete "${deletingWarehouse?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
