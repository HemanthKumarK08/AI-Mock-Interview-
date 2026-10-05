const rateLimit = require('express-rate-limit');

// Rate limiter for authentication endpoints (e.g., login and register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 50, // Permissive in test mode, strictly enforced in dev/prod
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  }
});

module.exports = {
  authLimiter
};
