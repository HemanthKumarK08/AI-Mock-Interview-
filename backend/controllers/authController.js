const AuthService = require('../services/authService');

class AuthController {
  static async register(req, res) {
    try {
      const { name, email, password, role } = req.body;
      const user = await AuthService.register({ name, email, password, role });
      
      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred during registration'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection?.remoteAddress || '';

      const loginResult = await AuthService.login({ email, password, userAgent, ipAddress });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: loginResult
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred during login'
      });
    }
  }

  static async logout(req, res) {
    try {
      const sessionId = req.sessionId;
      await AuthService.logout(sessionId);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred during logout'
      });
    }
  }

  static async getMe(req, res) {
    try {
      const user = await AuthService.getCurrentUser(req.user.id);

      return res.status(200).json({
        success: true,
        data: {
          user
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching current user'
      });
    }
  }
}

module.exports = AuthController;
