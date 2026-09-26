import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Warehouse short code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [20, 'Code cannot exceed 20 characters'],
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Warehouse = mongoose.model('Warehouse', warehouseSchema);
export default Warehouse;
