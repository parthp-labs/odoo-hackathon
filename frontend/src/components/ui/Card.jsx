export default function Card({ children, className = '', title, action, ...rest }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`} {...rest}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          {title && <h3 className="text-sm font-semibold text-gray-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
