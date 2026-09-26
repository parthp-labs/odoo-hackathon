// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { generateBotReply } from '../mocks/chatbot.mock'

export const sendChatMessage = async (message, history = []) => {
  if (USE_MOCKS) return mockResolve({ reply: generateBotReply(message) })
  try {
    const res = await client.post('/chatbot/message', { message, history })
    return { data: { reply: res.data?.reply || res.data?.data?.reply || generateBotReply(message) } }
  } catch (err) {
    if (err.response?.status === 404 || !err.response) {
      return { data: { reply: generateBotReply(message) } }
    }
    throw err
  }
}

