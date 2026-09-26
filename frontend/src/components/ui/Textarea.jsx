import { forwardRef } from 'react'

const Textarea = forwardRef(function Textarea({ label, error, className = '', id, rows = 3, ...rest }, ref) {
  const areaId = id || rest.name

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        ref={ref}
        rows={rows}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder-gray-400 shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? 'border-red-400' : 'border-gray-300'
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Textarea
