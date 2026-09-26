const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging during development
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error Details]', {
      name: err.name,
      code: err.code,
      message: err.message,
      stack: err.stack,
    });
  }

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // 2. Mongoose Duplicate Key Error (Code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    const message = `Duplicate value '${value}' entered for ${field}. Please use another value.`;
    error = new ErrorResponse(message, 400);
  }

  // 3. Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }

  // 4. JWT Invalid Token Error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authorization token. Please log in again.';
    error = new ErrorResponse(message, 401);
  }

  // 5. JWT Token Expired Error
  if (err.name === 'TokenExpiredError') {
    const message = 'Authorization token has expired. Please log in again.';
    error = new ErrorResponse(message, 401);
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
