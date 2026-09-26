import asyncHandler from '../middlewares/async.middleware.js';
import StockMove from '../models/stockMove.model.js';

// @desc    Get immutable stock move history / ledger
// @route   GET /api/moves
// @access  Private
export const getMoveHistory = asyncHandler(async (req, res, next) => {
  const { product, source_location, destination_location, search, startDate, endDate } = req.query;

  const query = {};

  if (product) query.product = product;
  if (source_location) query.source_location = source_location;
  if (destination_location) query.destination_location = destination_location;

  if (search) {
    query.reference = { $regex: search, $options: 'i' };
  }

  if (startDate || endDate) {
    query.move_date = {};
    if (startDate) query.move_date.$gte = new Date(startDate);
    if (endDate) query.move_date.$lte = new Date(endDate);
  }

  const moves = await StockMove.find(query)
    .populate('product', 'name sku uom')
    .populate('source_location', 'name code location_type')
    .populate('destination_location', 'name code location_type')
    .populate('user', 'name email role')
    .populate('operation', 'reference operation_type partner_name')
    .sort({ move_date: -1 });

  // Map into clean display records matching the wireframe table
  const formattedMoves = moves.map((m) => ({
    id: m._id,
    date: m.move_date,
    reference: m.reference,
    productName: m.product?.name || 'Unknown',
    sku: m.product?.sku || 'N/A',
    uom: m.product?.uom || 'units',
    fromLocation: m.source_location?.name || 'External',
    fromLocationCode: m.source_location?.code || '',
    toLocation: m.destination_location?.name || 'External',
    toLocationCode: m.destination_location?.code || '',
    quantity: m.quantity,
    status: m.status,
    validatedBy: m.user?.name || 'System',
  }));

  res.status(200).json({
    success: true,
    count: formattedMoves.length,
    data: formattedMoves,
  });
});
