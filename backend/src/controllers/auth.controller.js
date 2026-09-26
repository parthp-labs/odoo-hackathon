import asyncHandler from "../middlewares/async.middleware.js";
import ErrorResponse from "../utils/errorResponse.js";
import User from "../models/user.model.js";
import OtpVerification from "../models/otpVerification.model.js";
import TrustedDevice from "../models/trustedDevice.model.js";
import generateToken from "../utils/generateToken.js";
import sendEmail from "../utils/sendEmail.js";
import resolveLoginChallenge from "../utils/otpChallenge.js";
import {
  createTrustedToken,
  mirrorTrustedDevice,
} from "../utils/trustedDevice.js";

// Login user-shape returned consistently on any successful session.
const loginUserShape = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  is_email_verified: user.is_email_verified,
  status: user.status,
});

// Helper to generate a 6-digit numeric OTP string
const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register a new user (with first-time email verification)
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return next(
      new ErrorResponse("Please provide name, email, and password", 400),
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    if (user.is_email_verified) {
      return next(
        new ErrorResponse(
          "Email already registered and verified. Please log in.",
          400,
        ),
      );
    }
    // If user exists but not verified, update name and password and re-send OTP
    user.name = name;
    user.password_hash = password;
    if (role) user.role = role;
    await user.save();
  } else {
    // Create new unverified user
    user = await User.create({
      name,
      email: normalizedEmail,
      password_hash: password,
      role: role || "warehouse_staff",
      is_email_verified: false,
      status: "pending_verification",
    });
  }

  // Invalidate any previous unused email verification OTPs for this email
  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose: "email_verification", is_used: false },
    { is_used: true },
  );

  // Generate 6-digit OTP valid for 10 minutes
  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpVerification.create({
    user_id: user._id,
    email: normalizedEmail,
    otp_code: otpCode,
    purpose: "email_verification",
    expires_at: expiresAt,
  });

  // Dispatch email with OTP
  await sendEmail({
    to: normalizedEmail,
    subject: "StockSense - Verify Your Email",
    purpose: "Email Verification",
    otpCode,
    text: `Welcome to StockSense! Your 6-digit email verification code is: ${otpCode}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to StockSense IMS</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for registering. Please use the verification code below to activate your account:</p>
        <h1 style="color: #4F46E5; letter-spacing: 4px;">${otpCode}</h1>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, please disregard this email.</p>
      </div>
    `,
  });

  res.status(201).json({
    success: true,
    message:
      "Registration successful. A 6-digit verification code has been sent to your email.",
    email: normalizedEmail,
    requiresVerification: true,
  });
});

// @desc    Verify email with 6-digit OTP
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = asyncHandler(async (req, res, next) => {
  const { email, otp_code } = req.body;

  if (!email || !otp_code) {
    return next(
      new ErrorResponse("Please provide email and the 6-digit OTP code", 400),
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find most recent active OTP
  const otpRecord = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: "email_verification",
    is_used: false,
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return next(
      new ErrorResponse(
        "Invalid or expired verification code. Please request a new one.",
        400,
      ),
    );
  }

  // Check attempt threshold to prevent brute-force
  if (otpRecord.attempts >= otpRecord.max_attempts) {
    otpRecord.is_used = true;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        "Maximum verification attempts exceeded. Please request a new code.",
        400,
      ),
    );
  }

  if (otpRecord.otp_code !== otp_code.trim()) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        `Incorrect code. ${otpRecord.max_attempts - otpRecord.attempts} attempts remaining.`,
        400,
      ),
    );
  }

  // Mark OTP as used
  otpRecord.is_used = true;
  await otpRecord.save();

  // Activate user account
  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      is_email_verified: true,
      status: "active",
      email_verified_at: new Date(),
    },
    { new: true },
  );

  if (!user) {
    return next(new ErrorResponse("User account not found", 404));
  }

  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: "Email successfully verified! Welcome to StockSense.",
    token,
    user: loginUserShape(user),
  });
});

// @desc    Resend OTP verification code
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOtp = asyncHandler(async (req, res, next) => {
  const { email, purpose } = req.body;

  if (!email) {
    return next(new ErrorResponse("Please provide email address", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otpPurpose = purpose || "email_verification";

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return next(new ErrorResponse("No account found with this email", 404));
  }

  if (otpPurpose === "email_verification" && user.is_email_verified) {
    return next(
      new ErrorResponse("Email is already verified. Please log in.", 400),
    );
  }

  // Invalidate prior unused OTPs
  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose: otpPurpose, is_used: false },
    { is_used: true },
  );

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpVerification.create({
    user_id: user._id,
    email: normalizedEmail,
    otp_code: otpCode,
    purpose: otpPurpose,
    expires_at: expiresAt,
  });

  await sendEmail({
    to: normalizedEmail,
    subject: `StockSense - Your ${otpPurpose === "password_reset" ? "Password Reset" : "Verification"} Code`,
    purpose: otpPurpose,
    otpCode,
    text: `Your StockSense verification code is: ${otpCode}. Valid for 10 minutes.`,
  });

  res.status(200).json({
    success: true,
    message:
      "A new 6-digit verification code has been dispatched to your email.",
  });
});

// @desc    Login user & get JWT token
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res, next) => {
  const { email, password, trustedDeviceToken } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse("Please provide email and password", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user and explicitly include password_hash
  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password_hash",
  );

  if (!user) {
    return next(new ErrorResponse("Invalid email or password", 401));
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse("Invalid email or password", 401));
  }

  // Check email verification status
  if (!user.is_email_verified) {
    return res.status(403).json({
      success: false,
      requiresVerification: true,
      message:
        "Please verify your email before logging in. An OTP verification is required.",
      email: user.email,
    });
  }

  if (user.status === "disabled") {
    return next(
      new ErrorResponse(
        "Your account has been deactivated. Please contact an admin.",
        403,
      ),
    );
  }

  // New-device step-up: when a trustedDeviceToken is supplied, gate login on it.
  // A valid token means this device has already been verified -> straight to a
  // session (same { token, user } shape as plain login). Otherwise the caller
  // must complete an OTP challenge before a token is issued.
  if (trustedDeviceToken) {
    const challenge = await resolveLoginChallenge({
      email: normalizedEmail,
      trustedDeviceToken,
      UserModel: User,
      OtpVerificationModel: OtpVerification,
      TrustedDeviceModel: TrustedDevice,
    });

    if (challenge.status === "session") {
      return res.status(200).json({
        success: true,
        token: challenge.token,
        user: challenge.user,
      });
    }

    return res.status(200).json({
      success: true,
      requiresOtpChallenge: true,
      message:
        "New device detected. An OTP has been sent to your email to complete login.",
      email: normalizedEmail,
    });
  }

  // Plain login (no trustedDeviceToken) keeps the existing behavior
  // unchanged: issue a session immediately.
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    token,
    user: loginUserShape(user),
  });
});

// @desc    Dispatch a step-up OTP for login on a new/unknown device
// @route   POST /api/auth/request-login-otp
// @access  Public
export const requestLoginOtp = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse("Please provide your email address", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return next(
      new ErrorResponse("No account registered with this email", 404),
    );
  }

  if (user.status === "disabled") {
    return next(
      new ErrorResponse(
        "Your account has been deactivated. Please contact an admin.",
        403,
      ),
    );
  }

  // Invalidate any pending login OTPs for this email
  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose: "login_otp", is_used: false },
    { is_used: true },
  );

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpVerification.create({
    user_id: user._id,
    email: normalizedEmail,
    otp_code: otpCode,
    purpose: "login_otp",
    expires_at: expiresAt,
  });

  await sendEmail({
    to: normalizedEmail,
    subject: "StockSense - Email OTP Login",
    purpose: "Email OTP Login",
    otpCode,
    text: `Your StockSense login code is: ${otpCode}. Valid for 10 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>StockSense Email OTP Login</h2>
        <p>To complete your login from a new device, use the code below:</p>
        <h1 style="color: #4F46E5; letter-spacing: 4px;">${otpCode}</h1>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you did not attempt to log in, please secure your account immediately.</p>
      </div>
    `,
  });

  res.status(200).json({
    success: true,
    message: "A 6-digit login code has been sent to your email.",
    email: normalizedEmail,
  });
});

// @desc    Complete step-up login with a 6-digit OTP and mark device trusted
// @route   POST /api/auth/login-otp
// @access  Public
export const loginOtp = asyncHandler(async (req, res, next) => {
  const { email, otp_code } = req.body;

  if (!email || !otp_code) {
    return next(
      new ErrorResponse("Please provide email and the 6-digit OTP code", 400),
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const otpRecord = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: "login_otp",
    is_used: false,
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return next(
      new ErrorResponse(
        "Invalid or expired login code. Please request a new one.",
        400,
      ),
    );
  }

  // Check attempt threshold to prevent brute-force
  if (otpRecord.attempts >= otpRecord.max_attempts) {
    otpRecord.is_used = true;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        "Maximum attempts exceeded. Please request a new login code.",
        400,
      ),
    );
  }

  if (otpRecord.otp_code !== otp_code.trim()) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        `Incorrect code. ${otpRecord.max_attempts - otpRecord.attempts} attempts remaining.`,
        400,
      ),
    );
  }

  // Mark OTP as used
  otpRecord.is_used = true;
  await otpRecord.save();

  const userId = otpRecord.user_id;
  if (!userId) {
    return next(new ErrorResponse("User account not found", 404));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse("User account not found", 404));
  }

  // Activate user if the account is still pending verification (step-up login
  // proves possession of the email).
  if (!user.is_email_verified || user.status === "pending_verification") {
    user.is_email_verified = true;
    user.status = "active";
    user.email_verified_at = user.email_verified_at || new Date();
    await user.save();
  }

  // Issue the session token and a trusted-device token so the caller can skip
  // OTP challenge on their next login.
  const token = generateToken(user);
  const trustedDeviceToken = createTrustedToken();

  const trustDays = parseInt(process.env.DEVICE_TRUST_DAYS, 10) || 30;
  await mirrorTrustedDevice({
    userId: user._id,
    rawToken: trustedDeviceToken,
    trustDays,
    TrustedDeviceModel: TrustedDevice,
  });

  res.status(200).json({
    success: true,
    message: "Login successful on new device.",
    token,
    user: loginUserShape(user),
    trustedDeviceToken,
  });
});

// @desc    Forgot password - dispatch OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse("Please provide your email address", 400));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return next(
      new ErrorResponse("No account registered with this email", 404),
    );
  }

  // Invalidate any pending password reset OTPs
  await OtpVerification.updateMany(
    { email: normalizedEmail, purpose: "password_reset", is_used: false },
    { is_used: true },
  );

  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpVerification.create({
    user_id: user._id,
    email: normalizedEmail,
    otp_code: otpCode,
    purpose: "password_reset",
    expires_at: expiresAt,
  });

  await sendEmail({
    to: normalizedEmail,
    subject: "StockSense - Password Reset Code",
    purpose: "Password Reset",
    otpCode,
    text: `Your password reset code is: ${otpCode}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>StockSense Password Reset</h2>
        <p>You requested to reset your password. Use the following code:</p>
        <h1 style="color: #DC2626; letter-spacing: 4px;">${otpCode}</h1>
        <p>This code expires in 10 minutes. If you did not request this, please secure your account immediately.</p>
      </div>
    `,
  });

  res.status(200).json({
    success: true,
    message: "Password reset code sent to your email.",
    email: normalizedEmail,
  });
});

// @desc    Reset password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = asyncHandler(async (req, res, next) => {
  const { email, otp_code, new_password } = req.body;

  if (!email || !otp_code || !new_password) {
    return next(
      new ErrorResponse(
        "Please provide email, OTP code, and new password",
        400,
      ),
    );
  }

  if (new_password.length < 6) {
    return next(
      new ErrorResponse("New password must be at least 6 characters long", 400),
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const otpRecord = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose: "password_reset",
    is_used: false,
    expires_at: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return next(
      new ErrorResponse(
        "Invalid or expired password reset code. Please request a new one.",
        400,
      ),
    );
  }

  if (otpRecord.attempts >= otpRecord.max_attempts) {
    otpRecord.is_used = true;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        "Maximum attempts exceeded. Please request a new reset code.",
        400,
      ),
    );
  }

  if (otpRecord.otp_code !== otp_code.trim()) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return next(
      new ErrorResponse(
        `Incorrect code. ${otpRecord.max_attempts - otpRecord.attempts} attempts remaining.`,
        400,
      ),
    );
  }

  otpRecord.is_used = true;
  await otpRecord.save();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return next(new ErrorResponse("User account not found", 404));
  }

  // Update password (triggers bcrypt pre-save hash)
  user.password_hash = new_password;
  await user.save();

  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message:
      "Password successfully reset! You can now log in with your new password.",
    token,
  });
});

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private (Requires Bearer token)
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_email_verified: user.is_email_verified,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});
