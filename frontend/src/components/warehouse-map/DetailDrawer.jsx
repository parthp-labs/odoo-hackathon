import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink } from 'lucide-react'
import Table, { Td, Tr } from '../ui/Table'
import Button from '../ui/Button'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import { formatNumber } from '../../utils/formatters'

const RACK_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'on_hand', label: 'On Hand', className: 'text-right' },
  { key: 'status', label: 'Status' },
]

function ProductDetail({ item }) {
  const { product } = item

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">{product.sku}</p>
        <p className="text-sm text-gray-500">{product.category}</p>
        <div className="mt-2">
          <StatusBadge status={item.status} kind="stock" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
        <span className="text-gray-500">On hand</span>
        <span className="text-right font-medium text-gray-800">
          {formatNumber(item.quantity)} {product.uom}
        </span>
        <span className="text-gray-500">Reserved</span>
        <span className="text-right font-medium text-gray-800">{formatNumber(item.reserved_quantity)}</span>
        <span className="text-gray-500">Available</span>
        <span className="text-right font-medium text-gray-800">{formatNumber(item.available)}</span>
        {item.min_quantity !== null && (
          <>
            <span className="text-gray-500">Reorder minimum</span>
            <span className="text-right font-medium text-gray-800">{formatNumber(item.min_quantity)}</span>
            <span className="text-gray-500">Reorder maximum</span>
            <span className="text-right font-medium text-gray-800">{formatNumber(item.max_quantity)}</span>
          </>
        )}
      </div>
      {product.description && <p className="text-sm text-gray-600">{product.description}</p>}
    </div>
  )
}

function RackDetail({ rack }) {
  if (rack.items.length === 0) {
    return <EmptyState title="This rack is empty" message="No products are currently stored here." />
  }

  return (
    <Table columns={RACK_COLUMNS}>
      {rack.items.map((item) => (
        <Tr key={item.key}>
          <Td className="font-medium text-gray-800">{item.product.name}</Td>
          <Td>{item.product.sku}</Td>
          <Td className="text-right">
            {formatNumber(item.quantity)} {item.product.uom}
          </Td>
          <Td>
            <StatusBadge status={item.status} kind="stock" />
          </Td>
        </Tr>
      ))}
    </Table>
  )
}

export default function DetailDrawer({ open, onClose, mode, item, rack }) {
  const navigate = useNavigate()

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800">
                  {mode === 'product' ? item?.product.name : rack?.name}
                </h3>
                {mode === 'rack' && rack && <p className="text-xs text-gray-400">{rack.code}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {mode === 'product' && item && <ProductDetail item={item} />}
              {mode === 'rack' && rack && <RackDetail rack={rack} />}
            </div>

            {mode === 'product' && item && (
              <div className="border-t border-gray-100 px-5 py-3">
                <Button className="w-full" onClick={() => navigate(`/products/${item.product._id}`)}>
                  <ExternalLink className="h-4 w-4" /> View product
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
