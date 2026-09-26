import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import OtpVerification from '../src/models/otpVerification.model.js';

describe('Authentication & User Management Integration Tests', () => {
  let server;
  let baseUrl;
  let testEmail;
  let testPassword = 'Password123!';
  let newPassword = 'NewSecretPassword456!';
  let authToken;

  before(async () => {
    await connectDB();
    // Start temporary test server on random available port
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/auth`;
    testEmail = `test_${Date.now()}@example.com`;
  });

  after(async () => {
    // Clean up created test data
    if (testEmail) {
      await User.deleteMany({ email: testEmail });
      await OtpVerification.deleteMany({ email: testEmail });
    }
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  });

  describe('1. User Registration Flow', () => {
    it('should reject registration if required fields are missing', async () => {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Please provide'));
    });

    it('should register a new user in pending_verification status and dispatch OTP', async () => {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Warehouse',
          email: testEmail,
          password: testPassword,
          role: 'warehouse_staff',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.requiresVerification, true);

      // Verify DB record
      const dbUser = await User.findOne({ email: testEmail });
      assert.ok(dbUser);
      assert.strictEqual(dbUser.is_email_verified, false);
      assert.strictEqual(dbUser.status, 'pending_verification');

      // Verify OTP record
      const otpRecord = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'email_verification',
        is_used: false,
      });
      assert.ok(otpRecord);
      assert.strictEqual(otpRecord.otp_code.length, 6);
    });

    it('should reject login before email is verified', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.requiresVerification, true);
    });
  });

  describe('2. Email OTP Verification Flow', () => {
    it('should reject verification with incorrect OTP code', async () => {
      const res = await fetch(`${baseUrl}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          otp_code: '000000',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Incorrect code'));
    });

    it('should verify email with valid OTP and return JWT token', async () => {
      const otpRecord = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'email_verification',
        is_used: false,
      });

      const res = await fetch(`${baseUrl}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          otp_code: otpRecord.otp_code,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.is_email_verified, true);
      assert.strictEqual(data.user.status, 'active');

      authToken = data.token;
    });

    it('should reject registering already verified email', async () => {
      const res = await fetch(`${baseUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Test',
          email: testEmail,
          password: testPassword,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('already registered and verified'));
    });
  });

  describe('3. Login Flow', () => {
    it('should reject login with wrong password', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'wrong_password_xyz',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.success, false);
    });

    it('should login successfully with correct credentials and return JWT', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.email, testEmail);

      authToken = data.token;
    });
  });

  describe('4. Protected Route & Role Flow', () => {
    it('should reject access to /me without token', async () => {
      const res = await fetch(`${baseUrl}/me`);
      const data = await res.json();

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('No token provided'));
    });

    it('should reject access to /me with invalid token', async () => {
      const res = await fetch(`${baseUrl}/me`, {
        headers: { Authorization: 'Bearer invalid_bogus_token_123' },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.success, false);
    });

    it('should return user profile with valid Bearer token', async () => {
      const res = await fetch(`${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.email, testEmail);
      assert.strictEqual(data.user.role, 'warehouse_staff');
    });
  });

  describe('5. Password Reset Flow', () => {
    it('should dispatch password reset OTP', async () => {
      const res = await fetch(`${baseUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const resetOtp = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'password_reset',
        is_used: false,
      });
      assert.ok(resetOtp);
      assert.strictEqual(resetOtp.otp_code.length, 6);
    });

    it('should reset password with valid OTP and allow login with new password', async () => {
      const resetOtp = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'password_reset',
        is_used: false,
      });

      const res = await fetch(`${baseUrl}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          otp_code: resetOtp.otp_code,
          new_password: newPassword,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);

      // Verify old password no longer works
      const oldLoginRes = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      assert.strictEqual(oldLoginRes.status, 401);

      // Verify new password works
      const newLoginRes = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: newPassword }),
      });
      const newLoginData = await newLoginRes.json();
      assert.strictEqual(newLoginRes.status, 200);
      assert.strictEqual(newLoginData.success, true);
    });
  });
});
