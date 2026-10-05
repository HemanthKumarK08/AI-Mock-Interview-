const InterviewSessionModel = require('../models/interviewSessionModel');
const InterviewConversationModel = require('../models/interviewConversationModel');
const AnswerEvaluationModel = require('../models/answerEvaluationModel');
const aiProvider = require('./ai/aiProvider');
const AnswerUnderstandingService = require('./conversation/answerUnderstandingService');
const ConversationMemoryService = require('./conversation/conversationMemoryService');
const QuestionStrategyEngine = require('./conversation/questionStrategyEngine');

class ConversationEngine {
  static async startInterview(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    if (session.status === 'completed') {
      throw { status: 400, message: 'This interview session is already completed' };
    }

    if (session.status === 'cancelled') {
      throw { status: 400, message: 'This interview session has been cancelled' };
    }

    // If ready or paused, transition to in_progress
    if (session.status === 'ready' || session.status === 'paused') {
      await InterviewSessionModel.updateStatus(sessionId, 'in_progress', {
        ...(session.status === 'ready' ? { started_at: new Date() } : {})
      });
      session.status = 'in_progress';
    }

    // Check if turn 1 already exists (e.g. from page reload or resume)
    const existingUnanswered = await InterviewConversationModel.findCurrentUnansweredTurn(sessionId);
    if (existingUnanswered) {
      return {
        session,
        currentTurn: existingUnanswered,
        resumed: true
      };
    }

    const allTurns = await InterviewConversationModel.findBySessionId(sessionId);
    if (allTurns.length > 0) {
      const latest = allTurns[allTurns.length - 1];
      if (allTurns.length >= session.question_count && latest.student_answer) {
        await InterviewSessionModel.updateStatus(sessionId, 'completed', { completed_at: new Date() });
        return {
          session: { ...session, status: 'completed' },
          completed: true,
          message: 'Interview completed'
        };
      }
    }

    // Initialize Memory for Turn 1
    const memory = ConversationMemoryService.createInitialMemory(session.target_role, session.interview_type);

    // Generate First Question (Opening / Project Seed)
    const context = {
      targetRole: session.target_role,
      interviewType: session.interview_type,
      difficulty: session.difficulty,
      questionCount: session.question_count,
      turnNumber: 1,
      conversationHistory: [],
      memory,
      strategy: { intent: 'OPENING', targetTopic: 'Project Overview' }
    };

    const aiResult = await aiProvider.generateInterviewTurn(context);

    const firstTurn = await InterviewConversationModel.createTurn({
      sessionId: session.id,
      turnNumber: 1,
      question: aiResult.question,
      questionType: aiResult.questionType || 'technical',
      questionTopic: aiResult.topic || 'General',
      difficulty: aiResult.difficulty || session.difficulty,
      aiResponseMetadata: {
        ...(aiResult.metadata || {}),
        intent: aiResult.intent || 'OPENING',
        topic: aiResult.topic || 'General'
      }
    });

    await InterviewSessionModel.updateStatus(sessionId, 'in_progress', {
      current_question_number: 1
    });

    return {
      session,
      currentTurn: firstTurn,
      resumed: false
    };
  }

  static async submitAnswer(userId, sessionId, rawAnswer) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    if (session.status !== 'in_progress') {
      throw { status: 400, message: `Cannot submit answer to interview with status '${session.status}'` };
    }

    // Validate student answer
    if (!rawAnswer || typeof rawAnswer !== 'string' || rawAnswer.trim().length === 0) {
      throw { status: 400, message: 'Student answer cannot be empty' };
    }

    const studentAnswer = rawAnswer.trim();
    if (studentAnswer.length > 5000) {
      throw { status: 400, message: 'Answer exceeds maximum allowed length of 5000 characters' };
    }

    // Find current active unanswered turn
    const activeTurn = await InterviewConversationModel.findCurrentUnansweredTurn(sessionId);
    if (!activeTurn) {
      // Check if already completed
      const allTurns = await InterviewConversationModel.findBySessionId(sessionId);
      if (allTurns.length >= session.question_count) {
        await InterviewSessionModel.updateStatus(sessionId, 'completed', { completed_at: new Date() });
        return {
          completed: true,
          sessionId: session.id,
          message: 'Interview completed successfully'
        };
      }
      throw { status: 400, message: 'No active question waiting for an answer' };
    }

    // Save answer atomically (idempotent duplicate submission protection)
    const saved = await InterviewConversationModel.saveAnswer(sessionId, activeTurn.turn_number, studentAnswer);
    if (!saved) {
      console.warn(`[ConversationEngine] Turn #${activeTurn.turn_number} already answered concurrently`);
      throw { status: 400, message: `Turn #${activeTurn.turn_number} has already been answered` };
    }

    const updatedTurn = {
      ...activeTurn,
      student_answer: studentAnswer,
      answered_at: new Date()
    };

    const conversationHistory = await InterviewConversationModel.findBySessionId(sessionId);

    const turnId = `LIVE-TURN-${activeTurn.turn_number}`;
    console.log(`\n================ LIVE CONVERSATION TRACE [${turnId}] ================`);
    console.log(`[${turnId}] CURRENT QUESTION: "${activeTurn.question}" (Topic: ${activeTurn.question_topic || 'General'})`);
    console.log(`[${turnId}] RAW CANDIDATE ANSWER: "${studentAnswer}"`);

    // 1. Answer Understanding (Phase 8 Extractor & Intent Classifier)
    const latestInsight = AnswerUnderstandingService.analyzeAnswer({
      studentAnswer,
      question: activeTurn.question,
      questionTopic: activeTurn.question_topic,
      turnNumber: activeTurn.turn_number,
      conversationHistory
    });
    console.log(`[${turnId}] ANSWER UNDERSTANDING: Intent=${latestInsight.intent}, isUncertain=${latestInsight.isUncertain}, Tech=[${(latestInsight.technologies || []).join(', ')}]`);

    // 2. AI / Fallback Answer Evaluation (Intent-Aware & Evidence-Based)
    const AnswerEvaluationService = require('./answerEvaluationService');
    let evaluation = null;
    try {
      evaluation = await AnswerEvaluationService.evaluateTurn({
        ...updatedTurn,
        answerUnderstanding: latestInsight
      }, session, conversationHistory);
    } catch (evalErr) {
      console.warn(`[ConversationEngine] Evaluation failed: ${evalErr.message}`);
      const EvaluationFallbackProvider = require('./ai/evaluationFallbackProvider');
      evaluation = EvaluationFallbackProvider.evaluateAnswer({
        targetRole: session.target_role,
        interviewType: session.interview_type,
        difficulty: session.difficulty,
        question: activeTurn.question,
        questionType: activeTurn.question_type,
        topic: activeTurn.question_topic,
        studentAnswer,
        answerUnderstanding: latestInsight
      });
    }
    console.log(`[${turnId}] ANSWER EVALUATION: TechAcc=${evaluation?.technicalAccuracy}, Relevance=${evaluation?.relevance}, Completeness=${evaluation?.completeness}`);

    // 3. Conversation Memory (Phase 8 Cross-Turn Context)
    const priorEvaluations = await AnswerEvaluationModel.findBySessionId ? await AnswerEvaluationModel.findBySessionId(sessionId) : [];
    const memory = ConversationMemoryService.buildMemoryFromHistory(
      session.target_role,
      session.interview_type,
      conversationHistory,
      priorEvaluations
    );
    console.log(`[${turnId}] ACTIVE STORY THREAD: ${memory.activeStoryThread?.topic || memory.activeTopic || 'None'}`);

    // 4. Question Strategy Decision (Phase 8 Strategy Engine)
    const strategy = QuestionStrategyEngine.determineStrategy({
      targetRole: session.target_role,
      interviewType: session.interview_type,
      memory,
      latestInsight,
      evaluation,
      turnNumber: activeTurn.turn_number + 1,
      maxQuestions: session.question_count
    });
    console.log(`[${turnId}] QUESTION STRATEGY: Intent=${strategy.intent}, TargetTopic=${strategy.targetTopic}`);

    // 5. Human Interviewer Reasoning & Curiosity Engine (Phase 9)
    const InterviewerReasoningEngine = require('./conversation/interviewerReasoningEngine');
    const QuestionQualityService = require('./conversation/questionQualityService');
    const ContextualFallbackGenerator = require('./conversation/contextualFallbackGenerator');

    let activeMeta = {};
    if (activeTurn.ai_response_metadata) {
      try {
        activeMeta = typeof activeTurn.ai_response_metadata === 'string'
          ? JSON.parse(activeTurn.ai_response_metadata)
          : activeTurn.ai_response_metadata;
      } catch (_) {}
    }

    const reasoningPlan = InterviewerReasoningEngine.determineCuriosityPlan({
      currentAnswer: studentAnswer,
      answerUnderstanding: latestInsight,
      answerEvaluation: evaluation,
      conversationMemory: memory,
      currentQuestion: activeTurn.question,
      currentQuestionIntent: activeMeta.intent || 'OPENING',
      topicState: {
        activeTopic: memory.activeTopic || activeTurn.question_topic || 'General',
        depth: memory.depthByTopic?.[memory.activeTopic || activeTurn.question_topic] || 1
      },
      candidateProfile: { role: session.target_role, difficulty: session.difficulty },
      interviewType: session.interview_type,
      targetRole: session.target_role,
      difficulty: session.difficulty,
      remainingQuestionBudget: session.question_count - activeTurn.turn_number
    });
    console.log(`[${turnId}] INTERVIEWER REASONING: PreferredStrategy=${reasoningPlan.preferredStrategy}, TargetTopic=${reasoningPlan.targetTopic}`);

    // Check completion conditions:
    // Configured question count reached
    const shouldComplete = activeTurn.turn_number >= session.question_count;

    if (shouldComplete) {
      await InterviewSessionModel.updateStatus(sessionId, 'completed', {
        completed_at: new Date(),
        current_question_number: conversationHistory.length
      });

      console.log(`[${turnId}] INTERVIEW COMPLETED`);
      console.log(`==========================================================\n`);

      return {
        completed: true,
        sessionId: session.id,
        turnNumber: activeTurn.turn_number,
        evaluation,
        memory,
        reasoningPlan,
        message: 'Interview completed successfully'
      };
    }

    // Generate Next Context-Aware Question
    const nextTurnNumber = activeTurn.turn_number + 1;
    const isFollowUp = reasoningPlan.preferredStrategy !== 'TRANSITION' &&
                       reasoningPlan.preferredStrategy !== 'NEW_TOPIC' &&
                       strategy.intent !== 'TRANSITION' &&
                       strategy.intent !== 'NEW_TOPIC';

    const context = {
      targetRole: session.target_role,
      interviewType: session.interview_type,
      difficulty: session.difficulty,
      questionCount: session.question_count,
      turnNumber: nextTurnNumber,
      isFollowUp,
      conversationHistory,
      memory,
      strategy,
      reasoningPlan,
      latestInsight,
      evaluation
    };

    console.log(`[${turnId}] SELECTED TARGET TOPIC: ${reasoningPlan.targetTopic || strategy.targetTopic}`);

    let nextAiResult = await aiProvider.generateInterviewTurn(context);
    const askedQuestions = conversationHistory.map(t => t.question).filter(Boolean);

    console.log(`[${turnId}] RAW GENERATED QUESTION: "${nextAiResult.question}"`);

    // Question Quality Gate (Phase 9)
    let quality = QuestionQualityService.validateQuestion({
      question: nextAiResult.question,
      previousAnswer: studentAnswer,
      askedQuestions,
      reasoningPlan,
      answerUnderstanding: latestInsight
    });
    console.log(`[${turnId}] QUESTION QUALITY RESULT: Valid=${quality.isValid}, Score=${quality.score}`);

    let questionText = quality.sanitizedQuestion;

    if (!quality.isValid) {
      console.warn(`[${turnId}] Question failed quality gate (${quality.issues.join(', ')}). Using contextual fallback.`);
      const fallbackTurn = ContextualFallbackGenerator.generateTurn(context);
      questionText = QuestionQualityService.sanitizeQuestionText(fallbackTurn.question);
      nextAiResult = {
        ...nextAiResult,
        ...fallbackTurn,
        question: questionText
      };
    }

    console.log(`[${turnId}] FINAL QUESTION: "${questionText}"`);
    console.log(`==========================================================\n`);

    const questionType = isFollowUp ? 'follow_up' : (nextAiResult.questionType || 'technical');

    const nextTurn = await InterviewConversationModel.createTurn({
      sessionId: session.id,
      turnNumber: nextTurnNumber,
      question: questionText,
      questionType: questionType,
      questionTopic: nextAiResult.topic || reasoningPlan.targetTopic || strategy.targetTopic || activeTurn.question_topic || 'General',
      difficulty: nextAiResult.difficulty || session.difficulty,
      aiResponseMetadata: {
        ...(nextAiResult.metadata || {}),
        intent: reasoningPlan.preferredStrategy || strategy.intent || nextAiResult.intent || 'FOLLOW_STORY',
        topic: nextAiResult.topic || reasoningPlan.targetTopic || strategy.targetTopic,
        subtopic: nextAiResult.subtopic || reasoningPlan.targetSubtopic || strategy.subtopic,
        candidateRef: nextAiResult.candidateRef || reasoningPlan.curiosityTarget?.candidateReference || strategy.candidateRef,
        conversationalGoal: reasoningPlan.conversationalGoal || nextAiResult.conversationalGoal || 'understand_candidate_reasoning',
        curiosityScore: reasoningPlan.curiosityTarget?.curiosityScore || null,
        reasoning: reasoningPlan.reason || null,
        storyThreadId: reasoningPlan.curiosityTarget?.storyThreadId || null,
        isFollowUp,
        strategy,
        reasoningPlan
      }
    });

    await InterviewSessionModel.updateStatus(sessionId, 'in_progress', {
      current_question_number: nextTurnNumber
    });

    return {
      completed: false,
      sessionId: session.id,
      evaluation,
      memory,
      strategy,
      previousTurn: {
        id: activeTurn.id,
        turnNumber: activeTurn.turn_number,
        studentAnswer
      },
      nextQuestion: {
        id: nextTurn.id,
        turnNumber: nextTurn.turn_number,
        question: nextTurn.question,
        questionType: nextTurn.question_type,
        topic: nextTurn.question_topic,
        difficulty: nextTurn.difficulty,
        intent: strategy.intent
      },
      currentTurn: nextTurn
    };
  }

  static async getCurrentState(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    const currentTurn = await InterviewConversationModel.findCurrentUnansweredTurn(sessionId);
    const history = await InterviewConversationModel.findBySessionId(sessionId);

    return {
      session,
      currentTurn: currentTurn || (history.length > 0 ? history[history.length - 1] : null),
      questionNumber: currentTurn ? currentTurn.turn_number : (history.length || 0),
      questionCount: session.question_count,
      isCompleted: session.status === 'completed',
      status: session.status
    };
  }

  static async getConversation(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview session' };
    }

    const turns = await InterviewConversationModel.findBySessionId(sessionId);

    // Clean presentation without revealing internal secrets
    const formatted = turns.map(t => ({
      turnNumber: t.turn_number,
      question: t.question,
      questionType: t.question_type,
      topic: t.question_topic,
      difficulty: t.difficulty,
      studentAnswer: t.student_answer,
      createdAt: t.created_at,
      answeredAt: t.answered_at
    }));

    return {
      sessionId: session.id,
      status: session.status,
      conversation: formatted
    };
  }
}

module.exports = ConversationEngine;
