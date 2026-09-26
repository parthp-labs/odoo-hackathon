import client from './client'

export const getMoves = async (params) => {
  const res = await client.get('/moves', { params })
  return { data: res.data.data || res.data }
}
