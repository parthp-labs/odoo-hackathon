import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null, // Null for virtual/external locations (Vendors, Customers, Loss)
    },
    parent_location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null, // Self-reference for hierarchical Zones -> Racks -> Shelves
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Location code is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    location_type: {
      type: String,
      enum: ['internal', 'vendor', 'customer', 'inventory_loss', 'transit'],
      default: 'internal',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

locationSchema.index({ warehouse: 1, location_type: 1 });

const Location = mongoose.model('Location', locationSchema);
export default Location;
