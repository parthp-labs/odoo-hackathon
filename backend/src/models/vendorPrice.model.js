import mongoose from 'mongoose';

const vendorPriceSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor is required for a price record'],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required for a price record'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
    },
    priceType: {
      type: String,
      enum: ['list', 'quote', 'contract'],
      default: 'list',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    uom: { type: String, default: 'units', trim: true },
    moq: { type: Number, default: 0, min: [0, 'MOQ cannot be negative'] },
    leadDays: { type: Number, default: 0, min: [0, 'Lead days cannot be negative'] },
    effFrom: { type: Date, default: null },
    effTo: { type: Date, default: null },
    source: {
      type: String,
      enum: ['seed', 'gem', 'manual'],
      default: 'seed',
    },
    confidence: {
      type: String,
      enum: ['demo', 'live'],
      default: 'demo',
    },
  },
  { timestamps: true }
);

vendorPriceSchema.index({ product: 1, vendor: 1 });
vendorPriceSchema.index({ sku: 1 });

const VendorPrice = mongoose.model('VendorPrice', vendorPriceSchema);
export default VendorPrice;