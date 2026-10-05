const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Public authentication routes
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);

// Protected authentication routes
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);

module.exports = router;
