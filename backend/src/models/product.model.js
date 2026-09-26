import mongoose from 'mongoose';

const reorderingRuleSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
    },
    min_quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Min quantity cannot be negative'],
    },
    max_quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Max quantity cannot be negative'],
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    sku: {
      type: String,
      required: [true, 'Product SKU/Code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [100, 'SKU cannot exceed 100 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null,
    },
    uom: {
      type: String,
      default: 'units',
      trim: true,
      maxlength: [20, 'Unit of measure cannot exceed 20 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    reordering_rules: [reorderingRuleSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for search and category filtering
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', sku: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
