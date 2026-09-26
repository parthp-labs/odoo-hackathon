import jwt from 'jsonwebtoken';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET || 'dev_secret_jwt_key_stocksense_12345',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

export default generateToken;
