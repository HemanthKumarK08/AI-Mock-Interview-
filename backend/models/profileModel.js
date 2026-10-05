const { pool } = require('../config/db');

class ProfileModel {
  static async create(userId, data = {}) {
    const query = `
      INSERT INTO candidate_profiles (
        user_id, phone, education, institution, experience_years, current_role, target_role, skills, bio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      userId,
      data.phone || null,
      data.education || null,
      data.institution || null,
      data.experience_years !== undefined ? data.experience_years : 0.0,
      data.current_role || null,
      data.target_role || null,
      data.skills || null,
      data.bio || null
    ];
    const [result] = await pool.execute(query, values);
    return await this.findByUserId(userId);
  }

  static async findByUserId(userId) {
    const query = `
      SELECT 
        cp.id,
        cp.user_id,
        u.name,
        u.email,
        u.role,
        cp.phone,
        cp.education,
        cp.institution,
        cp.experience_years,
        cp.current_role,
        cp.target_role,
        cp.skills,
        cp.bio,
        cp.created_at,
        cp.updated_at
      FROM candidate_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows[0] || null;
  }

  static async update(userId, data = {}) {
    // Dynamic update with parameterized queries
    const fields = [];
    const values = [];

    const allowedFields = [
      'phone',
      'education',
      'institution',
      'experience_years',
      'current_role',
      'target_role',
      'skills',
      'bio'
    ];

    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) {
      return await this.findByUserId(userId);
    }

    values.push(userId);
    const query = `
      UPDATE candidate_profiles
      SET ${fields.join(', ')}
      WHERE user_id = ?
    `;
    await pool.execute(query, values);
    return await this.findByUserId(userId);
  }
}

module.exports = ProfileModel;
