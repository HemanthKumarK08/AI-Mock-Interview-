// Conversation Memory Service for MockInterviewAI (Phase 8 & 9)
// Maintains structured, persistent cross-turn memory, story threads, and candidate profile state

const StoryThreadService = require('./storyThreadService');

class ConversationMemoryService {
  /**
   * Initializes a fresh conversation memory object
   */
  static createInitialMemory(targetRole, interviewType) {
    return {
      currentTopic: null,
      activeTopic: null,
      discussedTopics: [],
      candidateClaims: [],
      candidateTechnologies: [],
      candidateProjects: [],
      candidateChallenges: [],
      candidateDecisions: [],
      candidateAchievements: [],
      candidateWeakAreas: [],
      candidateStrongAreas: [],
      unexploredDetails: [],
      clarificationNeeded: [],
      contradictions: [],
      storyThreads: [],
      followUpHistory: [],
      questionHistory: [],
      answeredTopics: [],
      depthByTopic: {},
      lastAnswerSummary: null,
      lastQuestionIntent: null,
      conversationSummary: `Candidate is interviewing for ${targetRole} (${interviewType} interview).`
    };
  }

  /**
   * Updates conversation memory from a completed turn, evaluation, and answer insight
   */
  static updateMemory(memory, { turn, evaluation, insight, questionMetadata = {} }) {
    if (!memory) {
      memory = this.createInitialMemory('General', 'technical');
    }

    const updated = { ...memory };
    if (!updated.storyThreads) {
      updated.storyThreads = [];
    }

    // 1. Ingest Technologies & Entities
    if (insight && insight.technologies) {
      insight.technologies.forEach(tech => {
        if (!updated.candidateTechnologies.includes(tech)) {
          updated.candidateTechnologies.push(tech);
          // Add to unexplored details if not active topic
          if (!updated.discussedTopics.includes(tech)) {
            updated.unexploredDetails.push({ topic: tech, sourceTurn: turn.turn_number });
          }
        }
      });
    }

    // 2. Ingest Projects
    if (insight && insight.projects) {
      insight.projects.forEach(proj => {
        if (!updated.candidateProjects.includes(proj)) {
          updated.candidateProjects.push(proj);
          updated.unexploredDetails.push({ topic: proj, type: 'PROJECT', sourceTurn: turn.turn_number });
        }
      });
    }

    // 3. Ingest Decisions & Challenges & Claims & Achievements
    if (insight && insight.decisions) {
      insight.decisions.forEach(d => {
        updated.candidateDecisions.push({ ...d, turnNumber: turn.turn_number });
      });
    }

    if (insight && insight.challenges) {
      insight.challenges.forEach(ch => {
        updated.candidateChallenges.push({ challenge: ch, turnNumber: turn.turn_number });
        updated.unexploredDetails.push({ topic: ch, type: 'CHALLENGE', sourceTurn: turn.turn_number });
      });
    }

    if (insight && insight.claims) {
      insight.claims.forEach(cl => {
        updated.candidateClaims.push({ claim: cl, turnNumber: turn.turn_number });
      });
    }

    if (insight && insight.results) {
      insight.results.forEach(res => {
        updated.candidateAchievements.push({ result: res, turnNumber: turn.turn_number });
      });
    }

    // 4. Ingest Clarifications Needed
    if (insight && insight.unclearPoints && insight.unclearPoints.length > 0) {
      insight.unclearPoints.forEach(up => {
        updated.clarificationNeeded.push({ point: up, turnNumber: turn.turn_number });
      });
    }

    // 5. Detect Contradictions (e.g. MongoDB vs MySQL for same project/storage)
    const allTech = updated.candidateTechnologies;
    const hasMongo = allTech.some(t => /mongo/i.test(t));
    const hasMySQL = allTech.some(t => /mysql/i.test(t));
    const hasPostgres = allTech.some(t => /postgres/i.test(t));

    if (hasMongo && (hasMySQL || hasPostgres)) {
      const alreadyNoted = updated.contradictions.some(c => c.topic === 'Database Stack');
      if (!alreadyNoted && turn.turn_number > 2) {
        updated.contradictions.push({
          topic: 'Database Stack',
          detail: 'Candidate mentioned both NoSQL (MongoDB) and Relational (MySQL/PostgreSQL) database architectures.',
          turnNumber: turn.turn_number
        });
      }
    }

    // 6. Track Topics and Topic Depth
    const turnTopic = turn.question_topic || questionMetadata.topic || 'General';
    updated.currentTopic = turnTopic;
    updated.activeTopic = turnTopic;

    if (!updated.discussedTopics.includes(turnTopic)) {
      updated.discussedTopics.push(turnTopic);
    }

    updated.depthByTopic[turnTopic] = (updated.depthByTopic[turnTopic] || 0) + 1;

    // 7. Track Strong / Weak Areas based on evaluation
    if (evaluation) {
      const avgScore = (
        (evaluation.technicalAccuracy || 5) +
        (evaluation.relevance || 5) +
        (evaluation.completeness || 5)
      ) / 3;

      if (avgScore >= 7.5 && !updated.candidateStrongAreas.includes(turnTopic)) {
        updated.candidateStrongAreas.push(turnTopic);
      } else if (avgScore < 5.0 && !updated.candidateWeakAreas.includes(turnTopic)) {
        updated.candidateWeakAreas.push(turnTopic);
      }
    }

    // 8. Record Question History
    updated.questionHistory.push({
      turnNumber: turn.turn_number,
      question: turn.question,
      topic: turnTopic,
      intent: questionMetadata.intent || (turn.question_type === 'follow_up' ? 'DEEP_DIVE' : 'CONCEPTUAL')
    });

    updated.lastAnswerSummary = insight?.summary || (turn.student_answer ? String(turn.student_answer).slice(0, 100) : null);
    updated.lastQuestionIntent = questionMetadata.intent || null;

    // 9. Update Story Threads (Phase 9)
    updated.storyThreads = StoryThreadService.updateThreads(
      updated.storyThreads,
      insight || {},
      turnTopic,
      turn.turn_number
    );

    // 10. Update Rolling Summary
    if (insight?.summary) {
      updated.conversationSummary += ` Turn ${turn.turn_number} (${turnTopic}): ${insight.summary}`;
    }

    return updated;
  }

  /**
   * Builds memory context from full conversation history stored in database
   */
  static buildMemoryFromHistory(targetRole, interviewType, turns = [], evaluations = []) {
    let memory = this.createInitialMemory(targetRole, interviewType);
    const AnswerUnderstandingService = require('./answerUnderstandingService');

    turns.forEach((turn, idx) => {
      if (turn.student_answer) {
        const insight = AnswerUnderstandingService.analyzeAnswer({
          studentAnswer: turn.student_answer,
          question: turn.question,
          questionTopic: turn.question_topic,
          turnNumber: turn.turn_number
        });

        const evalRecord = evaluations.find(e => e.conversation_id === turn.id) || null;
        let meta = {};
        if (turn.ai_response_metadata) {
          try {
            meta = typeof turn.ai_response_metadata === 'string'
              ? JSON.parse(turn.ai_response_metadata)
              : turn.ai_response_metadata;
          } catch (_) {}
        }

        memory = this.updateMemory(memory, {
          turn,
          evaluation: evalRecord,
          insight,
          questionMetadata: meta
        });
      }
    });

    return memory;
  }
}

module.exports = ConversationMemoryService;
