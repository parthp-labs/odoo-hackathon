import ProductBox from './ProductBox'

export default function ShelfLevel({ shelf, boxOffset, highlightedKeys, isSearching, onBoxClick, onOverflowClick }) {
  return (
    <div className="relative">
      <div className="flex min-h-[52px] flex-wrap items-end justify-center gap-1.5 px-2 pb-1.5">
        {shelf.items.length === 0 && shelf.overflow === 0 ? (
          <span className="pb-2 text-[11px] text-gray-300">—</span>
        ) : (
          shelf.items.map((item, i) => (
            <ProductBox
              key={item.key}
              item={item}
              index={boxOffset + i}
              highlighted={isSearching && highlightedKeys.has(item.key)}
              dimmed={isSearching && !highlightedKeys.has(item.key)}
              onClick={onBoxClick}
            />
          ))
        )}
        {shelf.overflow > 0 && (
          <button
            type="button"
            onClick={onOverflowClick}
            className="flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 text-[11px] font-medium text-gray-500 hover:bg-gray-100"
          >
            +{shelf.overflow} more
          </button>
        )}
      </div>
      <div
        className="h-2.5 rounded-sm shadow-[0_3px_4px_rgba(0,0,0,0.25)]"
        style={{ background: 'linear-gradient(180deg, #8a6a4a 0%, #6b4d33 60%, #5a4029 100%)' }}
      />
    </div>
  )
}
