import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { getWarehouses } from '../api/warehouses.api'
import { getLocations } from '../api/locations.api'
import { getProducts } from '../api/products.api'
import { getStockQuants } from '../api/warehouseMap.api'
import { LOCATION_TYPES } from '../utils/constants'

export const RACK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
  NO_RULE: 'no_rule',
}

const REFRESH_INTERVAL_MS = 30000
const MAX_PER_SHELF = 4
const MIN_SHELVES = 3
const MAX_SHELVES = 4

function computeStatus(quantity, rule) {
  if (!rule) return RACK_STATUS.NO_RULE
  if (quantity <= 0) return RACK_STATUS.OUT_OF_STOCK
  if (rule.min_quantity > 0 && quantity <= rule.min_quantity) return RACK_STATUS.LOW_STOCK
  return RACK_STATUS.IN_STOCK
}

function buildShelves(items) {
  const capacity = MAX_SHELVES * MAX_PER_SHELF
  const overflow = items.length > capacity ? items.length - (capacity - 1) : 0
  const visibleItems = overflow > 0 ? items.slice(0, capacity - 1) : items

  const shelves = []
  for (let i = 0; i < visibleItems.length; i += MAX_PER_SHELF) {
    shelves.push({ items: visibleItems.slice(i, i + MAX_PER_SHELF), overflow: 0 })
  }
  while (shelves.length < MIN_SHELVES) shelves.push({ items: [], overflow: 0 })
  shelves[shelves.length - 1].overflow = overflow
  return shelves
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
      const [locationsRes, quantsRes, productsRes] = await Promise.all([
        getLocations({ warehouse: currentWarehouseId }),
        getStockQuants({ warehouse: currentWarehouseId }),
        getProducts({ limit: 1000 }),
      ])

      const productsById = new Map(productsRes.data.items.map((p) => [p._id, p]))
      const quantsByLocation = new Map()
      quantsRes.data.forEach((q) => {
        const list = quantsByLocation.get(q.location_id) || []
        list.push(q)
        quantsByLocation.set(q.location_id, list)
      })

      const internalLocations = locationsRes.data.filter(
        (l) => l.location_type === LOCATION_TYPES.INTERNAL && l.is_active,
      )

      const nextRacks = internalLocations.map((location) => {
        const quants = quantsByLocation.get(location._id) || []
        const items = quants
          .map((q) => {
            const product = productsById.get(q.product_id)
            if (!product) return null
            const rule = (product.reordering_rules || []).find((r) => r.warehouse === currentWarehouseId)
            return {
              key: `${location._id}-${q.product_id}`,
              product,
              location_id: location._id,
              quantity: q.quantity,
              reserved_quantity: q.reserved_quantity,
              available: q.quantity - q.reserved_quantity,
              min_quantity: rule?.min_quantity ?? null,
              max_quantity: rule?.max_quantity ?? null,
              status: computeStatus(q.quantity, rule),
            }
          })
          .filter(Boolean)
          .sort((a, b) => a.product.name.localeCompare(b.product.name))

        return {
          _id: location._id,
          name: location.name,
          code: location.code,
          items,
          shelves: buildShelves(items),
        }
      })

      nextRacks.sort((a, b) => a.name.localeCompare(b.name))

      setRacks(nextRacks)
      setLastUpdated(new Date())
      setStatus('loaded')
    } catch {
      if (isBackground) {
        toast.error('Could not refresh the warehouse map')
      } else {
        setStatus('error')
        setErrorMessage('Could not load the warehouse map. Please try again.')
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
