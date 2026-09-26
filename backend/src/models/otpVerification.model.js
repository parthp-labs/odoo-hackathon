import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      required: [true, 'Email is required for OTP verification'],
      lowercase: true,
      trim: true,
    },
    otp_code: {
      type: String,
      required: [true, 'OTP code is required'],
      trim: true,
    },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset', 'login_otp'],
      required: [true, 'OTP purpose is required'],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    max_attempts: {
      type: Number,
      default: 5,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    is_used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Native MongoDB TTL index: automatically deletes expired OTPs
otpVerificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
otpVerificationSchema.index({ email: 1, purpose: 1, is_used: 1 });

const OtpVerification = mongoose.model('OtpVerification', otpVerificationSchema);
export default OtpVerification;
