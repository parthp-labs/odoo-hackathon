import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { STOCK_STATUS } from '../../utils/constants'
import BoxTooltip from './BoxTooltip'

const STATUS_STYLES = {
  [STOCK_STATUS.IN_STOCK]: 'border-green-400 bg-green-50 text-green-800',
  [STOCK_STATUS.LOW_STOCK]: 'border-amber-400 bg-amber-50 text-amber-800',
  [STOCK_STATUS.OUT_OF_STOCK]: 'border-red-300 border-dashed bg-red-50/40 text-red-600',
}

const FLASH_STYLES = {
  up: 'ring-2 ring-green-500',
  down: 'ring-2 ring-red-500',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function ProductBox({ item, index, maxQuantity, highlighted, dimmed, onClick }) {
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [flash, setFlash] = useState(null)
  const [displayQty, setDisplayQty] = useState(reducedMotion ? item.quantity : 0)
  const countMV = useMotionValue(displayQty)
  const prevQtyRef = useRef(null)

  useEffect(() => {
    const prev = prevQtyRef.current
    const controls = animate(countMV, item.quantity, {
      duration: reducedMotion ? 0 : 0.7,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayQty(Math.round(v)),
    })

    if (prev !== null && prev !== item.quantity) {
      setFlash(item.quantity > prev ? 'up' : 'down')
      const timer = setTimeout(() => setFlash(null), 1400)
      prevQtyRef.current = item.quantity
      return () => {
        clearTimeout(timer)
        controls.stop()
      }
    }

    prevQtyRef.current = item.quantity
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.quantity, reducedMotion])

  const ratio = maxQuantity ? clamp(item.quantity / maxQuantity, 0.2, 1) : 0.55
  const boxHeight = 44 + ratio * 30

  const isLowStock = item.status === STOCK_STATUS.LOW_STOCK
  const isOutOfStock = item.status === STOCK_STATUS.OUT_OF_STOCK

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: -18, scale: 0.85 }}
      animate={{
        opacity: dimmed ? 0.25 : 1,
        y: 0,
        scale: 1,
      }}
      transition={
        reducedMotion
          ? { duration: 0.15 }
          : { delay: index * 0.06, type: 'spring', stiffness: 320, damping: 14 }
      }
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        id={`box-${item.key}`}
        data-box-key={item.key}
        onClick={() => onClick(item)}
        style={{ height: `${boxHeight}px` }}
        className={`flex w-14 flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border-2 px-1 py-1 text-center shadow-sm transition-shadow hover:shadow-md sm:w-16 ${STATUS_STYLES[item.status]} ${
          flash ? FLASH_STYLES[flash] : ''
        } ${isLowStock ? 'animate-pulse-glow' : ''} ${highlighted ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      >
        <span className="w-full truncate text-[11px] font-semibold leading-tight">{item.product.name}</span>
        <span className="w-full truncate text-[10px] leading-tight opacity-70">{item.product.sku}</span>
        <span className="text-xs font-bold leading-tight">
          {isOutOfStock ? '0' : displayQty}
          <span className="ml-0.5 text-[10px] font-normal opacity-70">{item.product.uom}</span>
        </span>
      </button>

      <AnimatePresence>{hovered && <BoxTooltip item={item} />}</AnimatePresence>
    </motion.div>
  )
}
