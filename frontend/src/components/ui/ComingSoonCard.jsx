import { Construction } from 'lucide-react'
import Card from './Card'

export default function ComingSoonCard({ title }) {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-800">{title}</h1>
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="rounded-full bg-primary-50 p-3">
            <Construction className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Coming soon</p>
          <p className="max-w-sm text-sm text-gray-500">
            This page is being built by the operations team and will be available shortly.
          </p>
        </div>
      </Card>
    </div>
  )
}
