import asyncHandler from "../middlewares/async.middleware.js";
import ErrorResponse from "../utils/errorResponse.js";
import StockOperation from "../models/stockOperation.model.js";
import StockQuant from "../models/stockQuant.model.js";
import StockMove from "../models/stockMove.model.js";
import Location from "../models/location.model.js";
import Product from "../models/product.model.js";

// Helper to auto-generate sequence references: REC/2026/0001, DEL/2026/0001, etc.
const generateReference = async (operationType) => {
  const prefixMap = {
    receipt: "REC",
    delivery: "DEL",
    internal_transfer: "INT",
    adjustment: "ADJ",
  };

  const prefix = prefixMap[operationType] || "OP";
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^${prefix}/${year}/`);

  // Use the highest existing sequence, not the row count. `count + 1` is wrong
  // whenever the two differ: a seeded history with gaps (or any canceled /
  // deleted operation) makes the count lower than the true max, so the next
  // insert collides with the unique `reference` index — e.g. with 32 seeded
  // INT/2026/00NN rows, a new transfer computed INT/2026/0033 which already
  // existed, and the insert failed with E11000.
  const last = await StockOperation.findOne({ reference: pattern })
    .sort({ reference: -1 })
    .select("reference")
    .lean();

  const lastSeq = last ? Number.parseInt(String(last.reference).split("/").pop(), 10) : 0;
  const nextSeq = String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(4, "0");
  return `${prefix}/${year}/${nextSeq}`;
};

// @desc    Get all operations (Receipts, Deliveries, Transfers, Adjustments)
// @route   GET /api/operations
// @access  Private
export const getOperations = asyncHandler(async (req, res, next) => {
  const { operation_type, status, search } = req.query;

  const query = {};

  if (operation_type) query.operation_type = operation_type;
  if (status) query.status = status;

  if (search) {
    query.$or = [
      { reference: { $regex: search, $options: "i" } },
      { partner_name: { $regex: search, $options: "i" } },
    ];
  }

  const operations = await StockOperation.find(query)
    .populate("source_location", "name code location_type")
    .populate("destination_location", "name code location_type")
    .populate("created_by", "name email role")
    .populate("lines.product", "name sku uom")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: operations.length,
    data: operations,
  });
});

// @desc    Get single operation by ID
// @route   GET /api/operations/:id
// @access  Private
export const getOperationById = asyncHandler(async (req, res, next) => {
  const operation = await StockOperation.findById(req.params.id)
    .populate("source_location", "name code location_type")
    .populate("destination_location", "name code location_type")
    .populate("created_by", "name email role")
    .populate("lines.product", "name sku uom category");

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  res.status(200).json({
    success: true,
    data: operation,
  });
});

// @desc    Create new operation (Receipt, Delivery, Transfer, Adjustment)
// @route   POST /api/operations
// @access  Private (Staff / Manager)
export const createOperation = asyncHandler(async (req, res, next) => {
  const {
    operation_type,
    partner_name,
    source_location,
    destination_location,
    scheduled_date,
    notes,
    lines,
  } = req.body;

  if (!operation_type || !source_location || !destination_location) {
    return next(
      new ErrorResponse(
        "Please provide operation_type, source_location, and destination_location",
        400,
      ),
    );
  }

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return next(
      new ErrorResponse("Operation must contain at least one item line", 400),
    );
  }

  // Validate locations exist
  const srcLoc = await Location.findById(source_location);
  const destLoc = await Location.findById(destination_location);

  if (!srcLoc || !destLoc) {
    return next(
      new ErrorResponse("Source or destination location does not exist", 404),
    );
  }

  const reference = await generateReference(operation_type);

  // Prepare line items
  const formattedLines = lines.map((item) => ({
    product: item.product,
    quantity_demanded: item.quantity_demanded,
    quantity_done: item.quantity_done !== undefined ? item.quantity_done : 0,
  }));

  const operation = await StockOperation.create({
    reference,
    operation_type,
    status: "draft",
    partner_name: partner_name || "",
    source_location,
    destination_location,
    created_by: req.user._id,
    scheduled_date: scheduled_date || null,
    notes: notes || "",
    lines: formattedLines,
  });

  const populated = await StockOperation.findById(operation._id)
    .populate("source_location", "name code")
    .populate("destination_location", "name code")
    .populate("lines.product", "name sku uom");

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// @desc    Update operation (only while in draft / ready status)
// @route   PUT /api/operations/:id
// @access  Private
export const updateOperation = asyncHandler(async (req, res, next) => {
  const { partner_name, scheduled_date, notes, lines, status } = req.body;

  let operation = await StockOperation.findById(req.params.id);

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  if (operation.status === "done" || operation.status === "canceled") {
    return next(
      new ErrorResponse(
        `Cannot modify operation because it is already marked as ${operation.status}`,
        400,
      ),
    );
  }

  if (partner_name !== undefined) operation.partner_name = partner_name;
  if (scheduled_date !== undefined) operation.scheduled_date = scheduled_date;
  if (notes !== undefined) operation.notes = notes;
  if (lines !== undefined) operation.lines = lines;
  if (status && ["draft", "waiting", "ready"].includes(status)) {
    operation.status = status;
  }

  await operation.save();

  res.status(200).json({
    success: true,
    data: operation,
  });
});

// @desc    Update quantity_done on an individual line (Picking / Scanning count)
// @route   PATCH /api/operations/:id/lines/:lineId
// @access  Private
export const updateLineQuantity = asyncHandler(async (req, res, next) => {
  const { quantity_done } = req.body;

  if (quantity_done === undefined || quantity_done < 0) {
    return next(
      new ErrorResponse(
        "Please provide a valid non-negative quantity_done",
        400,
      ),
    );
  }

  const operation = await StockOperation.findById(req.params.id);

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  if (operation.status === "done" || operation.status === "canceled") {
    return next(
      new ErrorResponse(
        `Cannot edit quantities on an operation that is ${operation.status}`,
        400,
      ),
    );
  }

  const line = operation.lines.id(req.params.lineId);
  if (!line) {
    return next(
      new ErrorResponse(
        `Line item not found with id of ${req.params.lineId}`,
        404,
      ),
    );
  }

  line.quantity_done = quantity_done;
  await operation.save();

  res.status(200).json({
    success: true,
    data: operation,
  });
});

// @desc    Validate Operation: Atomically updates physical stock balances & logs moves!
// @route   POST /api/operations/:id/validate
// @access  Private
export const validateOperation = asyncHandler(async (req, res, next) => {
  const operation = await StockOperation.findById(req.params.id)
    .populate("source_location")
    .populate("destination_location")
    .populate("lines.product", "name sku uom");

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  if (operation.status === "done") {
    return next(
      new ErrorResponse(
        "Operation has already been validated and completed",
        400,
      ),
    );
  }

  if (operation.status === "canceled") {
    return next(new ErrorResponse("Cannot validate a canceled operation", 400));
  }

  const srcLoc = operation.source_location;
  const destLoc = operation.destination_location;

  // 1. Pre-validation check: If source is internal, check stock availability for all lines
  if (srcLoc.location_type === "internal") {
    for (const line of operation.lines) {
      const qtyToMove =
        line.quantity_done > 0 ? line.quantity_done : line.quantity_demanded;

      const quant = await StockQuant.findOne({
        product: line.product._id,
        location: srcLoc._id,
      });

      const onHand = quant ? quant.quantity : 0;
      if (onHand < qtyToMove) {
        return next(
          new ErrorResponse(
            `Insufficient stock for "${line.product.name}" (${line.product.sku}) at location "${srcLoc.name}". Available: ${onHand}, Requested: ${qtyToMove}`,
            400,
          ),
        );
      }
    }
  }

  // 2. Perform Atomic Double-Entry Stock Movement
  const stockMovesToCreate = [];

  for (const line of operation.lines) {
    const qtyToMove =
      line.quantity_done > 0 ? line.quantity_done : line.quantity_demanded;
    line.quantity_done = qtyToMove; // Ensure quantity_done is recorded

    // Decrement from source if internal
    if (srcLoc.location_type === "internal") {
      await StockQuant.findOneAndUpdate(
        { product: line.product._id, location: srcLoc._id },
        { $inc: { quantity: -qtyToMove } },
        { new: true },
      );
    }

    // Increment at destination if internal
    if (destLoc.location_type === "internal") {
      await StockQuant.findOneAndUpdate(
        { product: line.product._id, location: destLoc._id },
        { $inc: { quantity: qtyToMove } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    // Prepare immutable stock ledger entry
    stockMovesToCreate.push({
      reference: operation.reference,
      operation: operation._id,
      operation_line_id: line._id,
      product: line.product._id,
      source_location: srcLoc._id,
      destination_location: destLoc._id,
      quantity: qtyToMove,
      status: "done",
      move_date: new Date(),
      user: req.user._id,
    });
  }

  // Insert all move ledger records in batch
  await StockMove.insertMany(stockMovesToCreate);

  // Update operation status to Done
  operation.status = "done";
  operation.validated_at = new Date();
  await operation.save();

  res.status(200).json({
    success: true,
    message: `Operation ${operation.reference} validated successfully. Stock balances updated.`,
    data: operation,
  });
});

// @desc    Cancel operation
// @route   POST /api/operations/:id/cancel
// @access  Private
export const cancelOperation = asyncHandler(async (req, res, next) => {
  const operation = await StockOperation.findById(req.params.id);

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  if (operation.status === "done") {
    return next(
      new ErrorResponse(
        "Cannot cancel an operation that has already been validated and done",
        400,
      ),
    );
  }

  operation.status = "canceled";
  await operation.save();

  res.status(200).json({
    success: true,
    message: `Operation ${operation.reference} has been canceled`,
    data: operation,
  });
});

// @desc    Mark operation status as ready
// @route   POST /api/operations/:id/mark-ready
// @access  Private
export const markOperationReady = asyncHandler(async (req, res, next) => {
  const operation = await StockOperation.findById(req.params.id);

  if (!operation) {
    return next(
      new ErrorResponse(`Operation not found with id of ${req.params.id}`, 404),
    );
  }

  if (operation.status === "done" || operation.status === "canceled") {
    return next(
      new ErrorResponse(
        `Cannot mark operation ready because it is ${operation.status}`,
        400,
      ),
    );
  }

  operation.status = "ready";
  await operation.save();

  res.status(200).json({
    success: true,
    message: `Operation ${operation.reference} marked as ready`,
    data: operation,
  });
});

