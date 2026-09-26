import { useEffect, useState } from 'react'
import { Plus, Pencil, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Table, { Td, Tr } from '../../components/ui/Table'
import { TableSkeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import LocationForm from '../../components/settings/LocationForm'
import { LOCATION_TYPE_OPTIONS, VIRTUAL_LOCATION_TYPES } from '../../utils/constants'
import { formatEnumLabel } from '../../utils/formatters'
import { getLocations, createLocation, updateLocation } from '../../api/locations.api'
import { getWarehouses } from '../../api/warehouses.api'
import { usePagination } from '../../hooks/usePagination'

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'type', label: 'Type' },
  { key: 'parent', label: 'Parent' },
  { key: 'active', label: 'Active' },
  { key: 'actions', label: '', className: 'text-right' },
]

const FORM_ID = 'location-form'

export default function Locations() {
  const [locations, setLocations] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [status, setStatus] = useState('loading')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [saving, setSaving] = useState(false)
  const { page, limit, setPage } = usePagination(1, 10)

  async function loadData() {
    setStatus('loading')
    try {
      const [locationsRes, warehousesRes] = await Promise.all([getLocations(), getWarehouses()])
      setLocations(locationsRes.data)
      setWarehouses(warehousesRes.data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const warehouseMap = Object.fromEntries(warehouses.map((w) => [w._id, w.name]))
  const locationMap = Object.fromEntries(locations.map((l) => [l._id, l.name]))
  const warehouseOptions = warehouses.map((w) => ({ value: w._id, label: w.name }))

  const filteredLocations = (locations || []).filter((l) => {
    const whId = l.warehouse?._id || l.warehouse
    if (warehouseFilter && whId !== warehouseFilter) return false
    if (typeFilter && l.location_type !== typeFilter) return false
    return true
  })
  const paginatedLocations = filteredLocations.slice((page - 1) * limit, page * limit)

  function openCreate() {
    setEditingLocation(null)
    setModalOpen(true)
  }

  function openEdit(location) {
    setEditingLocation(location)
    setModalOpen(true)
  }

  async function handleSubmit(values) {
    setSaving(true)
    try {
      const payload = { ...values, parent_location: values.parent_location || null }
      if (editingLocation) {
        await updateLocation(editingLocation._id, payload)
        toast.success('Location updated')
      } else {
        await createLocation(payload)
        toast.success('Location created')
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save location')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Locations</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Location
        </Button>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select
            options={warehouseOptions}
            placeholder="All warehouses"
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value)
              setPage(1)
            }}
            className="sm:w-56"
          />
          <Select
            options={LOCATION_TYPE_OPTIONS}
            placeholder="All types"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="sm:w-56"
          />
        </div>

        {status === 'loading' && <TableSkeleton rows={6} cols={7} />}
        {status === 'error' && <ErrorState message="Could not load locations" onRetry={loadData} />}

        {status === 'loaded' && filteredLocations.length === 0 && (
          <EmptyState icon={MapPin} title="No locations found" message="Try adjusting your filters." />
        )}

        {status === 'loaded' && filteredLocations.length > 0 && (
          <>
          <Table columns={COLUMNS}>
            {paginatedLocations.map((location) => {
              const isVirtual = VIRTUAL_LOCATION_TYPES.includes(location.location_type)
              return (
                <Tr key={location._id}>
                  <Td>{location.code}</Td>
                  <Td className="font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      {location.name}
                      {isVirtual && (
                        <span className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                          System
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>{location.warehouse?.name || warehouseMap[location.warehouse?._id || location.warehouse] || '-'}</Td>
                  <Td className="capitalize">{formatEnumLabel(location.location_type)}</Td>
                  <Td>{location.parent_location?.name || locationMap[location.parent_location?._id || location.parent_location] || '-'}</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        location.is_active
                          ? 'border-green-200 bg-green-100 text-green-700'
                          : 'border-gray-200 bg-gray-100 text-gray-500'
                      }`}
                    >
                      {location.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => openEdit(location)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Td>
                </Tr>
              )
            })}
          </Table>
          <Pagination page={page} limit={limit} total={filteredLocations.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLocation ? 'Edit location' : 'New location'}
        footer={
          !VIRTUAL_LOCATION_TYPES.includes(editingLocation?.location_type) && (
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={saving} disabled={saving}>
                Save
              </Button>
            </>
          )
        }
      >
        <LocationForm
          formId={FORM_ID}
          location={editingLocation}
          warehouses={warehouses}
          locations={locations}
          onSubmit={handleSubmit}
        />
      </Modal>
    </div>
  )
}
