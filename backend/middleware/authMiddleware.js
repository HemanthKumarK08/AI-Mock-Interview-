const { verifyToken } = require('../utils/jwt');
const SessionModel = require('../models/sessionModel');
const UserModel = require('../models/userModel');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId || !decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token signature'
      });
    }

    // Database session validation
    const session = await SessionModel.findByTokenId(decoded.sessionId);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session does not exist'
      });
    }

    if (session.user_id !== decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Session user mismatch'
      });
    }

    if (session.revoked_at) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked'
      });
    }

    const now = new Date();
    const expiry = new Date(session.expires_at);
    if (expiry <= now) {
      return res.status(401).json({
        success: false,
        message: 'Session has expired'
      });
    }

    // Verify user is still active
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive or not found'
      });
    }

    // Touch session for activity tracking (async, non-blocking)
    SessionModel.touch(decoded.sessionId).catch(() => {});

    // Attach authenticated context
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    req.sessionId = session.session_token_id;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error'
    });
  }
}

module.exports = {
  requireAuth
};
