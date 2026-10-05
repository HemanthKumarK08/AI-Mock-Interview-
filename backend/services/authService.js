const crypto = require('crypto');
const UserModel = require('../models/userModel');
const SessionModel = require('../models/sessionModel');
const ProfileModel = require('../models/profileModel');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { normalizeEmail, validateEmail, validatePassword } = require('../utils/validation');

class AuthService {
  static async register({ name, email, password, role }) {
    // Role check: Only 'student' is allowed; reject any attempt to register admin/other roles
    if (role && role !== 'student') {
      throw { status: 400, message: 'Invalid role. Only student accounts can be registered.' };
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw { status: 400, message: 'Name is required' };
    }

    if (name.trim().length > 255) {
      throw { status: 400, message: 'Name must be 255 characters or fewer' };
    }

    const cleanEmail = normalizeEmail(email);
    if (!validateEmail(cleanEmail)) {
      throw { status: 400, message: 'Valid email address is required' };
    }

    if (!validatePassword(password)) {
      throw { status: 400, message: 'Password must be at least 6 characters long' };
    }

    const existingUser = await UserModel.findByEmail(cleanEmail);
    if (existingUser) {
      throw { status: 409, message: 'Email is already registered' };
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({
      name: name.trim(),
      email: cleanEmail,
      passwordHash
    });

    // Initialize candidate profile row
    try {
      await ProfileModel.create(user.id, {});
    } catch (err) {
      // Profile creation non-fatal if row already exists
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'student'
    };
  }

  static async login({ email, password, userAgent, ipAddress }) {
    if (!email || !password) {
      throw { status: 400, message: 'Email and password are required' };
    }

    const cleanEmail = normalizeEmail(email);
    const user = await UserModel.findByEmail(cleanEmail);
    if (!user) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    if (!user.is_active) {
      throw { status: 403, message: 'Account is deactivated. Please contact support.' };
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw { status: 401, message: 'Invalid email or password' };
    }

    // Generate unique session token ID
    const sessionTokenId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await SessionModel.create({
      userId: user.id,
      sessionTokenId,
      userAgent,
      ipAddress,
      expiresAt
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionTokenId
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      expiresAt: expiresAt.toISOString()
    };
  }

  static async logout(sessionId) {
    if (!sessionId) return false;
    return await SessionModel.revoke(sessionId);
  }

  static async getCurrentUser(userId) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw { status: 404, message: 'User not found' };
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    };
  }
}

module.exports = AuthService;
