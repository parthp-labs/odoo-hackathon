import { Loader2 } from 'lucide-react'

export default function Loader({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-10 text-gray-500 ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
