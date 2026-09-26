import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getWarehouses, getRackLayout } from '../api/warehouseMap.api'
import { STOCK_STATUS } from '../utils/constants'

const REFRESH_INTERVAL_MS = 30000
const MAX_PER_SHELF = 4
const MAX_ROWS_PER_LOCATION = 3
const MIN_ROWS_PER_RACK = 3

function computeStatus(onHand, minQuantity) {
  if (onHand <= 0) return STOCK_STATUS.OUT_OF_STOCK
  if (minQuantity > 0 && onHand <= minQuantity) return STOCK_STATUS.LOW_STOCK
  return STOCK_STATUS.IN_STOCK
}

// The rack-layout endpoint always returns flat product/location ids, but this
// guards against a populated-object shape without needing extra requests.
function idOf(ref) {
  return ref && typeof ref === 'object' ? ref._id || ref.id : ref
}

function toBoxItem(product, locationId) {
  const onHand = product.onHand ?? 0
  const minQuantity = product.minThreshold || 0

  return {
    key: `${locationId}-${idOf(product.productId)}`,
    product: {
      _id: idOf(product.productId),
      name: product.name,
      sku: product.sku,
      category: product.category,
      uom: product.uom,
      description: product.description,
    },
    location_id: locationId,
    quantity: onHand,
    reserved_quantity: product.reserved ?? 0,
    available: product.freeToUse ?? onHand,
    min_quantity: minQuantity,
    status: computeStatus(onHand, minQuantity),
  }
}

// Chunks one location's items into rows of MAX_PER_SHELF boxes, capping total
// rows per location so one overstuffed shelf can't blow up the layout.
function buildRows(items) {
  const capacity = MAX_ROWS_PER_LOCATION * MAX_PER_SHELF
  const overflow = items.length > capacity ? items.length - (capacity - 1) : 0
  const visible = overflow > 0 ? items.slice(0, capacity - 1) : items

  const rows = []
  for (let i = 0; i < visible.length; i += MAX_PER_SHELF) {
    rows.push({ items: visible.slice(i, i + MAX_PER_SHELF), overflow: 0 })
  }
  if (rows.length === 0) rows.push({ items: [], overflow: 0 })
  rows[rows.length - 1].overflow = overflow
  return rows
}

function mapRack(zoneName, rack) {
  const allItems = []
  const rows = []

  rack.shelves.forEach((shelf) => {
    const items = shelf.products.map((p) => toBoxItem(p, idOf(shelf.locationId)))
    allItems.push(...items)
    rows.push(...buildRows(items))
  })

  while (rows.length < MIN_ROWS_PER_RACK) rows.push({ items: [], overflow: 0 })

  const maxQuantity = allItems.reduce((max, item) => Math.max(max, item.quantity), 0)

  return {
    _id: `${zoneName}::${rack.rackId}`,
    name: rack.rackName,
    code: zoneName,
    items: allItems,
    shelves: rows,
    maxQuantity: Math.max(1, maxQuantity),
  }
}

function mapZonesToRacks(zones) {
  return zones.flatMap((zone) => zone.racks.map((rack) => mapRack(zone.zoneName, rack)))
}

export function useWarehouseMap() {
  const [warehouses, setWarehouses] = useState([])
  const [warehouseId, setWarehouseId] = useState('')
  const [racks, setRacks] = useState([])
  const [status, setStatus] = useState('loading') // loading | loaded | error
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const warehouseIdRef = useRef('')

  useEffect(() => {
    getWarehouses()
      .then(({ data }) => {
        setWarehouses(data)
        if (data.length > 0) {
          setWarehouseId((prev) => prev || data[0]._id)
        } else {
          setStatus('loaded')
        }
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    warehouseIdRef.current = warehouseId
  }, [warehouseId])

  const load = useCallback(async (isBackground = false) => {
    const currentWarehouseId = warehouseIdRef.current
    if (!currentWarehouseId) return

    if (isBackground) setRefreshing(true)
    else setStatus('loading')
    setErrorMessage('')

    try {
      const { data: envelope } = await getRackLayout({ warehouse: currentWarehouseId })
      setRacks(mapZonesToRacks(envelope.data || []))
      setLastUpdated(new Date())
      setStatus('loaded')
    } catch (err) {
      const message = err.response?.data?.message || 'Could not load the warehouse map. Please try again.'
      if (isBackground) {
        toast.error(message)
      } else {
        setStatus('error')
        setErrorMessage(message)
      }
    } finally {
      if (isBackground) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (warehouseId) load(false)
  }, [warehouseId, load])

  useEffect(() => {
    const interval = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    function handleFocus() {
      load(true)
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [load])

  return {
    warehouses,
    warehouseId,
    setWarehouseId,
    racks,
    status,
    refreshing,
    errorMessage,
    lastUpdated,
    refresh: () => load(true),
    retry: () => load(false),
  }
}
