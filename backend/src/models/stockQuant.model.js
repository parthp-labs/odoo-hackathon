import mongoose from 'mongoose';

const stockQuantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location reference is required'],
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'On hand quantity cannot be negative'],
    },
    reserved_quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Free To Use Stock = Physical On Hand - Reserved for Deliveries
stockQuantSchema.virtual('free_to_use').get(function () {
  return Math.max(0, this.quantity - this.reserved_quantity);
});

// Ensure only ONE quant balance record exists per product per location
stockQuantSchema.index({ product: 1, location: 1 }, { unique: true });
stockQuantSchema.index({ location: 1 });

const StockQuant = mongoose.model('StockQuant', stockQuantSchema);
export default StockQuant;
