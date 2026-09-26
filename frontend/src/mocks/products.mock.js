import { STOCK_STATUS } from '../utils/constants'

// `stock` simulates stock_quants for the product across internal locations.
// Reordering rules are per-warehouse min/max thresholds.
export const mockProducts = [
  {
    _id: 'prod-steel-rod-12mm',
    name: 'Steel Rods 12mm',
    sku: 'STL-ROD-12',
    category: 'cat-steel-products',
    uom: 'kg',
    description: 'High tensile steel rods, 12mm diameter, sold by weight.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 500, max_quantity: 3000 }],
    stock: [
      { location: 'loc-rack-a-mum', quantity: 1800, reserved_quantity: 200 },
      { location: 'loc-production-mum', quantity: 150, reserved_quantity: 0 },
    ],
  },
  {
    _id: 'prod-steel-rod-16mm',
    name: 'Steel Rods 16mm',
    sku: 'STL-ROD-16',
    category: 'cat-steel-products',
    uom: 'kg',
    description: 'High tensile steel rods, 16mm diameter, sold by weight.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 500, max_quantity: 2500 }],
    stock: [{ location: 'loc-rack-a-mum', quantity: 210, reserved_quantity: 0 }],
  },
  {
    _id: 'prod-steel-sheet-2mm',
    name: 'Steel Sheets 2mm',
    sku: 'STL-SHT-02',
    category: 'cat-steel-products',
    uom: 'units',
    description: 'Cold rolled steel sheets, 2mm thickness, 8x4 ft.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 100, max_quantity: 800 }],
    stock: [{ location: 'loc-rack-b-mum', quantity: 620, reserved_quantity: 40 }],
  },
  {
    _id: 'prod-steel-sheet-4mm',
    name: 'Steel Sheets 4mm',
    sku: 'STL-SHT-04',
    category: 'cat-steel-products',
    uom: 'units',
    description: 'Cold rolled steel sheets, 4mm thickness, 8x4 ft.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 80, max_quantity: 500 }],
    stock: [],
  },
  {
    _id: 'prod-aluminium-sheet',
    name: 'Aluminium Sheets',
    sku: 'ALU-SHT-01',
    category: 'cat-steel-products',
    uom: 'units',
    description: 'Anodized aluminium sheets, 3mm thickness.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-pune', min_quantity: 60, max_quantity: 400 }],
    stock: [{ location: 'loc-rack-a-pune', quantity: 340, reserved_quantity: 20 }],
  },
  {
    _id: 'prod-bolts-m10',
    name: 'Bolts M10',
    sku: 'FAST-BLT-M10',
    category: 'cat-fasteners',
    uom: 'units',
    description: 'Hex head bolts, M10 x 50mm, zinc plated.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 2000, max_quantity: 20000 }],
    stock: [
      { location: 'loc-rack-a-mum', quantity: 12500, reserved_quantity: 500 },
      { location: 'loc-rack-b-mum', quantity: 3000, reserved_quantity: 0 },
    ],
  },
  {
    _id: 'prod-bolts-m12',
    name: 'Bolts M12',
    sku: 'FAST-BLT-M12',
    category: 'cat-fasteners',
    uom: 'units',
    description: 'Hex head bolts, M12 x 60mm, zinc plated.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 1500, max_quantity: 15000 }],
    stock: [{ location: 'loc-rack-b-mum', quantity: 900, reserved_quantity: 0 }],
  },
  {
    _id: 'prod-nuts-m10',
    name: 'Nuts M10',
    sku: 'FAST-NUT-M10',
    category: 'cat-fasteners',
    uom: 'units',
    description: 'Hex nuts, M10, zinc plated.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 2000, max_quantity: 20000 }],
    stock: [{ location: 'loc-rack-a-mum', quantity: 9800, reserved_quantity: 300 }],
  },
  {
    _id: 'prod-washers-assorted',
    name: 'Washers Assorted',
    sku: 'FAST-WSH-AST',
    category: 'cat-fasteners',
    uom: 'units',
    description: 'Flat washers, assorted sizes, box of 100.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-pune', min_quantity: 500, max_quantity: 5000 }],
    stock: [{ location: 'loc-rack-a-pune', quantity: 2600, reserved_quantity: 0 }],
  },
  {
    _id: 'prod-office-chair',
    name: 'Office Chairs',
    sku: 'FURN-CHR-01',
    category: 'cat-furniture',
    uom: 'units',
    description: 'Ergonomic mesh-back office chair with adjustable height.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 20, max_quantity: 150 }],
    stock: [{ location: 'loc-rack-b-mum', quantity: 12, reserved_quantity: 2 }],
  },
  {
    _id: 'prod-office-desk',
    name: 'Office Desks',
    sku: 'FURN-DSK-01',
    category: 'cat-furniture',
    uom: 'units',
    description: 'Laminated wood office desk, 4x2 ft.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 15, max_quantity: 100 }],
    stock: [{ location: 'loc-rack-b-mum', quantity: 48, reserved_quantity: 4 }],
  },
  {
    _id: 'prod-filing-cabinet',
    name: 'Filing Cabinets',
    sku: 'FURN-CAB-01',
    category: 'cat-furniture',
    uom: 'units',
    description: '4-drawer steel filing cabinet with lock.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 10, max_quantity: 60 }],
    stock: [],
  },
  {
    _id: 'prod-packaging-box',
    name: 'Packaging Boxes (Corrugated)',
    sku: 'PKG-BOX-01',
    category: 'cat-packaging',
    uom: 'boxes',
    description: 'Corrugated cardboard boxes, 18x12x12 inch.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-pune', min_quantity: 300, max_quantity: 3000 }],
    stock: [{ location: 'loc-receiving-pune', quantity: 2100, reserved_quantity: 150 }],
  },
  {
    _id: 'prod-plastic-crate',
    name: 'Plastic Crates',
    sku: 'PKG-CRT-01',
    category: 'cat-packaging',
    uom: 'units',
    description: 'Stackable HDPE plastic crates, heavy duty.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-pune', min_quantity: 100, max_quantity: 1000 }],
    stock: [{ location: 'loc-receiving-pune', quantity: 540, reserved_quantity: 0 }],
  },
  {
    _id: 'prod-welding-rod',
    name: 'Welding Rods',
    sku: 'RAW-WLD-01',
    category: 'cat-raw-materials',
    uom: 'kg',
    description: 'General purpose mild steel welding electrodes.',
    is_active: true,
    reordering_rules: [{ warehouse: 'wh-mumbai', min_quantity: 100, max_quantity: 800 }],
    stock: [{ location: 'loc-production-mum', quantity: 65, reserved_quantity: 0 }],
  },
]

export function getOnHandQuantity(product) {
  return (product.stock || []).reduce((sum, s) => sum + s.quantity, 0)
}

export function getReservedQuantity(product) {
  return (product.stock || []).reduce((sum, s) => sum + s.reserved_quantity, 0)
}

export function getMinQuantity(product) {
  return (product.reordering_rules || []).reduce((sum, r) => sum + r.min_quantity, 0)
}

export function getStockStatus(product) {
  const onHand = getOnHandQuantity(product)
  const minQty = getMinQuantity(product)
  if (onHand <= 0) return STOCK_STATUS.OUT_OF_STOCK
  if (minQty > 0 && onHand < minQty) return STOCK_STATUS.LOW_STOCK
  return STOCK_STATUS.IN_STOCK
}
