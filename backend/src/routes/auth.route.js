import express from 'express';
import {
  register,
  verifyEmail,
  resendOtp,
  login,
  requestLoginOtp,
  loginOtp,
  forgotPassword,
  resetPassword,
  getMe,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/request-login-otp', requestLoginOtp);
router.post('/login-otp', loginOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

export default router;