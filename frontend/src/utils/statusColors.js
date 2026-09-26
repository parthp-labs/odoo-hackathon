import { OPERATION_STATUS, STOCK_STATUS } from './constants'

export const STATUS_BADGE_CLASSES = {
  [OPERATION_STATUS.DRAFT]: 'bg-gray-100 text-gray-600 border-gray-200',
  [OPERATION_STATUS.WAITING]: 'bg-amber-100 text-amber-700 border-amber-200',
  [OPERATION_STATUS.READY]: 'bg-blue-100 text-blue-700 border-blue-200',
  [OPERATION_STATUS.DONE]: 'bg-green-100 text-green-700 border-green-200',
  [OPERATION_STATUS.CANCELED]: 'bg-red-100 text-red-700 border-red-200',
}

export const STOCK_STATUS_BADGE_CLASSES = {
  [STOCK_STATUS.IN_STOCK]: 'bg-green-100 text-green-700 border-green-200',
  [STOCK_STATUS.LOW_STOCK]: 'bg-amber-100 text-amber-700 border-amber-200',
  [STOCK_STATUS.OUT_OF_STOCK]: 'bg-red-100 text-red-700 border-red-200',
}

export function getStatusBadgeClass(status) {
  return STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}

export function getStockStatusBadgeClass(status) {
  return STOCK_STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-600 border-gray-200'
}
