import { useState } from 'react'

export function usePagination(initialPage = 1, initialLimit = 10) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  function reset() {
    setPage(1)
  }

  return { page, limit, setPage, setLimit, reset }
}
