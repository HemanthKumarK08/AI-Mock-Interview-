const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'mock_interview_ai_dev_secret_key_2026';

function signToken(payload, options = {}) {
  const expiresIn = options.expiresIn || '7d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  JWT_SECRET
};
