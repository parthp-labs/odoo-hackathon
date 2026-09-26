import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    vendorCode: {
      type: String,
      required: [true, 'Vendor code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [50, 'Vendor code cannot exceed 50 characters'],
    },
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      maxlength: [200, 'Vendor name cannot exceed 200 characters'],
    },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, default: '', maxlength: [15, 'GSTIN is 15 characters'] },
    source: {
      type: String,
      enum: ['seed', 'gem', 'manual'],
      default: 'manual',
    },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vendorSchema.index({ name: 'text', city: 'text' });

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor;