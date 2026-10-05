const { pool } = require('../config/db');

class UserModel {
  static async create({ name, email, passwordHash }) {
    const query = `
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, 'student', TRUE)
    `;
    const [result] = await pool.execute(query, [name, email, passwordHash]);
    return {
      id: result.insertId,
      name,
      email,
      role: 'student',
      is_active: true
    };
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password_hash, role, is_active, created_at, updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [email]);
    return rows[0] || null;
  }

  static async findById(id) {
    const query = `
      SELECT id, name, email, role, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }
}

module.exports = UserModel;
