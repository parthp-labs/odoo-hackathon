const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoutes = require('./routes/health');
const errorHandler = require('./middlewares/errorHandler');
const ErrorResponse = require('./utils/errorResponse');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to StockSense API',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// API Routes
app.use('/api', healthRoutes);

// 404 Catch-all Handler
app.use((req, res, next) => {
  next(new ErrorResponse(`Endpoint not found - ${req.originalUrl}`, 404));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
