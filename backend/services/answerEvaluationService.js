const AnswerEvaluationModel = require('../models/answerEvaluationModel');
const InterviewSessionModel = require('../models/interviewSessionModel');
const InterviewConversationModel = require('../models/interviewConversationModel');
const aiProvider = require('./ai/aiProvider');

class AnswerEvaluationService {
  static async evaluateAnswer(context) {
    try {
      if (!context.answerUnderstanding) {
        const AnswerUnderstandingService = require('./conversation/answerUnderstandingService');
        context.answerUnderstanding = AnswerUnderstandingService.analyzeAnswer({
          studentAnswer: context.studentAnswer,
          question: context.question,
          questionTopic: context.topic || 'General',
          turnNumber: 1
        });
      }
      return await aiProvider.evaluateAnswer(context);
    } catch (err) {
      console.warn(`[AnswerEvaluationService] Direct evaluation failed: ${err.message}. Invoking emergency fallback.`);
      const EvaluationFallbackProvider = require('./ai/evaluationFallbackProvider');
      return EvaluationFallbackProvider.evaluateAnswer(context);
    }
  }

  static async evaluateTurn(conversationTurn, session, conversationHistory = []) {
    if (!conversationTurn || !conversationTurn.student_answer) {
      throw { status: 400, message: 'Cannot evaluate turn without a student answer' };
    }

    const AnswerUnderstandingService = require('./conversation/answerUnderstandingService');
    const answerUnderstanding = AnswerUnderstandingService.analyzeAnswer({
      studentAnswer: conversationTurn.student_answer,
      question: conversationTurn.question,
      questionTopic: conversationTurn.question_topic || 'General',
      turnNumber: conversationTurn.turn_number,
      conversationHistory
    });

    const context = {
      targetRole: session.target_role,
      interviewType: session.interview_type,
      difficulty: session.difficulty,
      question: conversationTurn.question,
      questionType: conversationTurn.question_type || 'technical',
      topic: conversationTurn.question_topic || 'General',
      studentAnswer: conversationTurn.student_answer,
      answerUnderstanding,
      conversationHistory: conversationHistory.map(t => ({
        turnNumber: t.turn_number,
        question: t.question,
        studentAnswer: t.student_answer
      }))
    };

    let evaluationResult;
    try {
      evaluationResult = await aiProvider.evaluateAnswer(context);
    } catch (err) {
      console.warn(`[AnswerEvaluationService] Direct evaluation failed: ${err.message}. Invoking emergency fallback.`);
      const EvaluationFallbackProvider = require('./ai/evaluationFallbackProvider');
      evaluationResult = EvaluationFallbackProvider.evaluateAnswer(context);
    }

    // Persist evaluation
    const persisted = await AnswerEvaluationModel.create({
      conversationId: conversationTurn.id,
      technicalAccuracy: evaluationResult.technicalAccuracy,
      relevance: evaluationResult.relevance,
      completeness: evaluationResult.completeness,
      clarity: evaluationResult.clarity,
      communication: evaluationResult.communication,
      strengths: evaluationResult.strengths,
      weaknesses: evaluationResult.weaknesses,
      improvementSuggestion: evaluationResult.improvementSuggestion,
      evaluationConfidence: evaluationResult.evaluationConfidence,
      star: evaluationResult.star,
      starCompleteness: evaluationResult.starCompleteness,
      evaluationSource: evaluationResult.evaluationSource || 'gemini',
      evaluationMetadata: evaluationResult.metadata || {}
    });

    return persisted;
  }

  static determineAdaptiveAction(evaluation, currentTurn, allPriorTurns = [], configuredQuestionCount = 10) {
    // 1. Check if current turn is already a follow-up
    const isCurrentFollowUp = currentTurn.question_type === 'follow_up' ||
      (currentTurn.ai_response_metadata && currentTurn.ai_response_metadata.isFollowUp === true);

    // Hard limit: count primary questions answered
    const primaryTurns = allPriorTurns.filter(t => t.question_type !== 'follow_up');
    const primaryCount = primaryTurns.length;

    if (primaryCount >= configuredQuestionCount && !isCurrentFollowUp) {
      return {
        action: 'complete',
        reason: 'Target primary question count reached.',
        priority: 'high'
      };
    }

    // If current was a follow-up, do not allow chain follow-ups
    if (isCurrentFollowUp) {
      return {
        action: 'continue',
        reason: 'Follow-up completed, transitioning to next primary question.',
        priority: 'normal'
      };
    }

    // 2. Check for partial understanding triggering follow-up
    const isPartialTechnical = evaluation.technicalAccuracy !== null && evaluation.technicalAccuracy >= 2.0 && evaluation.technicalAccuracy < 6.5;
    const isLowCompleteness = evaluation.completeness >= 2.0 && evaluation.completeness < 5.5;
    const isMissingBehavioralResult = evaluation.star && evaluation.star.result === false && evaluation.star.situation === true;

    if (isPartialTechnical || isLowCompleteness || isMissingBehavioralResult) {
      return {
        action: 'follow_up',
        reason: 'Candidate provided a partial answer that benefits from clarifying follow-up.',
        priority: 'high'
      };
    }

    return {
      action: 'continue',
      reason: 'Standard topic progression.',
      priority: 'normal'
    };
  }

  static async getEvaluationsForSession(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    const evaluations = await AnswerEvaluationModel.findBySessionId(sessionId);
    return evaluations;
  }

  static async getEvaluationForConversation(userId, sessionId, conversationId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    const conv = await InterviewConversationModel.findById(conversationId);
    if (!conv || conv.session_id !== parseInt(sessionId, 10)) {
      throw { status: 404, message: 'Conversation turn not found in this interview session' };
    }

    const evaluation = await AnswerEvaluationModel.findByConversationId(conversationId);
    if (!evaluation) {
      throw { status: 404, message: 'Evaluation not found for this conversation turn' };
    }

    return evaluation;
  }
}

module.exports = AnswerEvaluationService;
