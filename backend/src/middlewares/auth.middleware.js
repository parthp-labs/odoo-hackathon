import jwt from 'jsonwebtoken';
import asyncHandler from './async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import getJwtSecret from '../utils/jwtSecret.js';
import User from '../models/user.model.js';

// Protect routes - verify JWT token
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route. No token provided.', 401));
  }

  try {
      const decoded = jwt.verify(
        token,
        getJwtSecret()
      );

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('User belonging to this token no longer exists.', 401));
    }

    if (user.status === 'disabled') {
      return next(new ErrorResponse('Your account has been disabled. Please contact an admin.', 403));
    }

    req.user = user;
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route. Invalid token.', 401));
  }
});

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role '${req.user ? req.user.role : 'guest'}' is not authorized to perform this action.`,
          403
        )
      );
    }
    next();
  };
};
