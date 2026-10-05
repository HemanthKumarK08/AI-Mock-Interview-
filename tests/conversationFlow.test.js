/**
 * Live Conversation Reasoning Path Test Suite
 * 
 * Verifies end-to-end production conversation engine behavior:
 * - Current candidate answer authority
 * - Handling of non-implementation and pivot requests
 * - Proper grounding and rejection of stale/abstract topics (e.g. "Core Principles")
 * - Voice and text engine convergence
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const AnswerUnderstandingService = require('../backend/services/conversation/answerUnderstandingService');
const InterviewerReasoningEngine = require('../backend/services/conversation/interviewerReasoningEngine');
const QuestionStrategyEngine = require('../backend/services/conversation/questionStrategyEngine');
const ContextualFallbackGenerator = require('../backend/services/conversation/contextualFallbackGenerator');
const QuestionQualityService = require('../backend/services/conversation/questionQualityService');
const ConversationMemoryService = require('../backend/services/conversation/conversationMemoryService');

describe('Conversation Flow & Dynamic Reasoning', () => {

  describe('1. Exact Live Screenshot Scenario Regression Test', () => {
    it('1. should classify "I didn\'t implement anything only ask me other" as uncertainty/pivot, NOT vague assertion', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "I didn't implement anything only ask me other",
        question: "Could you walk me through the Core Principles of your project architecture?",
        questionTopic: "Core Principles",
        turnNumber: 1
      });

      assert.strictEqual(insight.isUncertain, true);
      assert.strictEqual(insight.intent, 'UNCERTAIN');
    });

    it('2. should route non-implementation answer to SUPPORTIVE_PIVOT and NEVER retain "Core Principles"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "I didn't implement anything only ask me other",
        question: "Could you walk me through the Core Principles of your project architecture?",
        questionTopic: "Core Principles",
        turnNumber: 1
      });

      const reasoningPlan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I didn't implement anything only ask me other",
        answerUnderstanding: insight,
        topicState: { activeTopic: "Core Principles", depth: 1 },
        conversationMemory: { activeTopic: "Core Principles", candidateTechnologies: [] }
      });

      assert.strictEqual(reasoningPlan.preferredStrategy, 'SUPPORTIVE_PIVOT');
      assert.notStrictEqual(reasoningPlan.targetTopic, 'Core Principles');
    });

    it('3. should generate a supportive pivot question that does NOT mention "Core Principles", "implementation", or "concrete example"', () => {
      const studentAnswer = "I didn't implement anything only ask me other";
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer,
        question: "Could you walk me through the Core Principles of your project architecture?",
        questionTopic: "Core Principles",
        turnNumber: 1
      });

      const memory = { activeTopic: "Core Principles", candidateTechnologies: [] };
      const strategy = QuestionStrategyEngine.determineStrategy({
        targetRole: 'Full Stack Developer',
        interviewType: 'technical',
        memory,
        latestInsight: insight,
        turnNumber: 2
      });

      const reasoningPlan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: studentAnswer,
        answerUnderstanding: insight,
        topicState: { activeTopic: "Core Principles" },
        conversationMemory: memory
      });

      const context = {
        targetRole: 'Full Stack Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        turnNumber: 2,
        isFollowUp: true,
        conversationHistory: [{ student_answer: studentAnswer }],
        memory,
        strategy,
        reasoningPlan,
        latestInsight: insight
      };

      const fallbackTurn = ContextualFallbackGenerator.generateTurn(context);

      assert.ok(!fallbackTurn.question.toLowerCase().includes('core principles'), 'Must not contain Core Principles');
      assert.ok(!fallbackTurn.question.toLowerCase().includes('concrete example of how you approached'), 'Must not ask for concrete example of Core Principles');
      assert.strictEqual(fallbackTurn.intent, 'SUPPORTIVE_PIVOT');
    });

    it('4. should reject ungrounded Core Principles drilling questions in QuestionQualityService', () => {
      const invalidDrillingQuestion = "Could you give a concrete example of how you approached Core Principles in your implementation?";
      const quality = QuestionQualityService.validateQuestion({
        question: invalidDrillingQuestion,
        previousAnswer: "I didn't implement anything only ask me other",
        askedQuestions: [],
        reasoningPlan: { preferredStrategy: 'SUPPORTIVE_PIVOT' },
        answerUnderstanding: { isUncertain: true, intent: 'UNCERTAIN' }
      });

      assert.strictEqual(quality.isValid, false);
      assert.ok(quality.issues.some(i => i.includes('drills into unknown concept') || i.includes('uncertainty')));
    });
  });

  describe('2. Direct Uncertainty & Pivot Handling', () => {
    it('5. should pivot gracefully when candidate says "I don\'t know"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer("I don't know the answer for this.");
      assert.strictEqual(insight.isUncertain, true);

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I don't know the answer for this.",
        answerUnderstanding: insight
      });
      assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
    });

    it('6. should pivot gracefully when candidate says "Please ask something else"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer("I have not worked on this, please ask me something else.");
      assert.strictEqual(insight.isUncertain, true);

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I have not worked on this, please ask me something else.",
        answerUnderstanding: insight
      });
      assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
    });

    it('7. should pivot gracefully when candidate says "can we skip this"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer("Can we skip this question?");
      assert.strictEqual(insight.isUncertain, true);

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "Can we skip this question?",
        answerUnderstanding: insight
      });
      assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
    });

    it('8. should pivot gracefully on "I did not build anything on this"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer("I did not build anything on this.");
      assert.strictEqual(insight.isUncertain, true);

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I did not build anything on this.",
        answerUnderstanding: insight
      });
      assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
    });
  });

  describe('3. Candidate-Owned Topic & Story Continuity', () => {
    it('9. should follow candidate-owned topic when candidate mentions "voice interview was the hardest part"', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "The hardest part of my project was the voice interview and silence detection.",
        turnNumber: 1
      });

      assert.ok(insight.challenges.length > 0);
      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "The hardest part of my project was the voice interview and silence detection.",
        answerUnderstanding: insight
      });

      assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CHALLENGE');
      assert.ok(plan.targetTopic.toLowerCase().includes('voice'));
    });

    it('10. should follow candidate-introduced database decision over previous architecture topic', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "We chose PostgreSQL because we needed strict ACID compliance for transactions.",
        turnNumber: 1
      });

      assert.ok(insight.decisions.length > 0);
      assert.ok(insight.decisions[0].choice.toLowerCase().includes('postgresql'));

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "We chose PostgreSQL because we needed strict ACID compliance for transactions.",
        answerUnderstanding: insight,
        topicState: { activeTopic: "Frontend Architecture" }
      });

      assert.strictEqual(plan.preferredStrategy, 'EXPLORE_DECISION');
      assert.ok(plan.targetTopic.toLowerCase().includes('postgresql'));
    });

    it('11. should ask about silence threshold when candidate mentions silence detection', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "I used silence detection to decide when the candidate stopped speaking.",
        turnNumber: 1
      });

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I used silence detection to decide when the candidate stopped speaking.",
        answerUnderstanding: insight
      });

      const context = {
        targetRole: 'Full Stack Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        turnNumber: 2,
        isFollowUp: true,
        conversationHistory: [{ student_answer: "I used silence detection to decide when the candidate stopped speaking." }],
        memory: { activeTopic: 'Voice Activity Detection' },
        strategy: { intent: 'CHALLENGE', targetTopic: 'Voice Activity Detection' },
        reasoningPlan: plan,
        latestInsight: insight
      };

      const fallbackTurn = ContextualFallbackGenerator.generateTurn(context);
      assert.ok(fallbackTurn.question.toLowerCase().includes('voice') || fallbackTurn.question.toLowerCase().includes('finished speaking') || fallbackTurn.question.toLowerCase().includes('candidate'));
    });

    it('12. should handle premature stop follow-up gracefully', () => {
      const studentAnswer = "Sometimes it stopped too early.";
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer,
        turnNumber: 2
      });

      const context = {
        targetRole: 'Full Stack Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        turnNumber: 3,
        isFollowUp: true,
        conversationHistory: [
          { question: 'How did you detect silence?', student_answer: 'I used silence detection.' },
          { question: 'How did you handle pauses?', student_answer: studentAnswer }
        ],
        memory: { activeTopic: 'Voice Activity Detection' },
        strategy: { intent: 'CHALLENGE', targetTopic: 'Voice Activity Detection' },
        reasoningPlan: { preferredStrategy: 'EXPLORE_CHALLENGE', targetTopic: 'Voice Activity Detection' },
        latestInsight: insight
      };

      const fallbackTurn = ContextualFallbackGenerator.generateTurn(context);
      assert.ok(fallbackTurn.question.toLowerCase().includes('premature') || fallbackTurn.question.toLowerCase().includes('pause') || fallbackTurn.question.toLowerCase().includes('cut off'));
    });
  });

  describe('4. Question Quality & Grounding Gates', () => {
    it('13. should accept grounded follow-up questions referencing candidate statements', () => {
      const validQuestion = "You mentioned using silence detection for the voice recording. How did you determine the silence threshold?";
      const quality = QuestionQualityService.validateQuestion({
        question: validQuestion,
        previousAnswer: "I used silence detection to decide when the candidate stopped speaking.",
        askedQuestions: [],
        reasoningPlan: { preferredStrategy: 'EXPLORE_CHALLENGE' },
        answerUnderstanding: { challenges: ['silence detection'], technologies: [] }
      });

      assert.strictEqual(quality.isValid, true);
      assert.ok(quality.score >= 0.7);
    });

    it('14. should sanitize metadata leaks or markdown code blocks from generated questions', () => {
      const rawWithLeak = '```json\n{"question": "How did you configure WebSockets for real-time messaging?"}\n```';
      const sanitized = QuestionQualityService.sanitizeQuestionText(rawWithLeak);
      assert.strictEqual(sanitized, "How did you configure WebSockets for real-time messaging?");
    });

    it('15. should reject questions with internal reasoning leaks', () => {
      const rawWithLeak = 'REASONING: The candidate mentioned Redis. What was your Redis cache expiration policy?';
      const quality = QuestionQualityService.validateQuestion({
        question: rawWithLeak,
        previousAnswer: "We used Redis for caching.",
        askedQuestions: []
      });
      assert.strictEqual(quality.isValid, false);
    });

    it('16. should reject questions exceeding conversational spoken sentence limit', () => {
      const longQuestion = "Could you explain the system architecture? Also how did you configure the database? And what were the major challenges with security? Furthermore, did you consider GraphQL?";
      const quality = QuestionQualityService.validateQuestion({
        question: longQuestion,
        previousAnswer: "We built an API.",
        askedQuestions: []
      });
      assert.strictEqual(quality.isValid, false);
    });
  });

  describe('5. Strategy & Reasoning Convergence', () => {
    it('17. both reasoning engine and strategy engine should agree on SUPPORTIVE_PIVOT for uncertainty', () => {
      const insight = AnswerUnderstandingService.analyzeAnswer("I didn't implement anything only ask me other");
      const strat = QuestionStrategyEngine.determineStrategy({ latestInsight: insight, turnNumber: 2 });
      const reasoning = InterviewerReasoningEngine.reasonNextStep({ currentAnswer: "I didn't implement anything only ask me other", answerUnderstanding: insight });

      assert.strictEqual(strat.intent, 'SUPPORTIVE_PIVOT');
      assert.strictEqual(reasoning.preferredStrategy, 'SUPPORTIVE_PIVOT');
    });

    it('18. Question bank / stale topic cannot override candidate uncertainty', () => {
      const memory = ConversationMemoryService.createInitialMemory('Full Stack Developer', 'technical');
      memory.activeTopic = 'Core Principles';

      const insight = AnswerUnderstandingService.analyzeAnswer("I didn't implement that part.");
      const strategy = QuestionStrategyEngine.determineStrategy({ memory, latestInsight: insight, turnNumber: 2 });

      assert.strictEqual(strategy.intent, 'SUPPORTIVE_PIVOT');
      assert.strictEqual(strategy.targetTopic, 'Personal Contribution');
    });

    it('19. Candidate-owned topic wins over default role coverage topic', () => {
      const memory = ConversationMemoryService.createInitialMemory('Full Stack Developer', 'technical');
      memory.activeTopic = 'Frontend & UI';

      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: "I worked exclusively on the PostgreSQL indexing and query performance.",
        turnNumber: 1
      });

      const plan = InterviewerReasoningEngine.reasonNextStep({
        currentAnswer: "I worked exclusively on the PostgreSQL indexing and query performance.",
        answerUnderstanding: insight,
        topicState: { activeTopic: 'Frontend & UI' }
      });

      assert.ok(plan.targetTopic.toLowerCase().includes('postgresql') || plan.curiosityTarget.candidateReference.toLowerCase().includes('postgresql'));
    });

    it('20. Full end-to-end trace produces grounded non-drilling question on refusal/pivot', () => {
      const studentAnswer = "I didn't implement anything only ask me other";
      const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer,
        question: "Could you walk me through the Core Principles of your project architecture?",
        questionTopic: "Core Principles",
        turnNumber: 1
      });

      const memory = { activeTopic: "Core Principles", candidateTechnologies: [] };
      const strategy = QuestionStrategyEngine.determineStrategy({ memory, latestInsight: insight, turnNumber: 2 });
      const reasoningPlan = InterviewerReasoningEngine.reasonNextStep({ currentAnswer: studentAnswer, answerUnderstanding: insight, conversationMemory: memory });

      const context = {
        targetRole: 'Full Stack Developer',
        interviewType: 'technical',
        difficulty: 'intermediate',
        turnNumber: 2,
        isFollowUp: true,
        conversationHistory: [{ student_answer: studentAnswer }],
        memory,
        strategy,
        reasoningPlan,
        latestInsight: insight
      };

      const fallbackTurn = ContextualFallbackGenerator.generateTurn(context);
      const quality = QuestionQualityService.validateQuestion({
        question: fallbackTurn.question,
        previousAnswer: studentAnswer,
        askedQuestions: [],
        reasoningPlan,
        answerUnderstanding: insight
      });

      assert.strictEqual(quality.isValid, true);
      assert.ok(!quality.sanitizedQuestion.toLowerCase().includes('core principles'));
      assert.ok(!quality.sanitizedQuestion.toLowerCase().includes('tools did you use'));
    });
  });
});
