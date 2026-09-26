import mongoose from "mongoose";

const operationLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required for operation line"],
    },
    quantity_demanded: {
      type: Number,
      required: [true, "Demanded quantity is required"],
      min: [0, "Demanded quantity cannot be negative"],
    },
    quantity_done: {
      type: Number,
      default: 0,
      min: [0, "Done quantity cannot be negative"],
    },
  },
  { _id: true },
);

const stockOperationSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: [true, "Operation reference is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    operation_type: {
      type: String,
      enum: ["receipt", "delivery", "internal_transfer", "adjustment"],
      required: [true, "Operation type is required"],
    },
    status: {
      type: String,
      enum: ["draft", "waiting", "ready", "done", "canceled"],
      default: "draft",
    },
    partner_name: {
      type: String,
      trim: true,
      default: "", // Supplier (Receipts) or Customer (Deliveries)
    },
    source_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Source location is required"],
    },
    destination_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: [true, "Destination location is required"],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    scheduled_date: {
      type: Date,
      default: null,
    },
    validated_at: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    lines: [operationLineSchema],
  },
  {
    timestamps: true,
  },
);

stockOperationSchema.index({ operation_type: 1, status: 1 });
stockOperationSchema.index({ scheduled_date: 1 });
stockOperationSchema.index({ createdAt: -1 });

const StockOperation = mongoose.model("StockOperation", stockOperationSchema);
export default StockOperation;
