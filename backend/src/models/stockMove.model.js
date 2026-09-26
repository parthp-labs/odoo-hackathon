import mongoose from 'mongoose';

const stockMoveSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: [true, 'Move reference is required'],
      trim: true,
      uppercase: true,
    },
    operation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockOperation',
      default: null, // Null for standalone adjustments
    },
    operation_line_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required for stock move'],
    },
    source_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Source location is required'],
    },
    destination_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Destination location is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Move quantity is required'],
      min: [0.01, 'Quantity moved must be greater than zero'],
    },
    status: {
      type: String,
      enum: ['done', 'canceled'],
      default: 'done',
    },
    move_date: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // User who validated the transfer
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable ledger entries
  }
);

stockMoveSchema.index({ move_date: -1 });
stockMoveSchema.index({ product: 1, move_date: -1 });
stockMoveSchema.index({ source_location: 1, destination_location: 1 });

const StockMove = mongoose.model('StockMove', stockMoveSchema);
export default StockMove;
