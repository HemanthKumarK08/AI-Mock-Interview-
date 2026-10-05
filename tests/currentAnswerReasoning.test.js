const { describe, it } = require('node:test');
const assert = require('node:assert');

const AnswerUnderstandingService = require('../backend/services/conversation/answerUnderstandingService');
const InterviewerReasoningEngine = require('../backend/services/conversation/interviewerReasoningEngine');
const QuestionStrategyEngine = require('../backend/services/conversation/questionStrategyEngine');
const ContextualFallbackGenerator = require('../backend/services/conversation/contextualFallbackGenerator');
const QuestionQualityService = require('../backend/services/conversation/questionQualityService');
const StoryThreadService = require('../backend/services/conversation/storyThreadService');
const { buildTurnPrompt, buildSystemPrompt } = require('../backend/services/promptBuilder');

describe('Current Answer Conversational Reasoning & IntelliExam Alignment', () => {

  it('1. Current answer overrides previous topic', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "The hardest part was voice detection and silence threshold tuning.",
      "Explain your system architecture.",
      'technical'
    );
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      conversationMemory: { activeTopic: 'Architecture', depthByTopic: { Architecture: 2 } }
    });

    assert.ok(plan.targetTopic.toLowerCase().includes('voice') || plan.curiosityTarget.candidateReference.toLowerCase().includes('voice'));
    assert.notStrictEqual(plan.preferredStrategy, 'TRANSITION');
  });

  it('2. "I don\'t know" triggers uncertainty strategy', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I don't know the answer for this.",
      "How did you configure your Kubernetes ingress controller?",
      'technical'
    );
    assert.strictEqual(understanding.isUncertain, true);
    assert.strictEqual(understanding.intent, 'UNCERTAIN');

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      conversationMemory: { activeTopic: 'DevOps & Kubernetes' }
    });
    assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
  });

  it('3. "I\'m not sure" triggers uncertainty strategy', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I'm not sure about that specific algorithm.",
      "Explain Dijkstra vs A*.",
      'technical'
    );
    assert.strictEqual(understanding.isUncertain, true);

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
  });

  it('4. "I don\'t remember" triggers uncertainty strategy', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I don't remember the exact syntax for that.",
      "Write a regex for email validation.",
      'technical'
    );
    assert.strictEqual(understanding.isUncertain, true);

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
  });

  it('5. Candidate-owned new topic overrides previous topic', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "Actually, the hardest part was the voice interview because we had to detect silence.",
      "Tell me about your backend database.",
      'technical'
    );
    assert.ok(understanding.candidateOwnedTopic);
    assert.ok(understanding.candidateOwnedTopic.toLowerCase().includes('voice'));

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      conversationMemory: { activeTopic: 'Backend Database' }
    });
    assert.ok(plan.preferredStrategy === 'FOLLOW_CANDIDATE_TOPIC' || plan.preferredStrategy === 'EXPLORE_CHALLENGE');
    assert.ok(plan.targetTopic.toLowerCase().includes('voice') || plan.targetTopic.toLowerCase().includes('silence'));
  });

  it('6. Challenge answer produces challenge follow-up', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "The biggest bottleneck was API timeouts from our LLM service during high concurrency.",
      "What challenges did you face?",
      'technical'
    );
    assert.ok(understanding.challenges.length > 0);
    assert.strictEqual(understanding.intent, 'CHALLENGE');

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CHALLENGE');
  });

  it('7. Decision answer produces decision follow-up', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I chose MySQL over MongoDB because our user and session data required strict relational integrity.",
      "What database did you use?",
      'technical'
    );
    assert.strictEqual(understanding.intent, 'DECISION');
    assert.ok(understanding.decisions.length > 0);

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_DECISION');
  });

  it('8. Result answer produces result follow-up', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "After optimizing the queries, page load latency decreased by 60 percent.",
      "What was the outcome of your optimization?",
      'technical'
    );
    assert.strictEqual(understanding.intent, 'RESULT');
    assert.ok(understanding.results.length > 0);
  });

  it('9. Strong answer can deepen', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I implemented a custom RMS volume calculation loop with 1.8 second silence threshold in Web Audio API.",
      "How did you implement voice activity detection?",
      'technical'
    );
    assert.strictEqual(understanding.intent, 'TECHNICAL_DETAIL');
    assert.strictEqual(understanding.isUncertain, false);
  });

  it('10. Weak answer can simplify', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I think it connects stuff together.",
      "Explain how reverse proxies work in NGINX.",
      'technical'
    );
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      answerEvaluation: { overallScore: 3.2, technicalAccuracy: 3.0 },
      remainingQuestionBudget: 3
    });
    assert.strictEqual(plan.preferredStrategy, 'SIMPLIFY');
  });

  it('11. Vague answer triggers clarification', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "We used AI to make it better and faster.",
      "How does the core engine work?",
      'technical'
    );
    assert.strictEqual(understanding.isVague, true);
    assert.strictEqual(understanding.isUncertain, false);

    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'CLARIFY');
  });

  it('12. Contradiction triggers neutral clarification', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      conversationMemory: {
        contradictions: [{ topic: 'Database Architecture', detail: 'MySQL vs MongoDB', turnNumber: 1 }]
      },
      turnNumber: 2
    });
    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CONTRADICTION');
  });

  it('13. Previous topic does not override current answer', () => {
    const prevTopic = 'Backend Architecture';
    const currentAnswer = "I don't know the answer for this.";
    const understanding = AnswerUnderstandingService.analyzeAnswer(currentAnswer, "Explain microservices decomposition.", 'technical');
    
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      conversationMemory: { activeTopic: prevTopic }
    });

    assert.notStrictEqual(plan.targetTopic, 'Concrete Specifics');
    assert.strictEqual(plan.preferredStrategy, 'SUPPORTIVE_PIVOT');
  });

  it('14. Generic fallback cannot ignore current answer', () => {
    const currentAnswer = "I don't know the answer for this.";
    const understanding = AnswerUnderstandingService.analyzeAnswer(currentAnswer, "Explain architecture", 'technical');
    const fallback = ContextualFallbackGenerator.generateTurn({
      targetRole: 'Full Stack Developer',
      turnNumber: 2,
      latestInsight: understanding,
      strategy: { targetTopic: 'Architecture' },
      conversationHistory: [
        { turn_number: 1, question: "Explain architecture", student_answer: currentAnswer }
      ]
    });

    assert.doesNotMatch(fallback.question, /implementation approach/i);
    assert.doesNotMatch(fallback.question, /what tools did you use/i);
    assert.match(fallback.question, /fine|okay|personally|worked on|familiar/i);
  });

  it('15. Question relevance uses current answer', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I built a voice interview system using React and Web Audio API.",
      "Tell me about your project.",
      'technical'
    );
    assert.ok(understanding.technologies.includes('React') || understanding.technologies.includes('Web Audio API'));
  });

  it('16. Semantic question validation rejects unrelated question', () => {
    const quality = QuestionQualityService.validateQuestion({
      question: "Could you elaborate a bit more on that? Specifically, what was your direct implementation approach and what tools did you use?",
      previousAnswer: "I don't know the answer for this.",
      answerUnderstanding: { isUncertain: true, intent: 'UNCERTAIN' }
    });

    assert.strictEqual(quality.isValid, false);
    assert.ok(quality.issues.some(i => i.includes('uncertainty')));
  });

  it('17. Candidate pivot works', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I haven't used MongoDB, but I worked extensively with PostgreSQL.",
      "How do you index MongoDB collections?",
      'technical'
    );
    assert.ok(understanding.technologies.includes('PostgreSQL'));
  });

  it('18. Story thread updates after current answer', () => {
    const threads = [
      { id: 'thread_1', topic: 'Architecture', status: 'developing', depth: 2 }
    ];
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "I don't know the answer for this.",
      "Explain the cache invalidation policy.",
      'technical'
    );
    const updated = StoryThreadService.updateThreads(threads, understanding, {
      activeTopic: 'Architecture',
      depth: 2
    });
    const primary = StoryThreadService.getPrimaryDevelopingThread(updated);
    assert.ok(!primary || primary.status !== 'developing' || primary.status === 'pivoted');
  });

  it('19. Phase 9 reasoning receives exact current answer', () => {
    const prompt = buildTurnPrompt({
      targetRole: 'Full Stack Developer',
      turnNumber: 2,
      questionCount: 5,
      conversationHistory: [
        { turn_number: 1, question: "Explain the architecture", student_answer: "I don't know the answer for this." }
      ],
      latestInsight: { intent: 'UNCERTAIN', isUncertain: true }
    });

    assert.ok(prompt.includes("Candidate's Exact Latest Answer: \"I don't know the answer for this.\""));
    assert.ok(prompt.includes("Uncertainty / Knowledge Gap: YES"));
  });

  it('20. Voice mode uses same reasoning', () => {
    // Both voice and text use AnswerUnderstandingService and InterviewerReasoningEngine
    const voiceTranscript = "I don't know the answer for this";
    const understanding = AnswerUnderstandingService.analyzeAnswer(voiceTranscript, "How does VAD work?", 'technical');
    assert.strictEqual(understanding.isUncertain, true);
  });

  it('21. Text mode uses same reasoning', () => {
    const textAnswer = "I don't know the answer for this.";
    const understanding = AnswerUnderstandingService.analyzeAnswer(textAnswer, "How does VAD work?", 'technical');
    assert.strictEqual(understanding.isUncertain, true);
  });

  it('22. "I don\'t know" never generates implementation/tool question', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
      targetRole: 'Full Stack Developer',
      turnNumber: 2,
      latestInsight: { isUncertain: true, intent: 'UNCERTAIN' },
      strategy: { targetTopic: 'Architecture' },
      conversationHistory: [
        { turn_number: 1, question: "Explain the architecture", student_answer: "I don't know the answer for this." }
      ]
    });

    assert.strictEqual(/implementation approach|tools did you use|internal design/i.test(fallback.question), false);
  });

  it('23. Candidate challenge never jumps to unrelated topic', () => {
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "The hardest part was detecting when the candidate finished speaking without cutting them off early.",
      "What was the most challenging component?",
      'technical'
    );
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding
    });
    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CHALLENGE');
    const ref = (plan.curiosityTarget?.candidateReference || plan.targetTopic || '').toLowerCase();
    assert.ok(ref.includes('speaking') || ref.includes('detecting') || ref.includes('voice') || ref.includes('silence') || ref.includes('cutting'));
  });

  it('24. Candidate-introduced topic wins over old topic', () => {
    const oldTopic = 'Database Schema';
    const understanding = AnswerUnderstandingService.analyzeAnswer(
      "Actually, our biggest bottleneck was the voice silence detection.",
      "How did you design your tables?",
      'technical'
    );
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
      answerUnderstanding: understanding,
      conversationMemory: { activeTopic: oldTopic }
    });

    assert.notStrictEqual(plan.targetTopic, oldTopic);
    assert.ok(plan.targetTopic.toLowerCase().includes('voice'));
  });

  it('25. Full end-to-end conversation trace passes', () => {
    // Step 1: Candidate introduces project
    const u1 = AnswerUnderstandingService.analyzeAnswer("I built an AI-powered mock interview system with continuous voice.", "Tell me about your project", 'technical');
    assert.ok(u1.technologies.length > 0 || u1.projects.length > 0);

    // Step 2: Candidate mentions challenge
    const u2 = AnswerUnderstandingService.analyzeAnswer("The hardest part was silence detection.", "What was challenging?", 'technical');
    assert.strictEqual(u2.intent, 'CHALLENGE');

    // Step 3: Candidate expresses uncertainty
    const u3 = AnswerUnderstandingService.analyzeAnswer("I don't know the answer for this.", "Explain internal VAD math.", 'technical');
    assert.strictEqual(u3.isUncertain, true);
    assert.strictEqual(u3.intent, 'UNCERTAIN');

    const fallback3 = ContextualFallbackGenerator.generateTurn({
      targetRole: 'Full Stack Developer',
      turnNumber: 4,
      latestInsight: u3,
      strategy: { targetTopic: 'VAD' },
      conversationHistory: [
        { turn_number: 3, question: "Explain internal VAD math.", student_answer: "I don't know the answer for this." }
      ]
    });
    assert.doesNotMatch(fallback3.question, /implementation approach/i);
    assert.doesNotMatch(fallback3.question, /tools did you use/i);
  });
});
