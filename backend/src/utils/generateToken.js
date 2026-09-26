import jwt from 'jsonwebtoken';
import getJwtSecret from './jwtSecret.js';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

export default generateToken;
