import { motion } from 'framer-motion'
import { formatNumber } from '../../utils/formatters'

export default function BoxTooltip({ item }) {
  const { product } = item

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-xl"
    >
      <p className="font-semibold text-gray-800">{product.name}</p>
      <p className="text-gray-400">
        {product.sku} · {product.category}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-gray-600">
        <span>On hand</span>
        <span className="text-right font-medium text-gray-800">
          {formatNumber(item.quantity)} {product.uom}
        </span>
        <span>Reserved</span>
        <span className="text-right font-medium text-gray-800">{formatNumber(item.reserved_quantity)}</span>
        <span>Available</span>
        <span className="text-right font-medium text-gray-800">{formatNumber(item.available)}</span>
        {item.min_quantity > 0 && (
          <>
            <span>Reorder min</span>
            <span className="text-right font-medium text-gray-800">{formatNumber(item.min_quantity)}</span>
          </>
        )}
      </div>
    </motion.div>
  )
}
