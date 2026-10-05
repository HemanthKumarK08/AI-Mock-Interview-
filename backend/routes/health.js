const express = require('express');
const router = express.Router();
const { verifyDatabaseConnection } = require('../config/db');

router.get('/health', async (req, res) => {
  const dbCheck = await verifyDatabaseConnection();
  
  res.status(200).json({
    success: true,
    message: "MockInterviewAI API is running",
    service: "MockInterviewAI",
    version: "0.1.0",
    database: {
      connected: dbCheck.success,
      activeDatabase: dbCheck.database || null,
      error: dbCheck.error || null
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
