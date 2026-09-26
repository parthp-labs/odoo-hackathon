import { mockProducts, getOnHandQuantity, getMinQuantity, getStockStatus } from './products.mock'
import { mockDashboardStats, mockLowStockItems, mockStockByCategory, mockStockByWarehouse } from './dashboard.mock'
import { STOCK_STATUS, STOCK_STATUS_LABELS } from '../utils/constants'
import { formatNumber } from '../utils/formatters'

export const CHATBOT_SUGGESTIONS = [
  'Show low stock items',
  "What's in stock today?",
  'Pending receipts & deliveries',
  'Find Bolts M10',
]

function formatList(items) {
  return items.map((line) => `• ${line}`).join('\n')
}

function findProductMatch(text) {
  return mockProducts.find(
    (p) => text.includes(p.name.toLowerCase()) || text.includes(p.sku.toLowerCase()),
  )
}

function replyForProduct(product) {
  const onHand = getOnHandQuantity(product)
  const minQty = getMinQuantity(product)
  const status = getStockStatus(product)
  return [
    `${product.name} (${product.sku})`,
    `Status: ${STOCK_STATUS_LABELS[status]}`,
    `On hand: ${formatNumber(onHand)} ${product.uom}`,
    minQty > 0 ? `Reorder minimum: ${formatNumber(minQty)} ${product.uom}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function replyForLowStock() {
  if (mockLowStockItems.length === 0) return "Good news — nothing is below its reorder minimum right now."
  const lines = mockLowStockItems
    .slice(0, 8)
    .map(
      (item) =>
        `${item.name} (${item.sku}) — ${formatNumber(item.on_hand)} on hand, min ${formatNumber(item.min_quantity)} · ${STOCK_STATUS_LABELS[item.status]}`,
    )
  const suffix = mockLowStockItems.length > 8 ? `\n…and ${mockLowStockItems.length - 8} more.` : ''
  return `${mockLowStockItems.length} item(s) need attention:\n${formatList(lines)}${suffix}`
}

function replyForStats() {
  const s = mockDashboardStats
  return formatList([
    `Total units in stock: ${formatNumber(s.total_products_in_stock)}`,
    `Low stock: ${formatNumber(s.low_stock_count)}`,
    `Out of stock: ${formatNumber(s.out_of_stock_count)}`,
    `Pending receipts: ${formatNumber(s.pending_receipts)}`,
    `Pending deliveries: ${formatNumber(s.pending_deliveries)}`,
    `Transfers scheduled: ${formatNumber(s.transfers_scheduled)}`,
  ])
}

function replyForPendingOps() {
  const s = mockDashboardStats
  return formatList([
    `Pending receipts: ${formatNumber(s.pending_receipts)}`,
    `Pending deliveries: ${formatNumber(s.pending_deliveries)}`,
    `Transfers scheduled: ${formatNumber(s.transfers_scheduled)}`,
  ])
}

function replyForCategoryBreakdown() {
  return formatList(mockStockByCategory.map((c) => `${c.label}: ${formatNumber(c.quantity)} units`))
}

function replyForWarehouseBreakdown() {
  return formatList(mockStockByWarehouse.map((w) => `${w.label}: ${formatNumber(w.quantity)} units`))
}

function replyForOutOfStock() {
  const items = mockLowStockItems.filter((i) => i.status === STOCK_STATUS.OUT_OF_STOCK)
  if (items.length === 0) return 'Nothing is out of stock right now.'
  return formatList(items.map((i) => `${i.name} (${i.sku})`))
}

const GREETING_WORDS = ['hi', 'hello', 'hey', 'yo', 'hola']
const HELP_WORDS = ['help', 'what can you do', 'commands', 'options']

export function generateBotReply(rawMessage) {
  const text = rawMessage.trim().toLowerCase()

  if (!text) return "I didn't catch that — could you rephrase?"

  if (GREETING_WORDS.some((w) => text === w || text.startsWith(`${w} `))) {
    return "Hi! I'm your StockSense assistant. Ask me about stock levels, low-stock alerts, pending operations, or a specific product."
  }

  if (HELP_WORDS.some((w) => text.includes(w))) {
    return `I can help with:\n${formatList([
      'Low stock / out of stock items',
      'Overall stock stats & summary',
      'Pending receipts, deliveries & transfers',
      'Stock by category or warehouse',
      'Looking up a product by name or SKU',
    ])}`
  }

  const product = findProductMatch(text)
  if (product) return replyForProduct(product)

  if (text.includes('out of stock')) return replyForOutOfStock()
  if (text.includes('low stock') || text.includes('reorder')) return replyForLowStock()

  if (text.includes('category') || text.includes('categories')) return replyForCategoryBreakdown()
  if (text.includes('warehouse')) return replyForWarehouseBreakdown()

  if (text.includes('pending') || text.includes('receipt') || text.includes('delivery') || text.includes('transfer')) {
    return replyForPendingOps()
  }

  if (
    text.includes('stock') ||
    text.includes('stats') ||
    text.includes('summary') ||
    text.includes('dashboard') ||
    text.includes('overview')
  ) {
    return replyForStats()
  }

  return `I couldn't find anything specific for that. Try asking about:\n${formatList(CHATBOT_SUGGESTIONS)}`
}
