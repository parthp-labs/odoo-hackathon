import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import healthRoutes from './routes/health.route.js';
import authRoutes from './routes/auth.route.js';
import warehouseRoutes from './routes/warehouse.route.js';
import locationRoutes from './routes/location.route.js';
import productCategoryRoutes from './routes/productCategory.route.js';
import productRoutes from './routes/product.route.js';
import errorHandler from './middlewares/error.middleware.js';
import ErrorResponse from './utils/errorResponse.js';

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
app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/categories', productCategoryRoutes);
app.use('/api/products', productRoutes);

// 404 Catch-all Handler
app.use((req, res, next) => {
  next(new ErrorResponse(`Endpoint not found - ${req.originalUrl}`, 404));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
