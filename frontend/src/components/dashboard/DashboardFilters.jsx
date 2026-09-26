import Card from '../ui/Card'
import Select from '../ui/Select'
import { OPERATION_TYPE_OPTIONS, OPERATION_STATUS_OPTIONS } from '../../utils/constants'

export default function DashboardFilters({ filters, onChange, warehouses = [], categories = [] }) {
  const warehouseOptions = warehouses.map((w) => ({ value: w._id, label: w.name }))
  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }))

  return (
    <Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          placeholder="Document type"
          options={OPERATION_TYPE_OPTIONS}
          value={filters.type || ''}
          onChange={(e) => onChange('type', e.target.value)}
        />
        <Select
          placeholder="Status"
          options={OPERATION_STATUS_OPTIONS}
          value={filters.status || ''}
          onChange={(e) => onChange('status', e.target.value)}
        />
        <Select
          placeholder="Warehouse"
          options={warehouseOptions}
          value={filters.warehouse || ''}
          onChange={(e) => onChange('warehouse', e.target.value)}
        />
        <Select
          placeholder="Category"
          options={categoryOptions}
          value={filters.category || ''}
          onChange={(e) => onChange('category', e.target.value)}
        />
      </div>
    </Card>
  )
}
