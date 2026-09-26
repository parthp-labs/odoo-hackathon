import generateToken from './generateToken.js';
import { isDeviceTrusted } from './trustedDevice.js';

// The login user-shape the rest of the auth module returns on success.
const loginUserShape = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  is_email_verified: user.is_email_verified,
  status: user.status,
});

// Resolve whether a login should proceed straight to a session (trusted device)
// or must first pass an OTP challenge (new/unknown device).
//
// Pure helper: all DB access is via injected models. A JWT is issued ONLY
// through the shared generateToken util so session tokens stay consistent with
// the rest of the app.
//
// Returns:
//   { ok: true, status: 'challenge_required' }        -> caller must OTP first
//   { ok: true, status: 'session', token, user }      -> trusted, session issued
const resolveLoginChallenge = async ({
  email,
  trustedDeviceToken,
  UserModel,
  OtpVerificationModel,
  TrustedDeviceModel,
}) => {
  // No token at all => always challenge the new device.
  if (!trustedDeviceToken) {
    return { ok: true, status: 'challenge_required' };
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return { ok: true, status: 'challenge_required' };
  }

  const trusted = await isDeviceTrusted({
    userId: user._id,
    rawToken: trustedDeviceToken,
    TrustedDeviceModel,
  });

  if (!trusted) {
    return { ok: true, status: 'challenge_required' };
  }

  const token = generateToken(user);
  return { ok: true, status: 'session', token, user: loginUserShape(user) };
};

export default resolveLoginChallenge;