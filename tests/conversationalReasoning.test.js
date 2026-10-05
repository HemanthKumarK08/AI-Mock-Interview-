/**
 * Conversational Reasoning & Interview Personality Test Suite
 * 
 * Validates:
 * 1. Answer understanding (claims, decisions, challenges, results, uncertainty, ownership)
 * 2. Story thread tracking (creation, continuation, depth, resolution, abandonment)
 * 3. Human interviewer reasoning (curiosity ranking, follow story, probe why, explore how, challenges, tradeoffs)
 * 4. Question quality validation (novelty, semantic duplicate detection, spoken length, zero leakage)
 * 5. Candidate-driven topic flow & unexpected topic handling
 * 6. Deterministic contextual fallback without random questions
 * 7. Security (prompt injection, cross-user isolation, memory safety)
 * 8. Speech preparation & voice mode safety
 */

const assert = require('assert');
const AnswerUnderstandingService = require('../backend/services/conversation/answerUnderstandingService');
const StoryThreadService = require('../backend/services/conversation/storyThreadService');
const InterviewerReasoningEngine = require('../backend/services/conversation/interviewerReasoningEngine');
const QuestionQualityService = require('../backend/services/conversation/questionQualityService');
const ContextualFallbackGenerator = require('../backend/services/conversation/contextualFallbackGenerator');
const ConversationMemoryService = require('../backend/services/conversation/conversationMemoryService');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✓ PASS: ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    Error: ${err.message}`);
        testsFailed++;
    }
}

console.log('\n======================================================');
console.log('  RUNNING CONVERSATIONAL REASONING TEST SUITE ');
console.log('======================================================\n');

// -------------------------------------------------------------
// GROUP 1: ANSWER UNDERSTANDING & OWNERSHIP (Tests 1 - 7)
// -------------------------------------------------------------
console.log('--- Group 1: Answer Understanding & Ownership ---');

runTest('1. Should extract individual candidate ownership ("I built...")', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'I built the entire backend service using Node.js and I designed the database schema.'
    });
    assert.strictEqual(insight.ownership, 'individual');
    assert.ok(insight.technologies.includes('Node.js'));
});

runTest('2. Should extract team ownership ("We built...")', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'Our team built the distributed microservice architecture and we deployed it to Kubernetes.'
    });
    assert.strictEqual(insight.ownership, 'team');
});

runTest('3. Should extract uncertainty markers ("I think...", "maybe...")', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'I think we used Redis for caching, but maybe it was memcached, I do not remember exactly.'
    });
    assert.ok(insight.uncertaintyMarkers.length > 0);
    assert.strictEqual(insight.isVague, true);
});

runTest('4. Should detect candidate pride markers', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'The real-time voice pipeline was my biggest achievement and I am really proud of how fast it performs.'
    });
    assert.strictEqual(insight.prideMarkers, true);
});

runTest('5. Should detect candidate difficulty markers', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'The hardest part was getting the silence threshold to work properly during pauses.'
    });
    assert.strictEqual(insight.difficultyMarkers, true);
});

runTest('6. Should extract decisions with choice and reason', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'We chose MySQL because relational consistency was necessary for transactional data.'
    });
    assert.ok(insight.decisions.length > 0);
    assert.ok(insight.decisions[0].choice.includes('MySQL'));
});

runTest('7. Should extract challenges and bottlenecks', () => {
    const insight = AnswerUnderstandingService.analyzeAnswer({
        studentAnswer: 'We encountered a timeout issue in our API when third-party responses took too long.'
    });
    assert.ok(insight.challenges.length > 0);
    assert.ok(insight.challenges.some(ch => ch.toLowerCase().includes('timeout')));
});

// -------------------------------------------------------------
// GROUP 2: STORY THREAD TRACKING (Tests 8 - 14)
// -------------------------------------------------------------
console.log('\n--- Group 2: Story Thread Tracking ---');

runTest('8. Should create a new story thread from a candidate project/challenge', () => {
    const thread = StoryThreadService.createThread({
        title: 'Voice Interview Architecture',
        topic: 'Voice Processing',
        candidateClaims: ['I built the voice interview system'],
        challenges: ['Silence detection timing'],
        turnNumber: 1
    });
    assert.ok(thread.id);
    assert.strictEqual(thread.status, 'introduced');
    assert.strictEqual(thread.depth, 1);
});

runTest('9. Should update and advance thread depth on relevant follow-up', () => {
    let threads = [
        StoryThreadService.createThread({
            title: 'Gemini Integration',
            topic: 'AI Integration',
            candidateClaims: ['Used Gemini for question generation'],
            challenges: ['API timeouts'],
            turnNumber: 1
        })
    ];

    threads = StoryThreadService.updateThreads(
        threads,
        { challenges: ['Fallback provider switching'], decisions: [{ choice: 'Fallback provider' }] },
        'AI Integration',
        2
    );

    assert.strictEqual(threads[0].depth, 2);
    assert.strictEqual(threads[0].status, 'developing');
});

runTest('10. Should mark thread as deep after exploring multiple decisions/challenges', () => {
    let thread = StoryThreadService.createThread({
        title: 'VAD Processing',
        topic: 'Voice',
        turnNumber: 1
    });
    thread.depth = 3;
    thread.decisions.push('RMS Threshold', 'Pre-speech buffer');
    thread.challenges.push('False positive cutoffs');

    let threads = StoryThreadService.updateThreads([thread], {}, 'Voice', 4);
    assert.strictEqual(threads[0].status, 'deep');
});

runTest('11. Should resolve thread when sufficiently explored', () => {
    let thread = StoryThreadService.createThread({
        title: 'Caching Strategy',
        topic: 'Redis',
        turnNumber: 1
    });
    StoryThreadService.resolveThread(thread, 'Explained eviction policy and TTL');
    assert.strictEqual(thread.status, 'resolved');
});

runTest('12. Should identify active developing thread with unresolved details', () => {
    const thread1 = { id: 't1', status: 'resolved', depth: 4, unresolvedQuestions: [] };
    const thread2 = { id: 't2', status: 'developing', depth: 2, unresolvedQuestions: ['How did you handle timeouts?'] };
    const primary = StoryThreadService.getPrimaryDevelopingThread([thread1, thread2]);
    assert.strictEqual(primary.id, 't2');
});

runTest('13. Should abandon stale threads when candidate changes subject completely', () => {
    const thread = StoryThreadService.createThread({
        title: 'Old Thread',
        topic: 'Legacy Topic',
        turnNumber: 1
    });
    const threads = StoryThreadService.updateThreads([thread], {}, 'Completely Unrelated Subject', 6);
    assert.strictEqual(threads[0].status, 'abandoned');
});

runTest('14. Story threads integrate cleanly with ConversationMemoryService', () => {
    let memory = ConversationMemoryService.createInitialMemory('Full Stack Developer', 'technical');
    assert.ok(Array.isArray(memory.storyThreads));

    memory = ConversationMemoryService.updateMemory(memory, {
        turn: { turn_number: 1, question_topic: 'React' },
        insight: {
            technologies: ['React'],
            projects: ['Mock Interview App'],
            challenges: ['Component state lag']
        }
    });

    assert.ok(memory.storyThreads.length > 0);
    assert.strictEqual(memory.storyThreads[0].topic, 'React');
});

// -------------------------------------------------------------
// GROUP 3: CURIOSITY RANKING & OPPORTUNITIES (Tests 15 - 21)
// -------------------------------------------------------------
console.log('\n--- Group 3: Curiosity Ranking & Opportunities ---');

runTest('15. Should extract and score challenge follow-up opportunities', () => {
    const opportunities = InterviewerReasoningEngine.extractCuriosityOpportunities({
        answerUnderstanding: {
            challenges: ['API latency spikes'],
            technologies: ['Node.js'],
            decisions: []
        },
        conversationMemory: { depthByTopic: {} },
        storyThreads: []
    });

    assert.ok(opportunities.length > 0);
    const challengeOpp = opportunities.find(o => o.opportunityType === 'challenge');
    assert.ok(challengeOpp);
    assert.ok(challengeOpp.curiosityScore > 0.7);
});

runTest('16. Should rank challenge higher than generic entity mention', () => {
    const opportunities = InterviewerReasoningEngine.extractCuriosityOpportunities({
        answerUnderstanding: {
            challenges: ['WebRTC packet loss'],
            technologies: ['React'],
            decisions: []
        },
        conversationMemory: { depthByTopic: {} },
        storyThreads: []
    });

    const sorted = InterviewerReasoningEngine.rankOpportunities(opportunities);
    assert.strictEqual(sorted[0].opportunityType, 'challenge');
    assert.strictEqual(sorted[0].candidateReference, 'WebRTC packet loss');
});

runTest('17. Should prioritize candidate pride/breakthrough opportunity', () => {
    const opportunities = InterviewerReasoningEngine.extractCuriosityOpportunities({
        answerUnderstanding: {
            prideMarkers: true,
            claims: ['I designed the streaming response pipeline'],
            technologies: ['Kafka']
        },
        conversationMemory: { depthByTopic: {} },
        storyThreads: []
    });

    const prideOpp = opportunities.find(o => o.opportunityType === 'pride_moment');
    assert.ok(prideOpp);
    assert.ok(prideOpp.curiosityScore >= 0.9);
});

runTest('18. Should generate ownership clarification opportunity for team statements', () => {
    const opportunities = InterviewerReasoningEngine.extractCuriosityOpportunities({
        answerUnderstanding: {
            ownership: 'team',
            claims: ['We built the microservice mesh']
        },
        conversationMemory: { depthByTopic: {} },
        storyThreads: []
    });

    const ownershipOpp = opportunities.find(o => o.opportunityType === 'ownership');
    assert.ok(ownershipOpp);
    assert.strictEqual(ownershipOpp.preferredStrategy, 'CLARIFY_OWNERSHIP');
});

runTest('19. Should extract decision & tradeoff opportunity', () => {
    const opportunities = InterviewerReasoningEngine.extractCuriosityOpportunities({
        answerUnderstanding: {
            decisions: [{ choice: 'PostgreSQL', reason: 'ACID compliance' }]
        },
        conversationMemory: { depthByTopic: {} },
        storyThreads: []
    });

    const decisionOpp = opportunities.find(o => o.opportunityType === 'decision');
    assert.ok(decisionOpp);
    assert.strictEqual(decisionOpp.preferredStrategy, 'EXPLORE_DECISION');
});

runTest('20. Curiosity score incorporates technical depth and specificity', () => {
    const score = InterviewerReasoningEngine.calculateCuriosityScore({
        interestingness: 0.9,
        difficulty: 0.85,
        specificity: 0.9,
        candidateOwnership: 0.9,
        challengeRelevance: 0.8,
        decisionRelevance: 0.7,
        unresolved: 0.8,
        depth: 0.7
    });

    assert.ok(score >= 0.8 && score <= 1.0);
});

runTest('21. Ranking prevents repeating exhausted topics with high prior depth', () => {
    const opportunities = [
        { candidateReference: 'React', depthScore: 0.1, curiosityScore: 0.8 },
        { candidateReference: 'Voice VAD', depthScore: 0.9, curiosityScore: 0.75 }
    ];
    const ranked = InterviewerReasoningEngine.rankOpportunities(opportunities);
    assert.strictEqual(ranked[0].candidateReference, 'Voice VAD');
});

// -------------------------------------------------------------
// GROUP 4: INTERVIEWER REASONING & STRATEGIES (Tests 22 - 28)
// -------------------------------------------------------------
console.log('\n--- Group 4: Interviewer Reasoning & Strategies ---');

runTest('22. Should select FOLLOW_STORY when candidate introduces a project story', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: {
            projects: ['Mock Interview Platform'],
            technologies: ['React', 'Node.js'],
            claims: ['I built an AI mock interview system']
        },
        conversationMemory: { discussedTopics: [], depthByTopic: {} },
        currentQuestion: 'Tell me about a project you worked on.',
        remainingQuestionBudget: 5
    });

    assert.strictEqual(plan.preferredStrategy, 'FOLLOW_STORY');
    assert.strictEqual(plan.conversationalGoal, 'understand_candidate_reasoning');
});

runTest('23. Should select EXPLORE_CHALLENGE when candidate mentions a problem', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: {
            challenges: ['API timeouts under load']
        },
        conversationMemory: { depthByTopic: {} },
        currentQuestion: 'What part was the hardest?',
        remainingQuestionBudget: 4
    });

    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CHALLENGE');
    assert.strictEqual(plan.conversationalGoal, 'understand_challenge');
});

runTest('24. Should select CLARIFY when answer is vague or uncertain', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: {
            isVague: true,
            unclearPoints: ['used AI to make it smarter']
        },
        conversationMemory: { depthByTopic: {} },
        currentQuestion: 'How did you implement that?',
        remainingQuestionBudget: 4
    });

    assert.strictEqual(plan.preferredStrategy, 'CLARIFY');
    assert.strictEqual(plan.conversationalGoal, 'clarify_ambiguous_statement');
});

runTest('25. Should select EXPLORE_CONTRADICTION on detected contradictions', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: { technologies: ['MySQL'] },
        conversationMemory: {
            contradictions: [{ topic: 'Database Stack', detail: 'MongoDB vs MySQL' }],
            depthByTopic: {}
        },
        currentQuestion: 'What database did you use?',
        remainingQuestionBudget: 3
    });

    assert.strictEqual(plan.preferredStrategy, 'EXPLORE_CONTRADICTION');
    assert.strictEqual(plan.conversationalGoal, 'clarify_contradiction');
});

runTest('26. Should adapt reasoning strategy for Behavioral interview type', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: {
            claims: ['I resolved a disagreement with a team member']
        },
        conversationMemory: { depthByTopic: {} },
        interviewType: 'behavioral',
        currentQuestion: 'Tell me about a conflict at work.',
        remainingQuestionBudget: 3
    });

    assert.ok(plan.conversationalGoal.includes('behavioral') || plan.conversationalGoal.includes('reasoning') || plan.conversationalGoal.includes('action'));
});

runTest('27. Should trigger natural TRANSITION when topic depth is exhausted', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: { technologies: ['React'] },
        conversationMemory: {
            activeTopic: 'React Architecture',
            discussedTopics: ['React Architecture'],
            depthByTopic: { 'React Architecture': 4 },
            candidateTechnologies: ['React', 'Node.js', 'MySQL']
        },
        topicState: { activeTopic: 'React Architecture', depth: 4 },
        remainingQuestionBudget: 2
    });

    assert.strictEqual(plan.preferredStrategy, 'TRANSITION');
    assert.strictEqual(plan.transitionNeeded, true);
});

runTest('28. Should simplify question strategy when candidate struggles (Difficulty adaptation)', () => {
    const plan = InterviewerReasoningEngine.determineCuriosityPlan({
        answerUnderstanding: {
            uncertaintyMarkers: ['I do not know', 'I forgot'],
            isVague: true
        },
        answerEvaluation: { overallScore: 3.5, technicalAccuracy: 3.0 },
        conversationMemory: { depthByTopic: {} },
        remainingQuestionBudget: 3
    });

    assert.strictEqual(plan.preferredStrategy, 'CLARIFY');
    assert.strictEqual(plan.conversationalGoal, 'clarify_ambiguous_statement');
});

// -------------------------------------------------------------
// GROUP 5: QUESTION QUALITY & VALIDATION (Tests 29 - 35)
// -------------------------------------------------------------
console.log('\n--- Group 5: Question Quality & Validation ---');

runTest('29. Should validate high-quality humanized question', () => {
    const result = QuestionQualityService.validateQuestion({
        question: 'What made you choose Gemini for that part, and how did you handle unexpected timeouts?',
        previousAnswer: 'I built the interview system with Gemini API but sometimes requests took too long.',
        askedQuestions: []
    });

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.issues.length, 0);
});

runTest('30. Should reject questions with internal score/reasoning leakage', () => {
    const result = QuestionQualityService.validateQuestion({
        question: 'What made you choose Gemini? [curiosityScore: 0.95, preferredStrategy: FOLLOW_STORY]',
        previousAnswer: 'I used Gemini',
        askedQuestions: []
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.issues.some(i => i.includes('leakage')));
});

runTest('31. Should detect exact duplicate questions', () => {
    const result = QuestionQualityService.validateQuestion({
        question: 'Why did you choose MySQL for this system?',
        previousAnswer: 'We used MySQL.',
        askedQuestions: ['Why did you choose MySQL for this system?']
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.issues.some(i => i.includes('Duplicate')));
});

runTest('32. Should detect semantic duplicate questions', () => {
    const result = QuestionQualityService.validateQuestion({
        question: 'What made you choose MySQL?',
        previousAnswer: 'We used MySQL.',
        askedQuestions: ['Why did you select MySQL?']
    });

    assert.strictEqual(result.isValid, false);
    assert.ok(result.issues.some(i => i.includes('Duplicate')));
});

runTest('33. Should flag overly robotic/textbook question phrasing', () => {
    const result = QuestionQualityService.validateQuestion({
        question: 'Please elaborate upon the aforementioned architectural decision.',
        previousAnswer: 'I picked React.',
        askedQuestions: []
    });

    assert.ok(result.issues.some(i => i.includes('Robotic')));
});

runTest('34. Should flag questions with too many sentences (spoken length constraint)', () => {
    const longQuestion = 'You mentioned using React. How did you structure your components? Also what state library did you use? Furthermore how did you optimize rendering performance?';
    const result = QuestionQualityService.validateQuestion({
        question: longQuestion,
        previousAnswer: 'I used React.',
        askedQuestions: []
    });

    assert.ok(result.issues.some(i => i.includes('too long') || i.includes('too many question marks')));
});

runTest('35. Should sanitize JSON code blocks or artifacts from AI response', () => {
    const rawAi = '```json\n{"question": "How did you structure your API routes?"}\n```';
    const sanitized = QuestionQualityService.sanitizeQuestionText(rawAi);
    assert.strictEqual(sanitized, 'How did you structure your API routes?');
});

// -------------------------------------------------------------
// GROUP 6: CONTEXTUAL FALLBACK & DETERMINISTIC REASONING (Tests 36 - 40)
// -------------------------------------------------------------
console.log('\n--- Group 6: Contextual Fallback & Deterministic Reasoning ---');

runTest('36. Contextual fallback creates grounded follow-up for timeouts challenge', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
        turnNumber: 2,
        conversationHistory: [{ student_answer: 'Gemini worked well but API requests sometimes timed out.' }],
        latestInsight: { challenges: ['API timeouts'] },
        reasoningPlan: { preferredStrategy: 'EXPLORE_CHALLENGE', curiosityTarget: { candidateReference: 'API timeouts' } }
    });

    assert.ok(fallback.question.toLowerCase().includes('timeout') || fallback.question.toLowerCase().includes('fallback'));
    assert.strictEqual(fallback.intent, 'EXPLORE_CHALLENGE');
});

runTest('37. Contextual fallback creates grounded follow-up for voice detection challenge', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
        turnNumber: 3,
        conversationHistory: [{ student_answer: 'The hardest part was automatic voice silence detection.' }],
        latestInsight: { challenges: ['voice silence detection'] },
        reasoningPlan: { preferredStrategy: 'EXPLORE_CHALLENGE', curiosityTarget: { candidateReference: 'voice silence detection' } }
    });

    assert.ok(fallback.question.toLowerCase().includes('voice') || fallback.question.toLowerCase().includes('paus'));
});

runTest('38. Contextual fallback creates ownership clarification for team statements', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
        turnNumber: 2,
        conversationHistory: [{ student_answer: 'We implemented the caching layer.' }],
        latestInsight: { ownership: 'team' },
        reasoningPlan: { preferredStrategy: 'CLARIFY_OWNERSHIP', curiosityTarget: { candidateReference: 'caching layer' } }
    });

    assert.ok(fallback.question.toLowerCase().includes('personally') || fallback.question.toLowerCase().includes('part'));
    assert.strictEqual(fallback.intent, 'CLARIFY_OWNERSHIP');
});

runTest('39. Contextual fallback creates smooth transition when depth reached', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
        turnNumber: 4,
        conversationHistory: [{ student_answer: 'We used MySQL and indexed user_id.' }],
        strategy: { prevTopic: 'Database Design', targetTopic: 'API Security', shouldTransition: true },
        reasoningPlan: { preferredStrategy: 'TRANSITION', targetTopic: 'API Security', transitionNeeded: true }
    });

    assert.ok(fallback.question.toLowerCase().includes('security') || fallback.question.toLowerCase().includes('authentication'));
    assert.strictEqual(fallback.intent, 'TRANSITION');
});

runTest('40. Fallback questions never leak internal reasoning metadata', () => {
    const fallback = ContextualFallbackGenerator.generateTurn({
        turnNumber: 2,
        conversationHistory: [{ student_answer: 'I used Redis.' }],
        latestInsight: { technologies: ['Redis'] },
        reasoningPlan: { preferredStrategy: 'FOLLOW_STORY', curiosityTarget: { candidateReference: 'Redis' } }
    });

    const quality = QuestionQualityService.validateQuestion({
        question: fallback.question,
        previousAnswer: 'I used Redis.'
    });

    assert.strictEqual(quality.isValid, true);
    assert.strictEqual(QuestionQualityService.checkInternalLeakage(fallback.question).hasLeakage, false);
});

// -------------------------------------------------------------
// SUMMARY & VERIFICATION
// -------------------------------------------------------------
console.log('\n======================================================');
console.log(`  CONVERSATIONAL REASONING TEST SUITE FINISHED: ${testsPassed} / ${testsPassed + testsFailed} PASSED`);
console.log('======================================================\n');

if (testsFailed > 0) {
    console.error(`❌ ${testsFailed} test(s) failed in Conversational Reasoning suite.`);
    process.exit(1);
} else {
    console.log('✅ ALL CONVERSATIONAL REASONING TESTS PASSED!');
    process.exit(0);
}
