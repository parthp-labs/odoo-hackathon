import { Bot, User } from 'lucide-react'

export default function ChatMessage({ role, content }) {
  const isUser = role === 'user'

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-white' : 'bg-primary-50 text-primary'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? 'rounded-tr-sm bg-primary text-white'
            : 'rounded-tl-sm border border-gray-200 bg-gray-50 text-gray-700'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
