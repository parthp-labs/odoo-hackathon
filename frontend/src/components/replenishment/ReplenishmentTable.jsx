import Table from '../ui/Table'
import ReplenishmentRow from './ReplenishmentRow'

const COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'available', label: 'Available', className: 'text-right' },
  { key: 'forecast', label: 'Forecast (lead time)', className: 'text-right' },
  { key: 'safety', label: 'Safety Stock', className: 'text-right' },
  { key: 'toOrder', label: 'To Order', className: 'text-right' },
  { key: 'trigger', label: 'Status' },
  { key: 'method', label: 'Model' },
  { key: 'vendor', label: 'Best Vendor' },
]

export default function ReplenishmentTable({ recommendations, productMap = {}, engine, horizon }) {
  return (
    <Table columns={COLUMNS}>
      {recommendations.map((rec) => (
        <ReplenishmentRow key={rec.sku} rec={rec} product={productMap[rec.sku]} engine={engine} horizon={horizon} />
      ))}
    </Table>
  )
}
