import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, MapPin } from 'lucide-react'
import Select from '../../components/ui/Select'
import SearchInput from '../../components/ui/SearchInput'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import RackUnit from '../../components/warehouse-map/RackUnit'
import RackSkeleton from '../../components/warehouse-map/RackSkeleton'
import MapLegend from '../../components/warehouse-map/MapLegend'
import DetailDrawer from '../../components/warehouse-map/DetailDrawer'
import { useWarehouseMap } from '../../hooks/useWarehouseMap'
import { useDebounce } from '../../hooks/useDebounce'

export default function WarehouseMap() {
  const navigate = useNavigate()
  const {
    warehouses,
    warehouseId,
    setWarehouseId,
    racks,
    status,
    refreshing,
    errorMessage,
    lastUpdated,
    refresh,
    retry,
  } = useWarehouseMap()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [drawer, setDrawer] = useState({ open: false, mode: null, item: null, rack: null })

  const isSearching = debouncedSearch.trim().length > 0

  const highlightedKeys = useMemo(() => {
    const keys = new Set()
    if (!isSearching) return keys
    const q = debouncedSearch.trim().toLowerCase()
    racks.forEach((rack) => {
      rack.items.forEach((item) => {
        if (item.product.name.toLowerCase().includes(q) || item.product.sku.toLowerCase().includes(q)) {
          keys.add(item.key)
        }
      })
    })
    return keys
  }, [racks, debouncedSearch, isSearching])

  useEffect(() => {
    if (!isSearching || highlightedKeys.size === 0) return
    const firstKey = highlightedKeys.values().next().value
    const el = document.getElementById(`box-${firstKey}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  function openProductDrawer(item) {
    setDrawer({ open: true, mode: 'product', item, rack: null })
  }

  function openRackDrawer(rack) {
    setDrawer({ open: true, mode: 'rack', item: null, rack })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Warehouse Map</h1>
            <p className="text-sm text-gray-500">Live rack layout and stock levels</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="w-48"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({ value: w._id, label: `${w.name} (${w.code})` }))}
              placeholder="Select warehouse"
            />
            <SearchInput className="w-56" value={search} onChange={setSearch} placeholder="Search product or SKU" />
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-60"
              aria-label="Refresh warehouse map"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <MapLegend />
          <span className="text-xs text-gray-400">
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString('en-IN')}` : ''}
          </span>
        </div>
      </div>

      {status === 'loading' && <RackSkeleton />}

      {status === 'error' && <ErrorState message={errorMessage || 'Something went wrong'} onRetry={retry} />}

      {status === 'loaded' && racks.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No racks found"
          message="This warehouse has no active internal locations yet."
          actionLabel="Manage Locations"
          onAction={() => navigate('/settings/locations')}
        />
      )}

      {status === 'loaded' && racks.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {racks.map((rack, index) => (
            <RackUnit
              key={rack._id}
              rack={rack}
              index={index}
              highlightedKeys={highlightedKeys}
              isSearching={isSearching}
              onBoxClick={openProductDrawer}
              onLabelClick={openRackDrawer}
            />
          ))}
        </div>
      )}

      <DetailDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        mode={drawer.mode}
        item={drawer.item}
        rack={drawer.rack}
      />
    </div>
  )
}
