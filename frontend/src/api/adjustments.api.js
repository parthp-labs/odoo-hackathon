// TODO: backend
// Owned by Member B. Stub functions only — do not implement mock logic here.
import client from './client'

export const getCountSheet = (params) => client.get('/adjustments/count-sheet', { params })

export const applyAdjustment = (payload) => client.post('/adjustments/apply', payload)
