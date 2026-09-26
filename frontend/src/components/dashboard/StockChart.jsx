import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '../ui/Card'
import { formatNumber } from '../../utils/formatters'

const PRIMARY = '#4F46E5'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-700">{label}</p>
      <p className="text-gray-500">Quantity: {formatNumber(payload[0].value)}</p>
    </div>
  )
}

export default function StockChart({ byCategory = [], byWarehouse = [] }) {
  const [view, setView] = useState('category')
  const data = view === 'category' ? byCategory : byWarehouse

  return (
    <Card
      title="Stock Levels"
      action={
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs font-medium">
          <button
            onClick={() => setView('category')}
            className={`rounded-md px-2.5 py-1 ${view === 'category' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            By Category
          </button>
          <button
            onClick={() => setView('warehouse')}
            className={`rounded-md px-2.5 py-1 ${view === 'warehouse' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            By Warehouse
          </button>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,70,229,0.06)' }} />
            <Bar dataKey="quantity" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
