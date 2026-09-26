import asyncHandler from '../middlewares/async.middleware.js';
import Product from '../models/product.model.js';
import StockQuant from '../models/stockQuant.model.js';
import StockOperation from '../models/stockOperation.model.js';
import Location from '../models/location.model.js';

// @desc    Process chatbot message and return intelligent AI/inventory response
// @route   POST /api/chatbot/message
// @access  Public (or Private)
export const handleChatMessage = asyncHandler(async (req, res, next) => {
  const { message = '', history = [] } = req.body;
  const text = message.trim().toLowerCase();

  if (!text) {
    return res.status(200).json({
      success: true,
      reply: "Hi! I'm your StockSense inventory assistant. Ask me about stock levels, low-stock alerts, or pending operations.",
    });
  }

  // 1. Check for low stock or out of stock inquiry
  if (text.includes('low stock') || text.includes('out of stock') || text.includes('reorder')) {
    const products = await Product.find({ is_active: true })
      .populate('reordering_rules.warehouse', 'name')
      .populate('category', 'name');

    const lowStockList = [];
    for (const p of products) {
      const quants = await StockQuant.find({ product: p._id });
      const onHand = quants.reduce((sum, q) => sum + (q.quantity || 0), 0);
      const minQty = (p.reordering_rules || []).reduce((sum, r) => Math.max(sum, r.min_quantity || 0), 0);

      if (onHand === 0) {
        lowStockList.push(`• ${p.name} (${p.sku}) — Out of stock (0 ${p.uom})`);
      } else if (minQty > 0 && onHand <= minQty) {
        lowStockList.push(`• ${p.name} (${p.sku}) — Low stock: ${onHand} ${p.uom} (Min: ${minQty})`);
      }
    }

    if (lowStockList.length === 0) {
      return res.status(200).json({
        success: true,
        reply: "Great news! All products are currently stocked above their minimum reorder levels.",
      });
    }

    const preview = lowStockList.slice(0, 8).join('\n');
    const extra = lowStockList.length > 8 ? `\n...and ${lowStockList.length - 8} more item(s).` : '';
    return res.status(200).json({
      success: true,
      reply: `Found ${lowStockList.length} item(s) requiring attention:\n${preview}${extra}`,
    });
  }

  // 2. Check for pending operations inquiry
  if (
    text.includes('pending') ||
    text.includes('receipt') ||
    text.includes('delivery') ||
    text.includes('transfer') ||
    text.includes('operation')
  ) {
    const [pendingReceipts, pendingDeliveries, pendingTransfers] = await Promise.all([
      StockOperation.countDocuments({ operation_type: 'receipt', status: { $in: ['draft', 'waiting', 'ready'] } }),
      StockOperation.countDocuments({ operation_type: 'delivery', status: { $in: ['draft', 'waiting', 'ready'] } }),
      StockOperation.countDocuments({ operation_type: 'internal_transfer', status: { $in: ['draft', 'waiting', 'ready'] } }),
    ]);

    const reply = [
      'Current pending operations:',
      `• Pending Receipts: ${pendingReceipts}`,
      `• Pending Deliveries: ${pendingDeliveries}`,
      `• Scheduled Internal Transfers: ${pendingTransfers}`,
    ].join('\n');

    return res.status(200).json({
      success: true,
      reply,
    });
  }

  // 3. Check for general stats or overview inquiry
  if (text.includes('stats') || text.includes('in stock') || text.includes('overview') || text.includes('summary')) {
    const [productCount, quants, operationsCount] = await Promise.all([
      Product.countDocuments({ is_active: true }),
      StockQuant.find(),
      StockOperation.countDocuments({ status: { $in: ['draft', 'ready'] } }),
    ]);

    const totalUnits = quants.reduce((sum, q) => sum + (q.quantity || 0), 0);
    const reply = [
      'StockSense Inventory Overview:',
      `• Active Products in Catalog: ${productCount}`,
      `• Total Physical Units on Hand: ${totalUnits}`,
      `• Open Operations in Progress: ${operationsCount}`,
    ].join('\n');

    return res.status(200).json({
      success: true,
      reply,
    });
  }

  // 4. Check for specific product lookup
  const words = text.replace(/^(find|search|lookup|where is|how much|show me)\s+/i, '').trim();
  if (words.length >= 2) {
    const matchedProduct = await Product.findOne({
      $or: [
        { name: { $regex: words, $options: 'i' } },
        { sku: { $regex: words, $options: 'i' } },
      ],
    }).populate('category', 'name');

    if (matchedProduct) {
      const quants = await StockQuant.find({ product: matchedProduct._id }).populate('location', 'name code');
      const onHand = quants.reduce((sum, q) => sum + (q.quantity || 0), 0);
      const reserved = quants.reduce((sum, q) => sum + (q.reserved_quantity || 0), 0);
      const freeToUse = Math.max(0, onHand - reserved);

      const locationDetails = quants
        .filter((q) => q.quantity > 0)
        .map((q) => `  - ${q.location?.name || 'Location'}: ${q.quantity} ${matchedProduct.uom}`)
        .join('\n');

      const lines = [
        `📦 ${matchedProduct.name} (SKU: ${matchedProduct.sku})`,
        `• Category: ${matchedProduct.category?.name || 'Uncategorized'}`,
        `• Total On Hand: ${onHand} ${matchedProduct.uom}`,
        `• Reserved: ${reserved} ${matchedProduct.uom}`,
        `• Available (Free to Use): ${freeToUse} ${matchedProduct.uom}`,
      ];

      if (locationDetails) {
        lines.push('• Storage Locations:\n' + locationDetails);
      }

      return res.status(200).json({
        success: true,
        reply: lines.join('\n'),
      });
    }
  }

  // Fallback intelligent guidance
  return res.status(200).json({
    success: true,
    reply:
      "I'm here to help with your warehouse logistics! You can ask me:\n" +
      "• \"Show low stock items\"\n" +
      "• \"What's in stock today?\"\n" +
      "• \"Pending receipts & deliveries\"\n" +
      "• Or type any product name or SKU (e.g. \"Find Steel Pipes\") to check exact balances.",
  });
});
