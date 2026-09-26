import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import OtpVerification from '../src/models/otpVerification.model.js';
import TrustedDevice from '../src/models/trustedDevice.model.js';
import {
  createTrustedToken,
  mirrorTrustedDevice,
} from '../src/utils/trustedDevice.js';

// Integration-ish tests for the new-device OTP step-up login flow. Uses the
// real backend (connectDB + app.listen(0) + fetch) exactly like auth.test.js.
describe('New-Device OTP Step-Up Login Tests', () => {
  let server;
  let baseUrl;
  let testEmail;
  let testPassword = 'Password123!';
  let userId;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/auth`;
    testEmail = `otpstepup_${Date.now()}@example.com`;
  });

  after(async () => {
    if (testEmail) {
      await User.deleteMany({ email: testEmail });
      await OtpVerification.deleteMany({ email: testEmail });
    }
    if (userId) {
      await TrustedDevice.deleteMany({ user: userId });
    }
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  });

  const post = (path, body) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let verifiedUser;

  describe('1. Registration + verification baseline', () => {
    it('registers a user (pending_verification)', async () => {
      const res = await post('/register', {
        name: 'OTP Stepup Tester',
        email: testEmail,
        password: testPassword,
        role: 'warehouse_staff',
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.requiresVerification, true);
    });

    it('verifies the email with a valid OTP and returns a token', async () => {
      const otpRecord = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'email_verification',
        is_used: false,
      });
      assert.ok(otpRecord);

      const res = await post('/verify-email', {
        email: testEmail,
        otp_code: otpRecord.otp_code,
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.status, 'active');

      verifiedUser = await User.findOne({ email: testEmail });
      userId = verifiedUser._id;
    });
  });

  describe('2. Trusted-device session path on /login', () => {
    it('logs in straight to a session when a valid trustedDeviceToken is supplied', async () => {
      // Pre-trust a device for this user (mirrors the trusted-device utility).
      const rawToken = createTrustedToken();
      await mirrorTrustedDevice({
        userId,
        rawToken,
        TrustedDeviceModel: TrustedDevice,
      });

      const res = await post('/login', {
        email: testEmail,
        password: testPassword,
        trustedDeviceToken: rawToken,
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.user.email, testEmail);
      assert.strictEqual(data.requiresOtpChallenge, undefined);
    });
  });

  describe('3. Challenge response when no/invalid trusted token is given', () => {
    it('keeps plain-login behavior (returns a session token) when no trustedDeviceToken is present', async () => {
      const res = await post('/login', {
        email: testEmail,
        password: testPassword,
      });
      const data = await res.json();

      // Backward compatibility: a plain login without a trustedDeviceToken
      // returns a token exactly as it did before -- no OTP challenge is forced.
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(data.requiresOtpChallenge, undefined);
    });

    it('responds with requiresOtpChallenge for an untrusted token', async () => {
      const res = await post('/login', {
        email: testEmail,
        password: testPassword,
        trustedDeviceToken: createTrustedToken(), // not trusted for this user
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.requiresOtpChallenge, true);
      assert.strictEqual(data.token, undefined);
    });
  });

  describe('4. login-otp dispatch + verify flow', () => {
    it('dispatches a login_otp code via /request-login-otp', async () => {
      const res = await post('/request-login-otp', { email: testEmail });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const otpRecord = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'login_otp',
        is_used: false,
      });
      assert.ok(otpRecord);
      assert.strictEqual(otpRecord.otp_code.length, 6);
    });

    it('rejects /login-otp with a wrong code (400)', async () => {
      const res = await post('/login-otp', {
        email: testEmail,
        otp_code: '000000',
      });
      const data = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Incorrect code'));
    });

    it('completes /login-otp with the valid code and returns token + trustedDeviceToken', async () => {
      const otpRecord = await OtpVerification.findOne({
        email: testEmail,
        purpose: 'login_otp',
        is_used: false,
      });
      assert.ok(otpRecord);

      const res = await post('/login-otp', {
        email: testEmail,
        otp_code: otpRecord.otp_code,
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token);
      assert.strictEqual(typeof data.trustedDeviceToken, 'string');
      assert.ok(data.trustedDeviceToken.length >= 16);
      assert.strictEqual(data.user.email, testEmail);

      // The returned trustedDeviceToken should now be trusted for this user.
      const trustedLogin = await post('/login', {
        email: testEmail,
        password: testPassword,
        trustedDeviceToken: data.trustedDeviceToken,
      });
      const trustedData = await trustedLogin.json();
      assert.strictEqual(trustedLogin.status, 200);
      assert.strictEqual(trustedData.success, true);
      assert.ok(trustedData.token);
    });
  });
});