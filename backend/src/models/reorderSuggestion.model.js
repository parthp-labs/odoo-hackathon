import mongoose from 'mongoose';

const reorderSuggestionSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required for a reorder suggestion'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
    },
    qtyToOrder: { type: Number, default: 0, min: [0, 'Quantity to order cannot be negative'] },
    trigger: {
      type: String,
      enum: ['none', 'reorder'],
      default: 'none',
    },
    forecastOverLeadTime: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    safetyStock: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    onHand: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    reserved: { type: Number, default: 0, min: [0, 'Cannot be negative'] },
    method: { type: String, default: 'ses', trim: true },
    vendors: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

reorderSuggestionSchema.index({ sku: 1, createdAt: -1 });

const ReorderSuggestion = mongoose.model('ReorderSuggestion', reorderSuggestionSchema);
export default ReorderSuggestion;