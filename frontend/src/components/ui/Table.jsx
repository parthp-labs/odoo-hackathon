export default function Table({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            {columns.map((col) => (
              <th key={col.key} className={`whitespace-nowrap px-4 py-3 font-medium ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-gray-700 ${className}`}>{children}</td>
}

export function Tr({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`}
    >
      {children}
    </tr>
  )
}
