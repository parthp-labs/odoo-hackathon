// TODO: backend
// Owned by Member B. Stub functions only — do not implement mock logic here.
import client from './client'

export const getOperations = (params) => client.get('/operations', { params })

export const getOperation = (id) => client.get(`/operations/${id}`)

export const createOperation = (payload) => client.post('/operations', payload)

export const updateOperation = (id, payload) => client.put(`/operations/${id}`, payload)

export const markOperationReady = (id) => client.post(`/operations/${id}/mark-ready`)

export const validateOperation = (id, payload) => client.post(`/operations/${id}/validate`, payload)

export const cancelOperation = (id) => client.post(`/operations/${id}/cancel`)
