import { OPERATION_STATUS, OPERATION_TYPES } from '../utils/constants'
import { mockProducts, getOnHandQuantity, getStockStatus, getMinQuantity } from './products.mock'
import { STOCK_STATUS } from '../utils/constants'

const totalProductsInStock = mockProducts.reduce((sum, p) => sum + getOnHandQuantity(p), 0)
const lowStockProducts = mockProducts.filter((p) => getStockStatus(p) === STOCK_STATUS.LOW_STOCK)
const outOfStockProducts = mockProducts.filter((p) => getStockStatus(p) === STOCK_STATUS.OUT_OF_STOCK)

export const mockDashboardStats = {
  total_products_in_stock: totalProductsInStock,
  low_stock_count: lowStockProducts.length,
  out_of_stock_count: outOfStockProducts.length,
  pending_receipts: 4,
  pending_deliveries: 6,
  transfers_scheduled: 2,
}

export const mockLowStockItems = [...lowStockProducts, ...outOfStockProducts].map((p) => ({
  _id: p._id,
  name: p.name,
  sku: p.sku,
  category: p.category,
  on_hand: getOnHandQuantity(p),
  min_quantity: getMinQuantity(p),
  status: getStockStatus(p),
}))

export const mockRecentMoves = [
  {
    _id: 'move-1',
    reference: 'REC/0042',
    product_name: 'Steel Rods 12mm',
    source_location_name: 'Vendors',
    destination_location_name: 'Rack A (Mumbai)',
    quantity: 1200,
    move_date: '2026-09-25T09:30:00Z',
    user: 'Rohit Verma',
  },
  {
    _id: 'move-2',
    reference: 'DEL/0117',
    product_name: 'Bolts M10',
    source_location_name: 'Rack A (Mumbai)',
    destination_location_name: 'Customers',
    quantity: 500,
    move_date: '2026-09-25T08:15:00Z',
    user: 'Priya Nair',
  },
  {
    _id: 'move-3',
    reference: 'INT/0021',
    product_name: 'Aluminium Sheets',
    source_location_name: 'Receiving Dock (Pune)',
    destination_location_name: 'Rack A (Pune)',
    quantity: 80,
    move_date: '2026-09-24T16:45:00Z',
    user: 'Sandeep Kulkarni',
  },
  {
    _id: 'move-4',
    reference: 'DEL/0116',
    product_name: 'Office Chairs',
    source_location_name: 'Rack B (Mumbai)',
    destination_location_name: 'Customers',
    quantity: 6,
    move_date: '2026-09-24T14:20:00Z',
    user: 'Priya Nair',
  },
  {
    _id: 'move-5',
    reference: 'REC/0041',
    product_name: 'Packaging Boxes (Corrugated)',
    source_location_name: 'Vendors',
    destination_location_name: 'Receiving Dock (Pune)',
    quantity: 1000,
    move_date: '2026-09-24T11:00:00Z',
    user: 'Sandeep Kulkarni',
  },
  {
    _id: 'move-6',
    reference: 'ADJ/0009',
    product_name: 'Steel Sheets 4mm',
    source_location_name: 'Rack B (Mumbai)',
    destination_location_name: 'Inventory Loss',
    quantity: 15,
    move_date: '2026-09-23T17:10:00Z',
    user: 'Aditya Sharma',
  },
  {
    _id: 'move-7',
    reference: 'DEL/0115',
    product_name: 'Bolts M12',
    source_location_name: 'Rack B (Mumbai)',
    destination_location_name: 'Customers',
    quantity: 300,
    move_date: '2026-09-23T10:30:00Z',
    user: 'Priya Nair',
  },
  {
    _id: 'move-8',
    reference: 'REC/0040',
    product_name: 'Welding Rods',
    source_location_name: 'Vendors',
    destination_location_name: 'Production Floor (Mumbai)',
    quantity: 50,
    move_date: '2026-09-22T09:00:00Z',
    user: 'Rohit Verma',
  },
  {
    _id: 'move-9',
    reference: 'INT/0020',
    product_name: 'Washers Assorted',
    source_location_name: 'Receiving Dock (Pune)',
    destination_location_name: 'Rack A (Pune)',
    quantity: 400,
    move_date: '2026-09-22T08:30:00Z',
    user: 'Sandeep Kulkarni',
  },
  {
    _id: 'move-10',
    reference: 'DEL/0114',
    product_name: 'Plastic Crates',
    source_location_name: 'Receiving Dock (Pune)',
    destination_location_name: 'Customers',
    quantity: 120,
    move_date: '2026-09-21T15:40:00Z',
    user: 'Sandeep Kulkarni',
  },
]

export const mockStockByCategory = [
  { label: 'Raw Materials', quantity: 65 },
  { label: 'Steel Products', quantity: 2970 },
  { label: 'Fasteners & Hardware', quantity: 28800 },
  { label: 'Furniture', quantity: 60 },
  { label: 'Packaging Materials', quantity: 2640 },
]

export const mockStockByWarehouse = [
  { label: 'Main Warehouse Mumbai', quantity: 28175 },
  { label: 'Secondary Warehouse Pune', quantity: 3480 },
]

export const mockPendingOperationsPreview = {
  [OPERATION_TYPES.RECEIPT]: OPERATION_STATUS.READY,
  [OPERATION_TYPES.DELIVERY]: OPERATION_STATUS.READY,
  [OPERATION_TYPES.INTERNAL_TRANSFER]: OPERATION_STATUS.WAITING,
}
