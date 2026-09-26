const TRIGGER_CLASSES = {
  reorder: 'bg-amber-100 text-amber-700 border-amber-200',
  none: 'bg-green-100 text-green-700 border-green-200',
}

const TRIGGER_LABELS = {
  reorder: 'To Reorder',
  none: 'On Track',
}

export default function TriggerBadge({ trigger }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        TRIGGER_CLASSES[trigger] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {TRIGGER_LABELS[trigger] || trigger}
    </span>
  )
}
