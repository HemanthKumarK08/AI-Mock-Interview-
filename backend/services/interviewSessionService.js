const InterviewSessionModel = require('../models/interviewSessionModel');
const {
  ALLOWED_TARGET_ROLES,
  ALLOWED_INTERVIEW_TYPES,
  ALLOWED_DIFFICULTIES,
  ALLOWED_INTERVIEW_MODES,
  ALLOWED_QUESTION_COUNTS,
  ALLOWED_DURATIONS_MINUTES,
  ALLOWED_TRANSITIONS
} = require('../config/interviewOptions');

class InterviewSessionService {
  static validateConfiguration({ targetRole, interviewType, difficulty, interviewMode, questionCount, durationMinutes }) {
    const errors = [];

    // Target role validation
    if (!targetRole || typeof targetRole !== 'string' || targetRole.trim().length === 0) {
      errors.push('Target job role is required');
    } else {
      const match = ALLOWED_TARGET_ROLES.find(r => r.toLowerCase() === targetRole.trim().toLowerCase());
      if (!match) {
        errors.push(`Invalid target role '${targetRole}'. Allowed roles: ${ALLOWED_TARGET_ROLES.join(', ')}`);
      }
    }

    // Interview type validation
    const cleanType = typeof interviewType === 'string' ? interviewType.trim().toLowerCase() : '';
    if (!ALLOWED_INTERVIEW_TYPES.includes(cleanType)) {
      errors.push(`Invalid interview type '${interviewType}'. Allowed types: ${ALLOWED_INTERVIEW_TYPES.join(', ')}`);
    }

    // Difficulty validation
    const cleanDifficulty = typeof difficulty === 'string' ? difficulty.trim().toLowerCase() : '';
    if (!ALLOWED_DIFFICULTIES.includes(cleanDifficulty)) {
      errors.push(`Invalid difficulty '${difficulty}'. Allowed difficulties: ${ALLOWED_DIFFICULTIES.join(', ')}`);
    }

    // Interview mode validation
    const cleanMode = typeof interviewMode === 'string' ? interviewMode.trim().toLowerCase() : '';
    if (!ALLOWED_INTERVIEW_MODES.includes(cleanMode)) {
      errors.push(`Invalid interview mode '${interviewMode}'. Allowed modes: ${ALLOWED_INTERVIEW_MODES.join(', ')}`);
    }

    // Question count validation
    const countNum = parseInt(questionCount, 10);
    if (isNaN(countNum) || !ALLOWED_QUESTION_COUNTS.includes(countNum)) {
      errors.push(`Invalid question count '${questionCount}'. Allowed counts: ${ALLOWED_QUESTION_COUNTS.join(', ')}`);
    }

    // Duration validation
    const durationNum = parseInt(durationMinutes, 10);
    if (isNaN(durationNum) || !ALLOWED_DURATIONS_MINUTES.includes(durationNum)) {
      errors.push(`Invalid duration '${durationMinutes}'. Allowed durations (minutes): ${ALLOWED_DURATIONS_MINUTES.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        targetRole: ALLOWED_TARGET_ROLES.find(r => r.toLowerCase() === (targetRole || '').trim().toLowerCase()) || targetRole,
        interviewType: cleanType,
        difficulty: cleanDifficulty,
        interviewMode: cleanMode,
        questionCount: countNum,
        durationMinutes: durationNum
      }
    };
  }

  static async createSession(userId, rawConfig) {
    const validation = this.validateConfiguration(rawConfig);
    if (!validation.isValid) {
      throw { status: 400, message: validation.errors.join('; ') };
    }

    const { targetRole, interviewType, difficulty, interviewMode, questionCount, durationMinutes } = validation.sanitized;

    const session = await InterviewSessionModel.create({
      userId,
      targetRole,
      interviewType,
      difficulty,
      interviewMode,
      questionCount,
      durationMinutes,
      status: 'ready'
    });

    return session;
  }

  static async getSession(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    return session;
  }

  static async listSessions(userId) {
    return await InterviewSessionModel.findByUserId(userId);
  }

  static async transitionState(userId, sessionId, targetStatus) {
    const session = await this.getSession(userId, sessionId);
    const currentStatus = session.status;

    if (currentStatus === targetStatus) {
      return session; // Idempotent
    }

    const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!validNextStates.includes(targetStatus)) {
      throw {
        status: 400,
        message: `Cannot transition session from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${validNextStates.join(', ') || 'none (terminal state)'}`
      };
    }

    const extraFields = {};
    if (targetStatus === 'in_progress' && !session.started_at) {
      extraFields.started_at = new Date();
    }
    if (targetStatus === 'completed' && !session.completed_at) {
      extraFields.completed_at = new Date();
    }

    const updated = await InterviewSessionModel.updateStatus(sessionId, targetStatus, extraFields);
    return updated;
  }

  static async startSession(userId, sessionId) {
    return await this.transitionState(userId, sessionId, 'in_progress');
  }

  static async cancelSession(userId, sessionId) {
    return await this.transitionState(userId, sessionId, 'cancelled');
  }

  static async pauseSession(userId, sessionId) {
    return await this.transitionState(userId, sessionId, 'paused');
  }

  static async completeSession(userId, sessionId) {
    return await this.transitionState(userId, sessionId, 'completed');
  }

  static async getStats(userId) {
    const stats = await InterviewSessionModel.getStatsByUserId(userId);
    const sessions = await InterviewSessionModel.findByUserId(userId);
    const latest = sessions.length > 0 ? sessions[0] : null;

    return {
      total: parseInt(stats.total_interviews, 10) || 0,
      completed: parseInt(stats.completed_interviews, 10) || 0,
      inProgress: parseInt(stats.in_progress_interviews, 10) || 0,
      ready: parseInt(stats.ready_interviews, 10) || 0,
      cancelled: parseInt(stats.cancelled_interviews, 10) || 0,
      latestSession: latest
    };
  }
}

module.exports = InterviewSessionService;
