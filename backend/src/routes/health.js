const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', (req, res) => {
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    status: 'ok',
    service: 'StockSense IMS Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus[mongoose.connection.readyState] || 'unknown',
  });
});

module.exports = router;
