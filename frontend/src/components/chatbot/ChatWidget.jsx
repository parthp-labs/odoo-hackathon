import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X, Bot, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendChatMessage } from '../../api/chatbot.api'
import { CHATBOT_SUGGESTIONS } from '../../mocks/chatbot.mock'
import ChatMessage from './ChatMessage'

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  content: "Hi! I'm your StockSense assistant. Ask me about stock levels, low-stock alerts, or pending operations.",
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleSend(text) {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      const { data } = await sendChatMessage(trimmed, messages)
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: 'bot', content: data.reply }])
    } catch {
      toast.error("Sorry, I couldn't process that. Please try again.")
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, role: 'bot', content: "Something went wrong on my end — please try again." },
      ])
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    handleSend(input)
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">StockSense Assistant</p>
                <p className="text-xs text-white/70 leading-tight">Ask about your inventory</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-white px-4 py-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} content={m.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 pl-9 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-2">
              {CHATBOT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-gray-100 px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-700 disabled:bg-primary-300"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-700"
        aria-label={open ? 'Close chat assistant' : 'Open chat assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
