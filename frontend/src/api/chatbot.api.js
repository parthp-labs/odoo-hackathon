// TODO: backend
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { generateBotReply } from '../mocks/chatbot.mock'

export const sendChatMessage = (message, history = []) => {
  if (USE_MOCKS) return mockResolve({ reply: generateBotReply(message) })
  return client.post('/chatbot/message', { message, history })
}
