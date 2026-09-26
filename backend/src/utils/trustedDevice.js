import crypto from 'node:crypto';

const DEFAULT_TRUST_DAYS = 30;

// Generate a cryptographically random trusted-device token (raw form, base64url).
const createTrustedToken = (byteLen = 32) => {
  return crypto.randomBytes(byteLen).toString('base64url');
};

// Hash a raw token so only its digest is ever persisted.
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Cheap format guard: reject missing / too-short tokens before hashing.
const assertDeviceTokenFormat = (token) => {
  if (!token || typeof token !== 'string' || token.length < 16) {
    throw new Error('Invalid trusted device token');
  }
};

// Upsert a trusted-device row for the given user, refreshing its expiry window
// (now + trustDays, default 30). Idempotent per (user, device_token_hash).
const mirrorTrustedDevice = async ({
  userId,
  rawToken,
  trustDays = DEFAULT_TRUST_DAYS,
  TrustedDeviceModel,
}) => {
  assertDeviceTokenFormat(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + trustDays * 24 * 60 * 60 * 1000);
  const hash = hashToken(rawToken);

  return TrustedDeviceModel.findOneAndUpdate(
    { user: userId, device_token_hash: hash },
    {
      $set: { last_used: now, expires_at: expiresAt },
      $setOnInsert: { first_seen: now },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

// Return true only when a matching, non-expired trusted-device row exists.
// Best-effort refreshes last_used without failing the check on a DB hiccup.
const isDeviceTrusted = async ({ userId, rawToken, TrustedDeviceModel }) => {
  try {
    assertDeviceTokenFormat(rawToken);
  } catch {
    return false;
  }

  const hash = hashToken(rawToken);
  const device = await TrustedDeviceModel.findOne({
    user: userId,
    device_token_hash: hash,
    expires_at: { $gt: new Date() },
  });

  if (!device) {
    return false;
  }

  try {
    await TrustedDeviceModel.updateOne(
      { _id: device._id },
      { $set: { last_used: new Date() } }
    );
  } catch {
    // best-effort, ignore refresh failures
  }

  return true;
};

export {
  createTrustedToken,
  hashToken,
  assertDeviceTokenFormat,
  mirrorTrustedDevice,
  isDeviceTrusted,
  DEFAULT_TRUST_DAYS,
};