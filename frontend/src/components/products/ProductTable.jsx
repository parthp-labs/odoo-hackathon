import { useNavigate } from 'react-router-dom'
import Table, { Td, Tr } from '../ui/Table'
import StatusBadge from '../ui/StatusBadge'
import { formatNumber, formatEnumLabel } from '../../utils/formatters'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'uom', label: 'UoM' },
  { key: 'on_hand', label: 'On Hand', className: 'text-right' },
  { key: 'status', label: 'Status' },
]

export default function ProductTable({ products, categoryMap = {} }) {
  const navigate = useNavigate()

  return (
    <Table columns={COLUMNS}>
      {products.map((product) => (
        <Tr key={product._id} onClick={() => navigate(`/products/${product._id}`)}>
          <Td className="font-medium text-gray-800">{product.name}</Td>
          <Td>{product.sku}</Td>
          <Td>{categoryMap[product.category] || '-'}</Td>
          <Td className="capitalize">{formatEnumLabel(product.uom)}</Td>
          <Td className="text-right">{formatNumber(product.on_hand_quantity)}</Td>
          <Td>
            <StatusBadge status={product.stock_status} kind="stock" />
          </Td>
        </Tr>
      ))}
    </Table>
  )
}
