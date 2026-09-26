// Central JWT secret resolution. Reads JWT_SECRET; fails closed in production
// if unset so a deploy can never silently sign/verify tokens with a public
// default key. Dev keeps the known default for local convenience only.
const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV !== 'production') {
    return 'dev_secret_jwt_key_stocksense_12345';
  }
  throw new Error('JWT_SECRET is not set — refusing auth in production');
};

export default getJwtSecret;