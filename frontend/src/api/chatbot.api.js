// Chat with the real inventory LLM agent (yolo-auto, /agent/chat).
// Protected route; the axios client (client.js) attaches the logged-in Bearer
// token automatically. The endpoint returns { success, data: { text, ... } }.
import client from './client'
import { USE_MOCKS, mockResolve } from './mockHelper'
import { generateBotReply } from '../mocks/chatbot.mock'

const extractReply = (res) =>
  res?.data?.text?.trim() || res?.data?.data?.text?.trim() || ''

export const sendChatMessage = async (message, _history = []) => {
  if (USE_MOCKS) return mockResolve({ reply: generateBotReply(message) })
  try {
    const res = await client.post('/agent/chat', { message })
    return { data: { reply: extractReply(res) || 'Sorry, I could not find an answer for that.' } }
  } catch (err) {
    // 401 (not signed in) / 404 / network — fall back to the local chatbot.
    if (err.response?.status === 401 || err.response?.status === 404 || !err.response) {
      return { data: { reply: generateBotReply(message) } }
    }
    throw err
  }
}