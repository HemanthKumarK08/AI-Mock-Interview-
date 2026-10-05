const { pool } = require('../config/db');

class InterviewSessionModel {
  static async create({
    userId,
    targetRole,
    interviewType,
    difficulty,
    interviewMode,
    questionCount,
    durationMinutes,
    status = 'ready'
  }) {
    const query = `
      INSERT INTO interview_sessions (
        user_id, target_role, interview_type, difficulty, interview_mode,
        question_count, duration_minutes, status, current_question_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;
    const [result] = await pool.execute(query, [
      userId,
      targetRole,
      interviewType,
      difficulty,
      interviewMode,
      questionCount,
      durationMinutes,
      status
    ]);

    return await this.findById(result.insertId);
  }

  static async findById(id) {
    const query = `
      SELECT 
        id,
        user_id,
        target_role,
        interview_type,
        difficulty,
        interview_mode,
        question_count,
        duration_minutes,
        status,
        current_question_number,
        started_at,
        completed_at,
        created_at,
        updated_at
      FROM interview_sessions
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async findByUserId(userId) {
    const query = `
      SELECT 
        id,
        user_id,
        target_role,
        interview_type,
        difficulty,
        interview_mode,
        question_count,
        duration_minutes,
        status,
        current_question_number,
        started_at,
        completed_at,
        created_at,
        updated_at
      FROM interview_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows;
  }

  static async updateStatus(id, newStatus, extraFields = {}) {
    const updates = ['status = ?'];
    const values = [newStatus];

    if (extraFields.started_at !== undefined) {
      updates.push('started_at = ?');
      values.push(extraFields.started_at);
    }

    if (extraFields.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(extraFields.completed_at);
    }

    if (extraFields.current_question_number !== undefined) {
      updates.push('current_question_number = ?');
      values.push(extraFields.current_question_number);
    }

    values.push(id);

    const query = `
      UPDATE interview_sessions
      SET ${updates.join(', ')}
      WHERE id = ?
    `;
    await pool.execute(query, values);
    return await this.findById(id);
  }

  static async getStatsByUserId(userId) {
    const query = `
      SELECT 
        COUNT(*) AS total_interviews,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_interviews,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_interviews,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready_interviews,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_interviews
      FROM interview_sessions
      WHERE user_id = ?
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows[0] || {
      total_interviews: 0,
      completed_interviews: 0,
      in_progress_interviews: 0,
      ready_interviews: 0,
      cancelled_interviews: 0
    };
  }
}

module.exports = InterviewSessionModel;
