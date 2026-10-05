const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const healthRouter = require('./routes/health');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { verifyDatabaseConnection } = require('./config/db');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// CORS configuration (Isolated to MockInterviewAI frontend)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by MockInterviewAI CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Register API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root information endpoint
app.get('/', (req, res) => {
  res.json({
    project: "MockInterviewAI",
    description: "AI-Powered Mock Interview & Performance Analysis System",
    phase: "Phase 2 - Student Dashboard, Interview Setup & Session Foundation",
    status: "healthy"
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `Audio file exceeds maximum allowed upload size: ${err.message}`
    });
  }

  const status = err.status || (err.statusCode ? err.statusCode : 500);
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start server if run directly
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`====================================================`);
    console.log(`MockInterviewAI Backend Service Running on Port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Auth:   http://localhost:${PORT}/api/auth`);
    console.log(`Profile: http://localhost:${PORT}/api/profile`);
    console.log(`====================================================`);

    const dbStatus = await verifyDatabaseConnection();
    if (dbStatus.success) {
      console.log(`[DB] Connected successfully to isolated database: ${dbStatus.database}`);
    } else {
      console.warn(`[DB] Database connection warning: ${dbStatus.error}`);
    }
  });
}

module.exports = app;
