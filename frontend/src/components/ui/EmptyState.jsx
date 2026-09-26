import { Inbox } from 'lucide-react'
import Button from './Button'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  message,
  actionLabel,
  onAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="rounded-full bg-primary-50 p-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
