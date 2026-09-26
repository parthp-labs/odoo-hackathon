import { motion, useReducedMotion } from 'framer-motion'
import ShelfLevel from './ShelfLevel'

export default function RackUnit({ rack, index, highlightedKeys, isSearching, onBoxClick, onLabelClick }) {
  const reducedMotion = useReducedMotion()
  const isEmpty = rack.items.length === 0

  const shelfOffsets = rack.shelves.reduce((offsets, shelf, i) => {
    offsets.push(i === 0 ? 0 : offsets[i - 1] + rack.shelves[i - 1].items.length)
    return offsets
  }, [])

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.15 } : { delay: index * 0.08, duration: 0.45, ease: 'easeOut' }}
      style={{ perspective: '900px' }}
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <button
        type="button"
        onClick={() => onLabelClick(rack)}
        className="mx-auto mb-4 flex flex-col items-center rounded-md px-3 py-1.5 text-white shadow transition-transform hover:scale-105"
        style={{ background: '#714B67' }}
      >
        <span className="text-xs font-semibold leading-tight">{rack.name}</span>
        <span className="text-[10px] leading-tight opacity-80">{rack.code}</span>
      </button>

      <div
        className={`relative space-y-3 rounded-lg border-x-4 border-gray-300 px-2 pt-1 ${isEmpty ? 'opacity-50' : ''}`}
        style={{ transform: 'rotateX(2deg)' }}
      >
        {rack.shelves.map((shelf, shelfIndex) => (
          <ShelfLevel
            key={shelfIndex}
            shelf={shelf}
            boxOffset={shelfOffsets[shelfIndex]}
            maxQuantity={rack.maxQuantity}
            highlightedKeys={highlightedKeys}
            isSearching={isSearching}
            onBoxClick={onBoxClick}
            onOverflowClick={() => onLabelClick(rack)}
          />
        ))}

        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-400">Empty</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
