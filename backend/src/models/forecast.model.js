import mongoose from 'mongoose';

const forecastSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required for a forecast'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
    },
    horizonWeeks: { type: Number, default: 8, min: [1, 'Horizon must be at least 1 week'] },
    forecastedDemand: { type: Number, default: 0, min: [0, 'Forecast cannot be negative'] },
    quantiles: { type: mongoose.Schema.Types.Mixed, default: {} },
    modelType: { type: String, default: 'seasonalNaive', trim: true },
    generatedAt: { type: Date, default: Date.now },
    sourceDataFrom: { type: Date, default: null },
    sourceDataTo: { type: Date, default: null },
  },
  { timestamps: true }
);

forecastSchema.index({ sku: 1, generatedAt: -1 });

const Forecast = mongoose.model('Forecast', forecastSchema);
export default Forecast;