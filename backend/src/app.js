import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.route.js";
import warehouseRoutes from "./routes/warehouse.route.js";
import locationRoutes from "./routes/location.route.js";
import productCategoryRoutes from "./routes/productCategory.route.js";
import productRoutes from "./routes/product.route.js";
import operationRoutes from "./routes/operation.route.js";
import stockRoutes from "./routes/stock.route.js";
import moveRoutes from "./routes/move.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import errorHandler from "./middlewares/error.middleware.js";
import ErrorResponse from "./utils/errorResponse.js";

const app = express();

// Security and utility middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Dynamic CORS configuration for Vercel deployments and localhost
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any Vercel deployment preview or production domain
      if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, origin);
      }

      // Allow configured origins
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }

      return callback(null, origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  }),
);
app.options('*', cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to StockSense API",
    version: "1.0.0",
    docs: "/api/health",
  });
});

// API Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/categories", productCategoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/operations", operationRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/moves", moveRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 404 Catch-all Handler
app.use((req, res, next) => {
  next(new ErrorResponse(`Endpoint not found - ${req.originalUrl}`, 404));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
