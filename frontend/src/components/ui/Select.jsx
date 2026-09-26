import { forwardRef } from 'react'

const Select = forwardRef(function Select(
  { label, error, options = [], placeholder = 'Select...', className = '', id, ...rest },
  ref,
) {
  const selectId = id || rest.name

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        ref={ref}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? 'border-red-400' : 'border-gray-300'
        } ${className}`}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Select
