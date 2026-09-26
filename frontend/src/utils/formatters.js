export function formatDate(dateInput) {
  if (!dateInput) return '-'
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '-'
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('en-IN')
}

export function formatEnumLabel(value) {
  if (!value) return ''
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function initialsFromName(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
