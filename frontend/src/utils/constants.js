// Central place for every enum/status/role string used across the app.
// Pages must import from here instead of hardcoding strings.

export const USER_ROLES = {
  ADMIN: 'admin',
  INVENTORY_MANAGER: 'inventory_manager',
  WAREHOUSE_STAFF: 'warehouse_staff',
}

export const USER_ROLE_OPTIONS = [
  { value: USER_ROLES.ADMIN, label: 'Admin' },
  { value: USER_ROLES.INVENTORY_MANAGER, label: 'Inventory Manager' },
  { value: USER_ROLES.WAREHOUSE_STAFF, label: 'Warehouse Staff' },
]

export const USER_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  DISABLED: 'disabled',
}

export const OTP_PURPOSE = {
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
}

export const OTP_MAX_ATTEMPTS = 5

export const LOCATION_TYPES = {
  INTERNAL: 'internal',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
  INVENTORY_LOSS: 'inventory_loss',
  TRANSIT: 'transit',
}

export const LOCATION_TYPE_OPTIONS = [
  { value: LOCATION_TYPES.INTERNAL, label: 'Internal' },
  { value: LOCATION_TYPES.VENDOR, label: 'Vendor' },
  { value: LOCATION_TYPES.CUSTOMER, label: 'Customer' },
  { value: LOCATION_TYPES.INVENTORY_LOSS, label: 'Inventory Loss' },
  { value: LOCATION_TYPES.TRANSIT, label: 'Transit' },
]

// Virtual locations are system-managed and read-only in the UI
export const VIRTUAL_LOCATION_TYPES = [
  LOCATION_TYPES.VENDOR,
  LOCATION_TYPES.CUSTOMER,
  LOCATION_TYPES.INVENTORY_LOSS,
]

export const UOM_OPTIONS = [
  { value: 'units', label: 'Units' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'Grams' },
  { value: 'litres', label: 'Litres' },
  { value: 'metres', label: 'Metres' },
  { value: 'boxes', label: 'Boxes' },
]

export const OPERATION_TYPES = {
  RECEIPT: 'receipt',
  DELIVERY: 'delivery',
  INTERNAL_TRANSFER: 'internal_transfer',
  ADJUSTMENT: 'adjustment',
}

export const OPERATION_TYPE_OPTIONS = [
  { value: OPERATION_TYPES.RECEIPT, label: 'Receipt' },
  { value: OPERATION_TYPES.DELIVERY, label: 'Delivery' },
  { value: OPERATION_TYPES.INTERNAL_TRANSFER, label: 'Internal Transfer' },
  { value: OPERATION_TYPES.ADJUSTMENT, label: 'Adjustment' },
]

export const OPERATION_STATUS = {
  DRAFT: 'draft',
  WAITING: 'waiting',
  READY: 'ready',
  DONE: 'done',
  CANCELED: 'canceled',
}

export const OPERATION_STATUS_OPTIONS = [
  { value: OPERATION_STATUS.DRAFT, label: 'Draft' },
  { value: OPERATION_STATUS.WAITING, label: 'Waiting' },
  { value: OPERATION_STATUS.READY, label: 'Ready' },
  { value: OPERATION_STATUS.DONE, label: 'Done' },
  { value: OPERATION_STATUS.CANCELED, label: 'Canceled' },
]

export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
}

export const STOCK_STATUS_LABELS = {
  [STOCK_STATUS.IN_STOCK]: 'In Stock',
  [STOCK_STATUS.LOW_STOCK]: 'Low Stock',
  [STOCK_STATUS.OUT_OF_STOCK]: 'Out of Stock',
}
