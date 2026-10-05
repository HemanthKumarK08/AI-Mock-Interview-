const { pool } = require('../config/db');

class InterviewConversationModel {
  static async createTurn({
    sessionId,
    turnNumber,
    question,
    questionType = 'technical',
    questionTopic = null,
    difficulty = 'intermediate',
    aiResponseMetadata = null
  }) {
    const query = `
      INSERT INTO interview_conversations (
        session_id, turn_number, question, question_type, question_topic, difficulty, ai_response_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const metadataJson = aiResponseMetadata ? JSON.stringify(aiResponseMetadata) : null;
    const [result] = await pool.execute(query, [
      sessionId,
      turnNumber,
      question,
      questionType,
      questionTopic,
      difficulty,
      metadataJson
    ]);

    return await this.findById(result.insertId);
  }

  static async findById(id) {
    const query = `
      SELECT 
        id, session_id, turn_number, question, question_type, question_topic,
        difficulty, student_answer, ai_response_metadata, input_mode, transcription_metadata, created_at, answered_at
      FROM interview_conversations
      WHERE id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async findBySessionId(sessionId) {
    const query = `
      SELECT 
        id, session_id, turn_number, question, question_type, question_topic,
        difficulty, student_answer, ai_response_metadata, input_mode, transcription_metadata, created_at, answered_at
      FROM interview_conversations
      WHERE session_id = ?
      ORDER BY turn_number ASC
    `;
    const [rows] = await pool.execute(query, [sessionId]);
    return rows;
  }

  static async findCurrentUnansweredTurn(sessionId) {
    const query = `
      SELECT 
        id, session_id, turn_number, question, question_type, question_topic,
        difficulty, student_answer, ai_response_metadata, input_mode, transcription_metadata, created_at, answered_at
      FROM interview_conversations
      WHERE session_id = ? AND student_answer IS NULL
      ORDER BY turn_number ASC
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [sessionId]);
    return rows[0] || null;
  }

  static async findLatestTurn(sessionId) {
    const query = `
      SELECT 
        id, session_id, turn_number, question, question_type, question_topic,
        difficulty, student_answer, ai_response_metadata, input_mode, transcription_metadata, created_at, answered_at
      FROM interview_conversations
      WHERE session_id = ?
      ORDER BY turn_number DESC
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [sessionId]);
    return rows[0] || null;
  }

  static async saveAnswer(sessionId, turnNumber, studentAnswer, inputMode = 'text', transcriptionMetadata = null) {
    const query = `
      UPDATE interview_conversations
      SET student_answer = ?, input_mode = ?, transcription_metadata = ?, answered_at = NOW()
      WHERE session_id = ? AND turn_number = ? AND student_answer IS NULL
    `;
    const metaJson = transcriptionMetadata ? JSON.stringify(transcriptionMetadata) : null;
    const [result] = await pool.execute(query, [studentAnswer, inputMode, metaJson, sessionId, turnNumber]);
    return result.affectedRows > 0;
  }
}

module.exports = InterviewConversationModel;
