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
  const res = await client.post('/operations', payload)
  return { data: res.data.data || res.data }
}

export const updateOperation = async (id, payload) => {
  const res = await client.put(`/operations/${id}`, payload)
  return { data: res.data.data || res.data }
}

export const markOperationReady = async (id) => {
  // If backend doesn't have mark-ready endpoint, update status to ready via PUT
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

export const validateOperation = async (id, payload) => {
  const res = await client.post(`/operations/${id}/validate`, payload)
  return { data: res.data.data || res.data }
}

export const cancelOperation = async (id) => {
  const res = await client.post(`/operations/${id}/cancel`)
  return { data: res.data.data || res.data }
}
