import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with absolute path to .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

const server = app.listen(PORT, () => {
  console.log(`[Server] StockSense backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] ${err.message}`);
});
