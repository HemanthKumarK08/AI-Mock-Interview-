// Question Strategy Engine for MockInterviewAI (Phase 8)
// Determines intelligent conversational intent, topic depth, and transition path

const ROLE_COVERAGE_DOMAINS = {
  'Full Stack Developer': ['Frontend & UI', 'Backend Architecture', 'Database & Indexing', 'API Design & Auth', 'Security & Performance', 'System Design'],
  'Java Developer': ['Core Java & OOP', 'Concurrency & Collections', 'Spring Framework', 'Database & Transactions', 'JVM Internals', 'System Architecture'],
  'Python Developer': ['Python Fundamentals', 'Async & Web Frameworks', 'Data Structures & Algorithms', 'Database & Caching', 'Performance & Profiling'],
  'Frontend Developer': ['React Architecture', 'State Management', 'CSS & Responsive Design', 'Performance & Web Vitals', 'Testing & Build Tools'],
  'Backend Developer': ['API Design & REST', 'Database Optimization', 'Microservices & Distributed Systems', 'Auth & Security', 'Message Queues & Caching'],
  'Data Scientist': ['Machine Learning Algorithms', 'Data Preprocessing', 'Model Evaluation & Metrics', 'Python/SQL Pipelines', 'Deep Learning & NLP']
};

const TRANSITION_PHRASES = [
  'Building on what you just shared regarding {prevTopic}, let\'s explore how you handle {nextTopic}.',
  'We\'ve covered your experience with {prevTopic}. Moving over to {nextTopic}, how do you approach...',
  'That gives a clear picture of {prevTopic}. Let\'s shift focus slightly to {nextTopic}.',
  'Connecting that back to the broader system, how did you handle {nextTopic}?'
];

class QuestionStrategyEngine {
  /**
   * Determines the optimal conversational strategy for the next turn
   */
  static determineStrategy({ targetRole, interviewType, memory, latestInsight, evaluation, turnNumber, maxQuestions = 5 }) {
    console.log(`[STRATEGY_ENGINE_ENTERED] Turn #${turnNumber}, TargetRole: ${targetRole}`);
    const memoryObj = memory || {};
    const insight = latestInsight || {};
    const activeTopic = memoryObj.activeTopic || 'General';
    const currentTopicDepth = memoryObj.depthByTopic?.[activeTopic] || 1;

    // 1. Check for Contradictions first (Neutral clarification)
    if (memoryObj.contradictions && memoryObj.contradictions.length > 0 && !insight.isUncertain && insight.intent !== 'UNCERTAIN') {
      const latestContradiction = memoryObj.contradictions[memoryObj.contradictions.length - 1];
      if (latestContradiction.turnNumber === turnNumber - 1) {
        const strat = {
          intent: 'CONTRADICTION',
          targetTopic: latestContradiction.topic,
          reason: 'Address conflicting candidate assertions neutrally',
          candidateRef: latestContradiction.detail,
          shouldTransition: false
        };
        console.log(`[STRATEGY_ENGINE_RESULT] ${strat.intent} -> TargetTopic: ${strat.targetTopic}`);
        return strat;
      }
    }

    // 2. Check for Candidate Uncertainty / Knowledge Gap / Non-implementation (Supportive Pivot)
    if (insight.isUncertain || insight.intent === 'UNCERTAIN') {
      const strat = {
        intent: 'SUPPORTIVE_PIVOT',
        targetTopic: 'Personal Contribution',
        reason: 'Candidate expressed uncertainty; pivot supportively to familiar candidate-owned work',
        candidateRef: 'personal implementation',
        shouldTransition: true
      };
      console.log(`[STRATEGY_ENGINE_RESULT] ${strat.intent} -> TargetTopic: ${strat.targetTopic}`);
      return strat;
    }

    // 3. Check for Candidate-Owned Topic Introduction
    if (insight.candidateOwnedTopic && insight.candidateOwnedTopic.toLowerCase() !== activeTopic.toLowerCase()) {
      return {
        intent: 'CANDIDATE_TOPIC',
        targetTopic: insight.candidateOwnedTopic,
        reason: `Candidate introduced new topic: ${insight.candidateOwnedTopic}`,
        candidateRef: insight.candidateOwnedTopic,
        shouldTransition: false
      };
    }

    // 4. Check for Vague or Unclear assertions (Clarification)
    if (insight.isVague && !insight.isUncertain && insight.unclearPoints && insight.unclearPoints.length > 0) {
      return {
        intent: 'CLARIFICATION',
        targetTopic: activeTopic,
        reason: 'Candidate provided a vague assertion requiring elaboration',
        candidateRef: insight.unclearPoints[0],
        shouldTransition: false
      };
    }

    // 3. Check for specific challenges/bottlenecks mentioned by candidate
    if (insight.challenges && insight.challenges.length > 0 && currentTopicDepth <= 2) {
      return {
        intent: 'CHALLENGE',
        targetTopic: activeTopic,
        subtopic: insight.challenges[0],
        reason: 'Investigate problem-solving approach to candidate-mentioned obstacle',
        candidateRef: insight.challenges[0],
        shouldTransition: false
      };
    }

    // 4. Check for architectural / technology decisions
    if (insight.decisions && insight.decisions.length > 0 && currentTopicDepth <= 2) {
      return {
        intent: 'DECISION',
        targetTopic: activeTopic,
        subtopic: insight.decisions[0].choice,
        reason: 'Investigate justification and alternatives for chosen architecture',
        candidateRef: insight.decisions[0].choice,
        shouldTransition: false
      };
    }

    // 5. Check for candidate-introduced technologies for Deep Dive
    if (insight.technologies && insight.technologies.length > 0 && currentTopicDepth < 3) {
      const primaryTech = insight.technologies[0];
      return {
        intent: 'DEEP_DIVE',
        targetTopic: primaryTech,
        reason: `Explore candidate's practical depth in ${primaryTech}`,
        candidateRef: primaryTech,
        shouldTransition: false
      };
    }

    // 6. Check if topic depth has reached exploration threshold (depth >= 2-3) -> Transition
    if (currentTopicDepth >= 2) {
      const nextCoverageTopic = this.getNextCoverageTopic(targetRole, memoryObj.discussedTopics || []);
      const phrase = TRANSITION_PHRASES[Math.floor(Math.random() * TRANSITION_PHRASES.length)]
        .replace('{prevTopic}', activeTopic)
        .replace('{nextTopic}', nextCoverageTopic);

      return {
        intent: 'TRANSITION',
        targetTopic: nextCoverageTopic,
        prevTopic: activeTopic,
        transitionPhrase: phrase,
        reason: `Depth reached on ${activeTopic} (${currentTopicDepth} turns). Pivoting to uncovered domain.`,
        shouldTransition: true
      };
    }

    // 7. Default to Deep Dive / Technical Probe
    return {
      intent: 'TECHNICAL_PROBE',
      targetTopic: activeTopic,
      reason: 'Continue exploring technical competencies on current subject',
      candidateRef: memoryObj.lastAnswerSummary,
      shouldTransition: false
    };
  }

  static getNextCoverageTopic(targetRole, discussedTopics = []) {
    const domains = ROLE_COVERAGE_DOMAINS[targetRole] || ['Architecture', 'Core Principles', 'Database & Persistence', 'Security', 'Testing'];
    const unvisited = domains.filter(d => !discussedTopics.some(dt => dt.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(dt.toLowerCase())));
    if (unvisited.length > 0) {
      return unvisited[0];
    }
    // If all visited, pick a high-value system topic
    return domains[0];
  }
}

module.exports = QuestionStrategyEngine;
