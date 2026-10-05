const InterviewSessionModel = require('../models/interviewSessionModel');
const InterviewConversationModel = require('../models/interviewConversationModel');
const AnswerEvaluationModel = require('../models/answerEvaluationModel');

class InterviewReportService {
  /**
   * Deterministic rounding to specified decimal places
   */
  static round(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(Number(val) * factor) / factor;
  }

  /**
   * Calculate average of an array of numbers, ignoring null/undefined
   */
  static average(numbers, decimals = 1) {
    const valid = numbers.filter(n => n !== null && n !== undefined && !isNaN(n)).map(Number);
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, curr) => acc + curr, 0);
    return this.round(sum / valid.length, decimals);
  }

  /**
   * Generate complete deterministic interview report DTO
   */
  static async generateReport(userId, sessionId) {
    const session = await InterviewSessionModel.findById(sessionId);
    if (!session) {
      throw { status: 404, message: 'Interview session not found' };
    }

    if (session.user_id !== userId) {
      throw { status: 403, message: 'Access denied: You do not own this interview report' };
    }

    const rawTurns = await InterviewConversationModel.findBySessionId(sessionId);
    const evaluations = await AnswerEvaluationModel.findBySessionId(sessionId);

    // Map evaluations by turn number and conversation id
    const evalByTurn = {};
    evaluations.forEach(ev => {
      evalByTurn[ev.turnNumber || ev.conversationId] = ev;
    });

    // 1. Calculate Interview Summary & Durations
    let durationSeconds = 0;
    if (session.started_at && session.completed_at) {
      durationSeconds = Math.max(0, Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 1000));
    } else if (session.started_at && session.updated_at) {
      durationSeconds = Math.max(0, Math.round((new Date(session.updated_at) - new Date(session.started_at)) / 1000));
    }

    const answeredTurns = rawTurns.filter(t => t.student_answer && t.student_answer.trim().length > 0);
    const followUpTurns = rawTurns.filter(t => t.question_type === 'follow_up');
    const primaryTurns = rawTurns.filter(t => t.question_type !== 'follow_up');

    // 2. Aggregate 5 Core Performance Dimensions
    const techAccScores = evaluations.map(e => e.technicalAccuracy).filter(v => v !== null && v !== undefined);
    const relevanceScores = evaluations.map(e => e.relevance).filter(v => v !== null && v !== undefined);
    const completenessScores = evaluations.map(e => e.completeness).filter(v => v !== null && v !== undefined);
    const clarityScores = evaluations.map(e => e.clarity).filter(v => v !== null && v !== undefined);
    const communicationScores = evaluations.map(e => e.communication).filter(v => v !== null && v !== undefined);

    const avgTechAcc = this.average(techAccScores);
    const avgRelevance = this.average(relevanceScores);
    const avgCompleteness = this.average(completenessScores);
    const avgClarity = this.average(clarityScores);
    const avgCommunication = this.average(communicationScores);

    // 3. Overall Performance Score Calculation
    // Arithmetic mean of all available non-null dimension averages
    const validDimensionAverages = [
      avgTechAcc,
      avgRelevance,
      avgCompleteness,
      avgClarity,
      avgCommunication
    ].filter(v => v !== null);

    const overallScore = validDimensionAverages.length > 0 ? this.average(validDimensionAverages, 1) : null;

    // 4. Performance Response Categories
    let strongResponses = 0;
    let needsImprovementResponses = 0;
    let averageResponses = 0;

    evaluations.forEach(ev => {
      const turnScores = [
        ev.technicalAccuracy,
        ev.relevance,
        ev.completeness,
        ev.clarity,
        ev.communication
      ].filter(v => v !== null && v !== undefined);

      const turnAvg = this.average(turnScores);
      if (turnAvg !== null) {
        if (turnAvg >= 7.5) strongResponses++;
        else if (turnAvg < 6.0) needsImprovementResponses++;
        else averageResponses++;
      }
    });

    // 5. Aggregate Strengths & Deduplicate
    const strengthsCountMap = {};
    evaluations.forEach(ev => {
      if (Array.isArray(ev.strengths)) {
        ev.strengths.forEach(s => {
          if (typeof s === 'string' && s.trim().length > 0) {
            const clean = s.trim();
            const lower = clean.toLowerCase();
            if (!strengthsCountMap[lower]) {
              strengthsCountMap[lower] = { text: clean, count: 0 };
            }
            strengthsCountMap[lower].count++;
          }
        });
      }
    });

    const topStrengths = Object.values(strengthsCountMap)
      .sort((a, b) => b.count - a.count)
      .map(item => item.text);

    // 6. Aggregate Weaknesses / Improvement Areas
    const weaknessesCountMap = {};
    evaluations.forEach(ev => {
      if (Array.isArray(ev.weaknesses)) {
        ev.weaknesses.forEach(w => {
          if (typeof w === 'string' && w.trim().length > 0) {
            const clean = w.trim();
            const lower = clean.toLowerCase();
            if (!weaknessesCountMap[lower]) {
              weaknessesCountMap[lower] = { text: clean, count: 0 };
            }
            weaknessesCountMap[lower].count++;
          }
        });
      }
      if (ev.improvementSuggestion && typeof ev.improvementSuggestion === 'string' && ev.improvementSuggestion.trim().length > 0) {
        const clean = ev.improvementSuggestion.trim();
        const lower = clean.toLowerCase();
        if (!weaknessesCountMap[lower]) {
          weaknessesCountMap[lower] = { text: clean, count: 0 };
        }
        weaknessesCountMap[lower].count++;
      }
    });

    const topImprovementAreas = Object.values(weaknessesCountMap)
      .sort((a, b) => b.count - a.count)
      .map(item => item.text);

    // 7. Question-by-Question Breakdown
    const questionsBreakdown = rawTurns.map((turn, index) => {
      const turnNumber = turn.turn_number || (index + 1);
      const ev = evalByTurn[turnNumber] || evalByTurn[turn.id] || null;

      let turnOverallScore = null;
      if (ev) {
        const scores = [
          ev.technicalAccuracy,
          ev.relevance,
          ev.completeness,
          ev.clarity,
          ev.communication
        ].filter(v => v !== null && v !== undefined);
        turnOverallScore = this.average(scores, 1);
      }

      let parsedTranscriptionMeta = null;
      if (turn.transcription_metadata) {
        try {
          parsedTranscriptionMeta = typeof turn.transcription_metadata === 'string'
            ? JSON.parse(turn.transcription_metadata)
            : turn.transcription_metadata;
        } catch (_) {}
      }

      return {
        id: turn.id,
        turnNumber,
        question: turn.question,
        questionType: turn.question_type || 'technical',
        topic: turn.question_topic || 'General',
        difficulty: turn.difficulty || session.difficulty,
        studentAnswer: turn.student_answer || null,
        inputMode: turn.input_mode || 'text',
        transcriptionMetadata: parsedTranscriptionMeta,
        answeredAt: turn.answered_at || null,
        createdAt: turn.created_at || null,
        evaluation: ev ? {
          id: ev.id,
          technicalAccuracy: ev.technicalAccuracy,
          relevance: ev.relevance,
          completeness: ev.completeness,
          clarity: ev.clarity,
          communication: ev.communication,
          overallTurnScore: turnOverallScore,
          strengths: ev.strengths || [],
          weaknesses: ev.weaknesses || [],
          improvementSuggestion: ev.improvementSuggestion || null,
          evaluationConfidence: ev.evaluationConfidence || 0.85,
          star: ev.star || null,
          starCompleteness: ev.starCompleteness || null,
          evaluationSource: ev.evaluationSource || 'gemini'
        } : null
      };
    });

    // 8. Follow-up Analytics
    const followUpPairs = [];
    rawTurns.forEach((turn, idx) => {
      if (turn.question_type === 'follow_up' && idx > 0) {
        const parentTurn = rawTurns[idx - 1];
        followUpPairs.push({
          followUpTurnNumber: turn.turn_number,
          followUpQuestion: turn.question,
          parentTurnNumber: parentTurn.turn_number,
          parentQuestion: parentTurn.question,
          parentTopic: parentTurn.question_topic || 'General'
        });
      }
    });

    const followUpRate = primaryTurns.length > 0
      ? this.round((followUpTurns.length / primaryTurns.length) * 100, 1)
      : 0;

    // 9. Text vs Voice Analytics
    const textAnswers = answeredTurns.filter(t => t.input_mode !== 'voice');
    const voiceAnswers = answeredTurns.filter(t => t.input_mode === 'voice');

    let totalVoiceDurationMs = 0;
    let voiceConfidenceSum = 0;
    let voiceConfidenceCount = 0;

    voiceAnswers.forEach(t => {
      if (t.transcription_metadata) {
        let meta = t.transcription_metadata;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch (_) {}
        }
        if (meta && meta.durationMs) totalVoiceDurationMs += Number(meta.durationMs);
        if (meta && meta.confidence) {
          voiceConfidenceSum += Number(meta.confidence);
          voiceConfidenceCount++;
        }
      }
    });

    const voiceStats = {
      count: voiceAnswers.length,
      averageDurationSeconds: voiceAnswers.length > 0 ? this.round((totalVoiceDurationMs / voiceAnswers.length) / 1000, 1) : null,
      averageConfidence: voiceConfidenceCount > 0 ? this.round((voiceConfidenceSum / voiceConfidenceCount) * 100, 1) : null,
      primaryLanguage: 'en-US'
    };

    // 10. Behavioral / STAR Analytics
    const starEvaluations = evaluations.filter(e => e.star !== null && e.star !== undefined);
    const hasStarData = starEvaluations.length > 0 || session.interview_type === 'behavioral' || session.interview_type === 'mixed';

    let starAnalytics = null;
    if (hasStarData) {
      const situationCount = starEvaluations.filter(e => e.star?.situation === true).length;
      const taskCount = starEvaluations.filter(e => e.star?.task === true).length;
      const actionCount = starEvaluations.filter(e => e.star?.action === true).length;
      const resultCount = starEvaluations.filter(e => e.star?.result === true).length;
      const totalStar = Math.max(1, starEvaluations.length);

      const starCompletenessScores = starEvaluations.map(e => e.starCompleteness).filter(v => v !== null && v !== undefined);

      const missingComponents = [];
      if (situationCount < starEvaluations.length) {
        missingComponents.push(`Situation was missing in ${starEvaluations.length - situationCount} response(s)`);
      }
      if (taskCount < starEvaluations.length) {
        missingComponents.push(`Task was missing in ${starEvaluations.length - taskCount} response(s)`);
      }
      if (actionCount < starEvaluations.length) {
        missingComponents.push(`Action was missing in ${starEvaluations.length - actionCount} response(s)`);
      }
      if (resultCount < starEvaluations.length) {
        missingComponents.push(`Result outcome was missing in ${starEvaluations.length - resultCount} response(s)`);
      }

      starAnalytics = {
        isApplicable: true,
        evaluatedCount: starEvaluations.length,
        situationPresentRate: starEvaluations.length > 0 ? this.round((situationCount / totalStar) * 100, 1) : 0,
        taskPresentRate: starEvaluations.length > 0 ? this.round((taskCount / totalStar) * 100, 1) : 0,
        actionPresentRate: starEvaluations.length > 0 ? this.round((actionCount / totalStar) * 100, 1) : 0,
        resultPresentRate: starEvaluations.length > 0 ? this.round((resultCount / totalStar) * 100, 1) : 0,
        averageStarCompleteness: this.average(starCompletenessScores, 1),
        missingComponentsSummary: missingComponents
      };
    } else {
      starAnalytics = {
        isApplicable: false,
        evaluatedCount: 0,
        message: 'STAR framework analysis is applicable for behavioral interview evaluations.'
      };
    }

    // 11. Topics Performance Breakdown
    const topicMap = {};
    questionsBreakdown.forEach(q => {
      const topicName = q.topic || 'General';
      if (!topicMap[topicName]) {
        topicMap[topicName] = {
          topic: topicName,
          questionCount: 0,
          scores: []
        };
      }
      topicMap[topicName].questionCount++;
      if (q.evaluation && q.evaluation.overallTurnScore !== null) {
        topicMap[topicName].scores.push(q.evaluation.overallTurnScore);
      }
    });

    const topicsAnalysis = Object.values(topicMap).map(t => ({
      topic: t.topic,
      questionCount: t.questionCount,
      evaluatedCount: t.scores.length,
      averageScore: this.average(t.scores, 1)
    })).sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));

    // Construct Final Structured Report DTO
    return {
      interview: {
        id: session.id,
        targetRole: session.target_role,
        interviewType: session.interview_type,
        difficulty: session.difficulty,
        interviewMode: session.interview_mode,
        status: session.status,
        questionCount: session.question_count,
        durationMinutes: session.duration_minutes,
        actualDurationSeconds: durationSeconds,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        createdAt: session.created_at
      },
      summary: {
        overallScore,
        maxScore: 10,
        totalQuestions: rawTurns.length,
        answeredQuestions: answeredTurns.length,
        evaluatedAnswers: evaluations.length,
        primaryQuestions: primaryTurns.length,
        followUpQuestions: followUpTurns.length,
        followUpRate,
        strongResponses,
        averageResponses,
        needsImprovementResponses,
        isCompleted: session.status === 'completed'
      },
      dimensions: {
        technicalAccuracy: {
          score: avgTechAcc,
          maxScore: 10,
          label: 'Technical Accuracy',
          applicable: avgTechAcc !== null
        },
        relevance: {
          score: avgRelevance,
          maxScore: 10,
          label: 'Relevance',
          applicable: avgRelevance !== null
        },
        completeness: {
          score: avgCompleteness,
          maxScore: 10,
          label: 'Completeness',
          applicable: avgCompleteness !== null
        },
        clarity: {
          score: avgClarity,
          maxScore: 10,
          label: 'Clarity',
          applicable: avgClarity !== null
        },
        communication: {
          score: avgCommunication,
          maxScore: 10,
          label: 'Communication',
          applicable: avgCommunication !== null
        }
      },
      strengths: topStrengths,
      improvementAreas: topImprovementAreas,
      questions: questionsBreakdown,
      followUpAnalytics: {
        primaryQuestions: primaryTurns.length,
        followUpQuestions: followUpTurns.length,
        followUpRate,
        pairs: followUpPairs
      },
      inputModes: {
        textCount: textAnswers.length,
        voiceCount: voiceAnswers.length,
        voiceStats
      },
      starAnalysis: starAnalytics,
      topics: topicsAnalysis
    };
  }

  /**
   * Candidate-level historical performance summary
   */
  static async getCandidateSummary(userId) {
    const sessions = await InterviewSessionModel.findByUserId(userId);
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (completedSessions.length === 0) {
      return {
        totalInterviews: sessions.length,
        completedInterviews: 0,
        inProgressInterviews: sessions.filter(s => s.status === 'in_progress').length,
        averageOverallScore: null,
        bestDimension: null,
        weakestDimension: null,
        latestInterview: sessions[0] ? {
          id: sessions[0].id,
          targetRole: sessions[0].target_role,
          interviewType: sessions[0].interview_type,
          difficulty: sessions[0].difficulty,
          status: sessions[0].status,
          createdAt: sessions[0].created_at
        } : null,
        roleBreakdown: [],
        message: 'Complete your first mock interview to start building your performance analytics.'
      };
    }

    // Collect reports for all completed sessions to calculate aggregate stats
    const reportPromises = completedSessions.map(s => this.generateReport(userId, s.id));
    const reports = await Promise.all(reportPromises);

    const overallScores = reports.map(r => r.summary.overallScore).filter(v => v !== null);
    const avgOverall = this.average(overallScores, 1);

    const techAccs = reports.map(r => r.dimensions.technicalAccuracy.score).filter(v => v !== null);
    const relevances = reports.map(r => r.dimensions.relevance.score).filter(v => v !== null);
    const completenesses = reports.map(r => r.dimensions.completeness.score).filter(v => v !== null);
    const clarities = reports.map(r => r.dimensions.clarity.score).filter(v => v !== null);
    const communications = reports.map(r => r.dimensions.communication.score).filter(v => v !== null);

    const dimensionAverages = [
      { name: 'Technical Accuracy', score: this.average(techAccs, 1) },
      { name: 'Relevance', score: this.average(relevances, 1) },
      { name: 'Completeness', score: this.average(completenesses, 1) },
      { name: 'Clarity', score: this.average(clarities, 1) },
      { name: 'Communication', score: this.average(communications, 1) }
    ].filter(d => d.score !== null);

    dimensionAverages.sort((a, b) => b.score - a.score);

    const bestDimension = dimensionAverages.length > 0 ? dimensionAverages[0] : null;
    const weakestDimension = dimensionAverages.length > 0 ? dimensionAverages[dimensionAverages.length - 1] : null;

    // Role breakdown
    const roleStatsMap = {};
    reports.forEach(r => {
      const role = r.interview.targetRole;
      if (!roleStatsMap[role]) {
        roleStatsMap[role] = {
          role,
          completedCount: 0,
          scores: []
        };
      }
      roleStatsMap[role].completedCount++;
      if (r.summary.overallScore !== null) {
        roleStatsMap[role].scores.push(r.summary.overallScore);
      }
    });

    const roleBreakdown = Object.values(roleStatsMap).map(item => ({
      role: item.role,
      completedCount: item.completedCount,
      averageScore: this.average(item.scores, 1)
    }));

    const latest = reports[0];

    return {
      totalInterviews: sessions.length,
      completedInterviews: completedSessions.length,
      inProgressInterviews: sessions.filter(s => s.status === 'in_progress').length,
      averageOverallScore: avgOverall,
      bestDimension,
      weakestDimension,
      latestInterview: latest ? {
        id: latest.interview.id,
        targetRole: latest.interview.targetRole,
        interviewType: latest.interview.interviewType,
        difficulty: latest.interview.difficulty,
        interviewMode: latest.interview.interviewMode,
        status: latest.interview.status,
        overallScore: latest.summary.overallScore,
        completedAt: latest.interview.completedAt,
        createdAt: latest.interview.createdAt
      } : null,
      dimensionAverages,
      roleBreakdown
    };
  }

  /**
   * Candidate completed interview performance history over time
   */
  static async getCandidateHistory(userId) {
    const sessions = await InterviewSessionModel.findByUserId(userId);
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (completedSessions.length === 0) {
      return {
        history: [],
        count: 0,
        message: 'No completed interviews recorded.'
      };
    }

    // Reports ordered by creation time ascending for chronological trend
    const sorted = [...completedSessions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const reportPromises = sorted.map(s => this.generateReport(userId, s.id));
    const reports = await Promise.all(reportPromises);

    const history = reports.map(r => ({
      sessionId: r.interview.id,
      targetRole: r.interview.targetRole,
      interviewType: r.interview.interviewType,
      difficulty: r.interview.difficulty,
      interviewMode: r.interview.interviewMode,
      overallScore: r.summary.overallScore,
      technicalAccuracy: r.dimensions.technicalAccuracy.score,
      relevance: r.dimensions.relevance.score,
      completeness: r.dimensions.completeness.score,
      clarity: r.dimensions.clarity.score,
      communication: r.dimensions.communication.score,
      questionCount: r.interview.questionCount,
      evaluatedAnswers: r.summary.evaluatedAnswers,
      followUpCount: r.summary.followUpQuestions,
      startedAt: r.interview.startedAt,
      completedAt: r.interview.completedAt,
      createdAt: r.interview.createdAt
    }));

    return {
      history,
      count: history.length
    };
  }
}

module.exports = InterviewReportService;
