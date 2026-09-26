import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import { formatNumber } from '../../utils/formatters'

export default function KpiCard({ icon: Icon, label, value, to, accent = 'primary' }) {
  const navigate = useNavigate()

  const accentClasses = {
    primary: 'bg-primary-50 text-primary',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  }

  return (
    <Card
      className={to ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}
      {...(to ? { onClick: () => navigate(to) } : {})}
    >
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${accentClasses[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-800">{formatNumber(value)}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </Card>
  )
}
