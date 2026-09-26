import client from './client'

export const getOperations = async (params) => {
  const res = await client.get('/operations', { params })
  return { data: res.data.data || res.data }
}

export const getOperation = async (id) => {
  const res = await client.get(`/operations/${id}`)
  return { data: res.data.data || res.data }
}

export const createOperation = async (payload) => {
  // Normalize lines to match backend schema: { product, quantity_demanded, quantity_done }
  const normalizedLines = (payload.lines || []).map((l) => ({
    product: l.product || l.productId,
    quantity_demanded: Number(l.quantity_demanded || l.demand_quantity || 1),
    quantity_done: Number(l.quantity_done || l.done_quantity || 0),
  }))

  const body = {
    ...payload,
    lines: normalizedLines,
  }

  const res = await client.post('/operations', body)
  return { data: res.data.data || res.data }
}

export const updateOperation = async (id, payload) => {
  const res = await client.put(`/operations/${id}`, payload)
  return { data: res.data.data || res.data }
}

export const updateLineQuantity = async (operationId, lineId, quantityDone) => {
  const res = await client.patch(`/operations/${operationId}/lines/${lineId}`, {
    quantity_done: Number(quantityDone),
  })
  return { data: res.data.data || res.data }
}

export const markOperationReady = async (id) => {
  try {
    const res = await client.post(`/operations/${id}/mark-ready`)
    return { data: res.data.data || res.data }
  } catch (err) {
    if (err.response?.status === 404) {
      const res = await client.put(`/operations/${id}`, { status: 'ready' })
      return { data: res.data.data || res.data }
    }
    throw err
  }
}

export const validateOperation = async (id, payload = {}) => {
  const res = await client.post(`/operations/${id}/validate`, payload)
  return { data: res.data.data || res.data }
}

export const cancelOperation = async (id) => {
  const res = await client.post(`/operations/${id}/cancel`)
  return { data: res.data.data || res.data }
}
