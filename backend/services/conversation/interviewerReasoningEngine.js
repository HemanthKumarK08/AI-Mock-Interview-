// Interviewer Reasoning Engine for MockInterviewAI (Phase 9)
// Determines what a thoughtful human interviewer would naturally be curious about next

const StoryThreadService = require('./storyThreadService');

class InterviewerReasoningEngine {
  /**
   * Main entry point for conversational reasoning (Phase 9)
   */
  static determineCuriosityPlan(params = {}) {
    return this.reasonNextStep(params);
  }

  /**
   * Evaluates candidate's answer and reasons about the next conversational direction
   */
  static reasonNextStep({
    currentAnswer = '',
    answerUnderstanding = {},
    answerEvaluation = {},
    conversationMemory = {},
    storyThreads = [],
    turnNumber = 1,
    targetRole = 'Full Stack Developer',
    interviewType = 'technical',
    difficulty = 'intermediate',
    remainingQuestionBudget = 4,
    remainingBudget = 4,
    currentQuestion = '',
    topicState = {}
  }) {
    console.log(`[PHASE9_REASONING_ENTERED] Turn #${turnNumber}, TargetRole: ${targetRole}`);

    const memory = conversationMemory || {};
    const insight = answerUnderstanding || {};
    const threads = storyThreads.length > 0 ? storyThreads : (memory.storyThreads || []);
    const activeThread = StoryThreadService.getPrimaryDevelopingThread(threads);
    const currentTopic = topicState.activeTopic || activeThread?.topic || memory.activeTopic || 'General';
    const currentDepth = topicState.depth || activeThread?.depth || memory.depthByTopic?.[currentTopic] || 1;
    const budget = remainingQuestionBudget !== undefined ? remainingQuestionBudget : remainingBudget;

    const answerStr = typeof currentAnswer === 'string' ? currentAnswer : (insight.studentAnswer || '');
    const isExplicitPivotOrUncertain = insight.isUncertain || insight.intent === 'UNCERTAIN' ||
      /(?:didn'?t|did not|never|haven'?t)\s+(?:implement|build|develop|create|do|touch|work on)|(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)|(?:i don'?t know|dont know|no idea|not sure|not familiar)/i.test(answerStr);

    // 1. Contradiction Resolution (Highest Priority - Neutral Inquiry)
    if (memory.contradictions && memory.contradictions.length > 0 && !isExplicitPivotOrUncertain) {
      const latestContradiction = memory.contradictions[memory.contradictions.length - 1];
      if (latestContradiction.turnNumber === turnNumber - 1 || turnNumber <= 2) {
        const plan = {
          reasoning: 'EXPLORE_CONTRADICTION',
          conversationalGoal: 'clarify_contradiction',
          curiosityTarget: { candidateReference: latestContradiction.topic, curiosityScore: 0.95 },
          targetTopic: latestContradiction.topic,
          targetSubtopic: 'Architecture Consistency',
          reason: 'Politely clarify seemingly conflicting candidate assertions without accusation.',
          preferredStrategy: 'EXPLORE_CONTRADICTION',
          transitionNeeded: false,
          confidence: 0.95
        };
        console.log(`[PHASE9_REASONING_RESULT] ${plan.preferredStrategy} -> TargetTopic: ${plan.targetTopic}`);
        return plan;
      }
    }

    // 2. Candidate Uncertainty / Non-Implementation / Pivot Request (CRITICAL: Never drill or ask for tools/implementation on unknown/unworked topic)
    if (isExplicitPivotOrUncertain) {
      const knownTech = (memory.candidateTechnologies || []).find(t => t.toLowerCase() !== currentTopic.toLowerCase());
      const pivotRef = knownTech || 'what you worked on directly';
      const plan = {
        reasoning: 'SUPPORTIVE_PIVOT',
        conversationalGoal: 'supportive_pivot',
        curiosityTarget: { candidateReference: pivotRef, curiosityScore: 0.95 },
        targetTopic: knownTech || 'Personal Contribution',
        targetSubtopic: 'Personal Experience',
        reason: 'Candidate expressed uncertainty, non-implementation, or requested a different topic. Pivoting supportively to candidate-owned work.',
        preferredStrategy: 'SUPPORTIVE_PIVOT',
        transitionNeeded: true,
        confidence: 0.96
      };
      console.log(`[PHASE9_REASONING_RESULT] ${plan.preferredStrategy} -> TargetTopic: ${plan.targetTopic}`);
      return plan;
    }

    // 3. Candidate Challenges & Bottlenecks (Problem-Solving Exploration)
    if (insight.challenges?.length > 0 || insight.intent === 'CHALLENGE') {
      const challengeRef = insight.challenges?.[0] || 'the obstacle mentioned';
      return {
        reasoning: 'EXPLORE_CHALLENGE',
        conversationalGoal: 'understand_challenge',
        curiosityTarget: { candidateReference: challengeRef, curiosityScore: 0.94 },
        targetTopic: challengeRef,
        targetSubtopic: 'Resolution & Troubleshooting',
        reason: `Candidate described a key challenge on ${challengeRef}. Investigating troubleshooting approach.`,
        preferredStrategy: 'EXPLORE_CHALLENGE',
        transitionNeeded: false,
        confidence: 0.94
      };
    }

    // 4. Candidate Decisions & Trade-offs
    if (insight.decisions?.length > 0 || insight.intent === 'DECISION') {
      const decisionRef = insight.decisions?.[0]?.choice || 'architectural choice';
      return {
        reasoning: 'EXPLORE_DECISION',
        conversationalGoal: 'explore_technical_decision',
        curiosityTarget: { candidateReference: decisionRef, curiosityScore: 0.92 },
        targetTopic: decisionRef,
        targetSubtopic: 'Trade-offs & Alternatives',
        reason: `Candidate made an explicit decision regarding ${decisionRef}. Probing justification and trade-offs.`,
        preferredStrategy: 'EXPLORE_DECISION',
        transitionNeeded: false,
        confidence: 0.92
      };
    }

    // 5. Candidate-Owned Topic (Candidate introduced a new narrative thread/focus)
    if (insight.candidateOwnedTopic && insight.candidateOwnedTopic.toLowerCase() !== currentTopic.toLowerCase()) {
      return {
        reasoning: 'FOLLOW_CANDIDATE_TOPIC',
        conversationalGoal: 'understand_candidate_reasoning',
        curiosityTarget: { candidateReference: insight.candidateOwnedTopic, curiosityScore: 0.94 },
        targetTopic: insight.candidateOwnedTopic,
        targetSubtopic: 'Problem Solving & Implementation',
        reason: `Candidate introduced a new focal topic: ${insight.candidateOwnedTopic}. Following candidate lead.`,
        preferredStrategy: 'FOLLOW_CANDIDATE_TOPIC',
        transitionNeeded: false,
        confidence: 0.94
      };
    }

    // 6. Candidate Struggling / Low Evaluation (Difficulty Adaptation -> Simplify/Clarify)
    if (answerEvaluation && (answerEvaluation.overallScore < 4.0 || answerEvaluation.technicalAccuracy < 4.0) && budget > 1) {
      if (insight.isVague && insight.uncertaintyMarkers && insight.uncertaintyMarkers.length > 1) {
        return {
          reasoning: 'CLARIFY',
          conversationalGoal: 'clarify_ambiguous_statement',
          curiosityTarget: { candidateReference: currentTopic, curiosityScore: 0.88 },
          targetTopic: currentTopic,
          targetSubtopic: 'Fundamentals',
          reason: 'Candidate struggled and gave a vague answer with multiple uncertainties. Providing a clearer, more grounded follow-up on fundamentals.',
          preferredStrategy: 'CLARIFY',
          transitionNeeded: false,
          confidence: 0.88
        };
      }
      return {
        reasoning: 'SIMPLIFY',
        conversationalGoal: 'simplify_concept',
        curiosityTarget: { candidateReference: currentTopic, curiosityScore: 0.88 },
        targetTopic: currentTopic,
        targetSubtopic: 'High-Level Overview',
        reason: 'Candidate struggled on technical depth. Providing a simpler high-level question on fundamentals.',
        preferredStrategy: 'SIMPLIFY',
        transitionNeeded: false,
        confidence: 0.88
      };
    }

    // 5. Vague / Unclear Assertion Clarification (NOT uncertainty, but vague claims like "We used AI to make it better")
    if (insight.isVague && !insight.isUncertain && (insight.unclearPoints?.length > 0 || (insight.claims?.length > 0 && !insight.details?.length))) {
      const vagueTarget = insight.unclearPoints?.[0] || insight.claims?.[0] || 'the practical application';
      return {
        reasoning: 'CLARIFY',
        conversationalGoal: 'clarify_ambiguous_statement',
        curiosityTarget: { candidateReference: vagueTarget, curiosityScore: 0.90 },
        targetTopic: currentTopic,
        targetSubtopic: 'Specific Application',
        reason: 'Candidate provided a high-level vague claim requiring clarification of the specific mechanism.',
        preferredStrategy: 'CLARIFY',
        transitionNeeded: false,
        confidence: 0.90
      };
    }

    // 6. Candidate Ownership Clarification (if candidate said "We built" / "Our team")
    if (insight.ownership === 'team' && !memory.candidateClaims?.some(c => c.ownership === 'individual')) {
      return {
        reasoning: 'CLARIFY_OWNERSHIP',
        conversationalGoal: 'clarify_ownership',
        curiosityTarget: { candidateReference: currentTopic, curiosityScore: 0.86 },
        targetTopic: currentTopic,
        targetSubtopic: 'Personal Contribution',
        reason: 'Clarify candidate\'s specific personal contribution versus team responsibility.',
        preferredStrategy: 'CLARIFY_OWNERSHIP',
        transitionNeeded: false,
        confidence: 0.86
      };
    }

    // 7. Check if Current Topic Depth is Exhausted (depth >= 3 or resolved) -> Natural Transition
    if (currentDepth >= 3 || (activeThread && activeThread.status === 'resolved')) {
      const nextDomain = this.selectNextCoverageDomain(targetRole, memory.discussedTopics || []);
      return {
        reasoning: 'TRANSITION',
        conversationalGoal: 'transition_topic',
        curiosityTarget: { candidateReference: nextDomain, curiosityScore: 0.85 },
        targetTopic: nextDomain,
        prevTopic: currentTopic,
        reason: `Sufficient depth achieved on ${currentTopic} (${currentDepth} turns). Smoothly bridging to ${nextDomain}.`,
        preferredStrategy: 'TRANSITION',
        transitionNeeded: true,
        confidence: 0.88
      };
    }

    // 6. Extract & Rank Opportunities based on Human Curiosity Model
    const opportunities = this.extractCuriosityOpportunities({
      answerUnderstanding: insight,
      conversationMemory: memory,
      storyThreads: threads,
      currentTopic,
      currentDepth
    });

    const ranked = this.rankOpportunities(opportunities);

    if (ranked.length > 0) {
      const best = ranked[0];

      // Pride Moment / Breakthrough Exploration
      if (best.opportunityType === 'pride_moment') {
        return {
          reasoning: 'FOLLOW_STORY',
          conversationalGoal: 'understand_candidate_reasoning',
          curiosityTarget: best,
          targetTopic: best.targetTopic || currentTopic,
          targetSubtopic: best.candidateReference,
          reason: `Follow candidate's proud breakthrough on ${best.candidateReference}.`,
          preferredStrategy: 'FOLLOW_STORY',
          curiosityScore: best.curiosityScore,
          transitionNeeded: false,
          confidence: 0.94
        };
      }

      // Challenge / Problem-Solving Exploration
      if (best.opportunityType === 'challenge') {
        return {
          reasoning: 'EXPLORE_CHALLENGE',
          conversationalGoal: 'understand_challenge',
          curiosityTarget: best,
          targetTopic: best.targetTopic || currentTopic,
          targetSubtopic: best.candidateReference,
          reason: `Investigate how candidate handled the challenge of ${best.candidateReference}.`,
          preferredStrategy: 'EXPLORE_CHALLENGE',
          curiosityScore: best.curiosityScore,
          transitionNeeded: false,
          confidence: 0.93
        };
      }

      // Decision / Trade-off Exploration
      if (best.opportunityType === 'decision') {
        return {
          reasoning: 'EXPLORE_DECISION',
          conversationalGoal: 'explore_technical_decision',
          curiosityTarget: best,
          targetTopic: best.targetTopic || currentTopic,
          targetSubtopic: best.candidateReference,
          reason: `Explore reasoning and alternatives considered for choosing ${best.candidateReference}.`,
          preferredStrategy: 'EXPLORE_DECISION',
          curiosityScore: best.curiosityScore,
          transitionNeeded: false,
          confidence: 0.91
        };
      }

      // Candidate Technology Story Deep Dive
      if (best.opportunityType === 'technology' || best.opportunityType === 'project') {
        return {
          reasoning: 'FOLLOW_STORY',
          conversationalGoal: interviewType === 'behavioral' ? 'understand_behavioral_action' : 'understand_candidate_reasoning',
          curiosityTarget: best,
          targetTopic: best.candidateReference,
          targetSubtopic: 'Internal Architecture',
          reason: `Follow candidate's narrative thread into ${best.candidateReference}.`,
          preferredStrategy: 'FOLLOW_STORY',
          curiosityScore: best.curiosityScore,
          transitionNeeded: false,
          confidence: 0.89
        };
      }
    }

    // 7. Default: Follow Story / Deepen Technical Detail
    return {
      reasoning: 'FOLLOW_STORY',
      conversationalGoal: interviewType === 'behavioral' ? 'understand_behavioral_action' : 'understand_candidate_reasoning',
      curiosityTarget: { candidateReference: currentTopic, curiosityScore: 0.82 },
      targetTopic: currentTopic,
      targetSubtopic: 'Implementation Details',
      reason: 'Continue exploring candidate reasoning on current competency thread.',
      preferredStrategy: 'FOLLOW_STORY',
      transitionNeeded: false,
      confidence: 0.82
    };
  }

  /**
   * Extracts curiosity opportunities from answer understanding and conversation state
   */
  static extractCuriosityOpportunities({
    answerUnderstanding = {},
    conversationMemory = {},
    storyThreads = [],
    currentTopic = 'General',
    currentDepth = 1
  }) {
    const list = [];
    const memory = conversationMemory || {};
    const insight = answerUnderstanding || {};

    // 1. Pride markers
    if (insight.prideMarkers && insight.claims && insight.claims.length > 0) {
      list.push({
        candidateReference: insight.claims[0],
        opportunityType: 'pride_moment',
        preferredStrategy: 'FOLLOW_STORY',
        curiosityScore: this.calculateCuriosityScore({
          interestingness: 0.98,
          difficulty: 0.95,
          specificity: 0.95,
          candidateOwnership: 0.98,
          challengeRelevance: 0.90,
          decisionRelevance: 0.90,
          unresolved: 0.90,
          depth: 0.90
        }),
        targetTopic: currentTopic
      });
    }

    // 2. Challenges & Bottlenecks
    (insight.challenges || []).forEach(ch => {
      const priorDepth = memory.depthByTopic?.[ch] || 0;
      list.push({
        candidateReference: ch,
        opportunityType: 'challenge',
        preferredStrategy: 'EXPLORE_CHALLENGE',
        depthScore: Math.max(0.1, 1 - (priorDepth * 0.25)),
        curiosityScore: this.calculateCuriosityScore({
          interestingness: 0.92,
          difficulty: 0.90,
          specificity: 0.88,
          candidateOwnership: 0.85,
          challengeRelevance: 0.95,
          decisionRelevance: 0.75,
          unresolved: 0.85,
          depth: 1 - (priorDepth * 0.2)
        }),
        targetTopic: currentTopic
      });
    });

    // 3. Decisions & Choices
    (insight.decisions || []).forEach(dec => {
      const choice = typeof dec === 'string' ? dec : dec.choice;
      const priorDepth = memory.depthByTopic?.[choice] || 0;
      list.push({
        candidateReference: choice,
        opportunityType: 'decision',
        preferredStrategy: 'EXPLORE_DECISION',
        depthScore: Math.max(0.1, 1 - (priorDepth * 0.25)),
        curiosityScore: this.calculateCuriosityScore({
          interestingness: 0.88,
          difficulty: 0.80,
          specificity: 0.85,
          candidateOwnership: 0.85,
          challengeRelevance: 0.70,
          decisionRelevance: 0.92,
          unresolved: 0.80,
          depth: 1 - (priorDepth * 0.2)
        }),
        targetTopic: currentTopic
      });
    });

    // 4. Ownership clarification
    if (insight.ownership === 'team' && insight.claims && insight.claims.length > 0) {
      list.push({
        candidateReference: insight.claims[0],
        opportunityType: 'ownership',
        preferredStrategy: 'CLARIFY_OWNERSHIP',
        curiosityScore: 0.86,
        targetTopic: currentTopic
      });
    }

    // 5. Technologies & Projects
    (insight.technologies || []).forEach(tech => {
      const priorDepth = memory.depthByTopic?.[tech] || 0;
      list.push({
        candidateReference: tech,
        opportunityType: 'technology',
        preferredStrategy: 'FOLLOW_STORY',
        depthScore: Math.max(0.1, 1 - (priorDepth * 0.3)),
        curiosityScore: this.calculateCuriosityScore({
          interestingness: 0.80,
          difficulty: 0.75,
          specificity: 0.85,
          candidateOwnership: 0.80,
          challengeRelevance: 0.65,
          decisionRelevance: 0.70,
          unresolved: 0.75,
          depth: 1 - (priorDepth * 0.3)
        }),
        targetTopic: tech
      });
    });

    (insight.projects || []).forEach(proj => {
      list.push({
        candidateReference: proj,
        opportunityType: 'project',
        preferredStrategy: 'FOLLOW_STORY',
        depthScore: 0.9,
        curiosityScore: 0.89,
        targetTopic: proj
      });
    });

    return list;
  }

  /**
   * Scores an individual opportunity using the human curiosity formula
   */
  static calculateCuriosityScore({
    interestingness = 0.8,
    difficulty = 0.7,
    specificity = 0.8,
    candidateOwnership = 0.8,
    challengeRelevance = 0.7,
    decisionRelevance = 0.7,
    unresolved = 0.8,
    depth = 0.8
  } = {}) {
    const raw = (
      interestingness * 0.20 +
      difficulty * 0.15 +
      specificity * 0.15 +
      candidateOwnership * 0.15 +
      challengeRelevance * 0.10 +
      decisionRelevance * 0.10 +
      unresolved * 0.08 +
      depth * 0.07
    );
    return Math.round(Math.min(1.0, Math.max(0, raw)) * 100) / 100;
  }

  /**
   * Sorts opportunities descending by curiosity score and recency/depth
   */
  static rankOpportunities(opportunities = []) {
    if (!Array.isArray(opportunities) || opportunities.length === 0) return [];

    return [...opportunities].sort((a, b) => {
      const scoreA = (a.curiosityScore || 0) * (a.depthScore !== undefined ? a.depthScore : 1);
      const scoreB = (b.curiosityScore || 0) * (b.depthScore !== undefined ? b.depthScore : 1);
      return scoreB - scoreA;
    });
  }

  static selectNextCoverageDomain(targetRole, discussedTopics = []) {
    const roleDomains = {
      'Full Stack Developer': ['Frontend & UI', 'Backend Architecture', 'Database & Indexing', 'API Design & Auth', 'Security & Resilience', 'System Architecture'],
      'Java Developer': ['Core Java & OOP', 'Concurrency & Collections', 'Spring Framework', 'Database & Transactions', 'JVM Internals', 'System Design'],
      'Python Developer': ['Python Fundamentals', 'Async & Web Frameworks', 'Data Structures & Algorithms', 'Database & Caching', 'Performance & Profiling'],
      'Frontend Developer': ['React Architecture', 'State Management', 'CSS & Web Vitals', 'Testing & Build Tools', 'Browser Performance'],
      'Backend Developer': ['API Design & REST', 'Database Optimization', 'Microservices & Distributed Systems', 'Auth & Security', 'Message Queues'],
      'Data Scientist': ['Machine Learning Algorithms', 'Data Preprocessing', 'Model Evaluation & Metrics', 'Python/SQL Pipelines', 'Deep Learning & NLP']
    };

    const domains = roleDomains[targetRole] || ['Architecture', 'Core Principles', 'Database & Persistence', 'Security', 'Testing'];
    const unvisited = domains.filter(d => !discussedTopics.some(dt => dt.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(dt.toLowerCase())));
    return unvisited.length > 0 ? unvisited[0] : domains[0];
  }
}

module.exports = InterviewerReasoningEngine;
