import mongoose from 'mongoose';

const productCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null, // Self-reference for sub-categories
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);
export default ProductCategory;
