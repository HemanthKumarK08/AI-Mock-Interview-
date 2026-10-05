const { pool } = require('../config/db');

class AnswerEvaluationModel {
  static async create({
    conversationId,
    technicalAccuracy = null,
    relevance,
    completeness,
    clarity,
    communication,
    strengths = [],
    weaknesses = [],
    improvementSuggestion,
    evaluationConfidence = 0.85,
    star = null,
    starCompleteness = null,
    evaluationSource = 'gemini',
    evaluationMetadata = {}
  }) {
    const starSituation = star ? (star.situation === true ? 1 : (star.situation === false ? 0 : null)) : null;
    const starTask = star ? (star.task === true ? 1 : (star.task === false ? 0 : null)) : null;
    const starAction = star ? (star.action === true ? 1 : (star.action === false ? 0 : null)) : null;
    const starResult = star ? (star.result === true ? 1 : (star.result === false ? 0 : null)) : null;

    const query = `
      INSERT INTO answer_evaluations (
        conversation_id,
        technical_accuracy,
        relevance,
        completeness,
        clarity,
        communication,
        strengths,
        weaknesses,
        improvement_suggestion,
        evaluation_confidence,
        star_situation,
        star_task,
        star_action,
        star_result,
        star_completeness,
        evaluation_source,
        evaluation_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        technical_accuracy = VALUES(technical_accuracy),
        relevance = VALUES(relevance),
        completeness = VALUES(completeness),
        clarity = VALUES(clarity),
        communication = VALUES(communication),
        strengths = VALUES(strengths),
        weaknesses = VALUES(weaknesses),
        improvement_suggestion = VALUES(improvement_suggestion),
        evaluation_confidence = VALUES(evaluation_confidence),
        star_situation = VALUES(star_situation),
        star_task = VALUES(star_task),
        star_action = VALUES(star_action),
        star_result = VALUES(star_result),
        star_completeness = VALUES(star_completeness),
        evaluation_source = VALUES(evaluation_source),
        evaluation_metadata = VALUES(evaluation_metadata)
    `;

    const [result] = await pool.query(query, [
      conversationId,
      technicalAccuracy !== null && technicalAccuracy !== undefined ? Number(technicalAccuracy) : null,
      Number(relevance),
      Number(completeness),
      Number(clarity),
      Number(communication),
      JSON.stringify(Array.isArray(strengths) ? strengths : []),
      JSON.stringify(Array.isArray(weaknesses) ? weaknesses : []),
      improvementSuggestion || '',
      Number(evaluationConfidence),
      starSituation,
      starTask,
      starAction,
      starResult,
      starCompleteness !== null && starCompleteness !== undefined ? Number(starCompleteness) : null,
      evaluationSource,
      JSON.stringify(evaluationMetadata || {})
    ]);

    return await this.findByConversationId(conversationId);
  }

  static async findByConversationId(conversationId) {
    const query = `
      SELECT 
        ae.*,
        ic.session_id,
        ic.turn_number,
        ic.question,
        ic.question_type,
        ic.question_topic,
        ic.student_answer
      FROM answer_evaluations ae
      JOIN interview_conversations ic ON ae.conversation_id = ic.id
      WHERE ae.conversation_id = ?
    `;
    const [rows] = await pool.query(query, [conversationId]);
    if (rows.length === 0) return null;
    return this.formatRow(rows[0]);
  }

  static async findBySessionId(sessionId) {
    const query = `
      SELECT 
        ae.*,
        ic.session_id,
        ic.turn_number,
        ic.question,
        ic.question_type,
        ic.question_topic,
        ic.student_answer
      FROM answer_evaluations ae
      JOIN interview_conversations ic ON ae.conversation_id = ic.id
      WHERE ic.session_id = ?
      ORDER BY ic.turn_number ASC
    `;
    const [rows] = await pool.query(query, [sessionId]);
    return rows.map(row => this.formatRow(row));
  }

  static formatRow(row) {
    if (!row) return null;
    let strengths = [];
    let weaknesses = [];
    let metadata = {};

    try {
      strengths = typeof row.strengths === 'string' ? JSON.parse(row.strengths) : (row.strengths || []);
    } catch {
      strengths = [];
    }

    try {
      weaknesses = typeof row.weaknesses === 'string' ? JSON.parse(row.weaknesses) : (row.weaknesses || []);
    } catch {
      weaknesses = [];
    }

    try {
      metadata = typeof row.evaluation_metadata === 'string' ? JSON.parse(row.evaluation_metadata) : (row.evaluation_metadata || {});
    } catch {
      metadata = {};
    }

    let star = null;
    if (row.star_situation !== null || row.star_task !== null || row.star_action !== null || row.star_result !== null) {
      star = {
        situation: row.star_situation === 1 || row.star_situation === true,
        task: row.star_task === 1 || row.star_task === true,
        action: row.star_action === 1 || row.star_action === true,
        result: row.star_result === 1 || row.star_result === true
      };
    }

    return {
      id: row.id,
      conversationId: row.conversation_id,
      sessionId: row.session_id,
      turnNumber: row.turn_number,
      question: row.question,
      questionType: row.question_type,
      questionTopic: row.question_topic,
      studentAnswer: row.student_answer,
      technicalAccuracy: row.technical_accuracy !== null ? Number(row.technical_accuracy) : null,
      relevance: Number(row.relevance),
      completeness: Number(row.completeness),
      clarity: Number(row.clarity),
      communication: Number(row.communication),
      strengths,
      weaknesses,
      improvementSuggestion: row.improvement_suggestion,
      evaluationConfidence: Number(row.evaluation_confidence),
      star,
      starCompleteness: row.star_completeness !== null ? Number(row.star_completeness) : null,
      evaluationSource: row.evaluation_source,
      metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = AnswerEvaluationModel;
