const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Valid password string is required for hashing');
  }
  return await bcrypt.hash(plaintext, SALT_ROUNDS);
}

async function comparePassword(plaintext, hash) {
  if (!plaintext || !hash) {
    return false;
  }
  return await bcrypt.compare(plaintext, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};
