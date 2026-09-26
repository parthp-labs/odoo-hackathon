import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

// Keeps filter state in sync with URL query params.
export function useFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults)) {
      const value = searchParams.get(key)
      if (value !== null) result[key] = value
    }
    return result
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    (key, value) => {
      const next = new URLSearchParams(searchParams)
      if (value === '' || value === null || value === undefined) {
        next.delete(key)
      } else {
        next.set(key, value)
      }
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const setFilters = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      })
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  return { filters, setFilter, setFilters }
}
