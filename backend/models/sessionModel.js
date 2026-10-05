const { pool } = require('../config/db');

class SessionModel {
  static async create({ userId, sessionTokenId, userAgent, ipAddress, expiresAt }) {
    const query = `
      INSERT INTO user_sessions (user_id, session_token_id, user_agent, ip_address, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [userId, sessionTokenId, userAgent || null, ipAddress || null, expiresAt]);
    return {
      id: result.insertId,
      userId,
      sessionTokenId,
      expiresAt
    };
  }

  static async findByTokenId(sessionTokenId) {
    const query = `
      SELECT id, user_id, session_token_id, user_agent, ip_address, expires_at, last_activity, revoked_at, created_at
      FROM user_sessions
      WHERE session_token_id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [sessionTokenId]);
    return rows[0] || null;
  }

  static async revoke(sessionTokenId) {
    const query = `
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE session_token_id = ? AND revoked_at IS NULL
    `;
    const [result] = await pool.execute(query, [sessionTokenId]);
    return result.affectedRows > 0;
  }

  static async touch(sessionTokenId) {
    const query = `
      UPDATE user_sessions
      SET last_activity = NOW()
      WHERE session_token_id = ?
    `;
    await pool.execute(query, [sessionTokenId]);
  }
}

module.exports = SessionModel;
