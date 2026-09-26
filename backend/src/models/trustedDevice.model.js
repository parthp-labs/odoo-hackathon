import mongoose from 'mongoose';

const trustedDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required for a trusted device entry'],
      index: true,
    },
    // SHA-256 hash of the raw device token (raw token is never stored)
    device_token_hash: {
      type: String,
      required: [true, 'Device token hash is required'],
      unique: true,
      trim: true,
    },
    first_seen: {
      type: Date,
      default: Date.now,
    },
    last_used: {
      type: Date,
      default: null,
    },
    expires_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful for joining user -> trusted devices
trustedDeviceSchema.index({ user: 1, device_token_hash: 1 });

// Native MongoDB TTL index: automatically removes expired trusted devices
trustedDeviceSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);
export default TrustedDevice;