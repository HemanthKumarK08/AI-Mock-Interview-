// Contextual Fallback Generator for MockInterviewAI (Phase 8 & 9)
// Generates intelligent, human-like, context-aware questions referencing candidate answers when AI provider is in fallback mode

const { getFallbackQuestion } = require('../../data/questionBank');

class ContextualFallbackGenerator {
  static generateTurn(context) {
    const {
      targetRole = 'Full Stack Developer',
      interviewType = 'technical',
      difficulty = 'intermediate',
      turnNumber = 1,
      strategy = {},
      latestInsight = {},
      memory = {},
      conversationHistory = []
    } = context;

    // Turn 1: Role Opening / Project Invitation
    if (turnNumber === 1 || conversationHistory.length === 0) {
      if (interviewType === 'behavioral') {
        return {
          question: 'Hello and welcome. To start off, could you tell me about a recent project you contributed to and the specific role you played?',
          questionType: 'behavioral',
          topic: 'Project Overview & Role',
          difficulty,
          intent: 'OPENING',
          isFollowUp: false,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'OPENING' }
        };
      } else if (interviewType === 'hr') {
        return {
          question: `Welcome to your interview. Could you introduce yourself and explain what motivates you to pursue a career as a ${targetRole}?`,
          questionType: 'hr',
          topic: 'Introduction & Motivation',
          difficulty,
          intent: 'OPENING',
          isFollowUp: false,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'OPENING' }
        };
      }

      // Technical opening
      return {
        question: `Hello! To begin our interview for the ${targetRole} role, could you tell me about a significant project you built and the core technologies you used?`,
        questionType: 'technical',
        topic: 'Project Architecture & Tech Stack',
        difficulty,
        intent: 'OPENING',
        isFollowUp: false,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'OPENING' }
      };
    }

    // Turn 2+: Humanized Contextual Follow-up based on Reasoning Plan, Strategy & Answer Insight
    const reasoningPlan = context.reasoningPlan || {};
    const intent = reasoningPlan.preferredStrategy || strategy.intent || 'DEEP_DIVE';
    const activeTopic = strategy.targetTopic || reasoningPlan.targetTopic || latestInsight.entities?.[0] || 'General';
    const lastAnswer = (conversationHistory[conversationHistory.length - 1]?.student_answer || '').trim();
    const candidateRef = reasoningPlan.curiosityTarget?.candidateReference || strategy.candidateRef || '';
    const isUncertain = latestInsight.isUncertain || latestInsight.intent === 'UNCERTAIN' ||
      /(?:didn'?t|did not|never|haven'?t)\s+(?:implement|build|develop|create|do|touch|work on)|(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)|(?:i don'?t know|dont know|no idea|not sure|not familiar|haven'?t worked|don'?t remember)/i.test(lastAnswer);

    // 1. Candidate Uncertainty / Non-Implementation / Pivot Request -> Supportive Pivot (CRITICAL)
    if (intent === 'SUPPORTIVE_PIVOT' || isUncertain) {
      const isNonImplOrPivotRequest = /(?:didn'?t|did not|never|haven'?t)\s+(?:implement|build|develop|create|do|touch|work on)|(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)/i.test(lastAnswer);
      const knownTech = (memory.candidateTechnologies || []).find(t => t.toLowerCase() !== activeTopic.toLowerCase());
      let pivotQuestion = "That's completely fine. Let's move to something you've worked on directly. What part of the project did you personally implement?";
      if (isNonImplOrPivotRequest) {
        pivotQuestion = "No problem at all. Let's pivot to something you worked on directly. Which part of the project did you personally implement?";
      } else if (knownTech) {
        pivotQuestion = `That's okay. Let's talk about something you're more familiar with, such as ${knownTech}. What was your personal contribution there?`;
      } else if (/database|mongodb|sql/i.test(lastAnswer)) {
        pivotQuestion = "No problem. Which database or persistence technology have you actually worked with in your projects?";
      }

      return {
        question: pivotQuestion,
        questionType: 'follow_up',
        topic: knownTech || 'Personal Contribution',
        difficulty,
        intent: 'SUPPORTIVE_PIVOT',
        conversationalGoal: 'supportive_pivot',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'SUPPORTIVE_PIVOT', candidateRef: 'personal contribution' }
      };
    }

    // 2. Challenge / Bottleneck / Failure Follow-Up
    if (intent === 'EXPLORE_CHALLENGE' || intent === 'CHALLENGE' || (latestInsight.challenges && latestInsight.challenges.length > 0 && (intent !== 'DECISION' && intent !== 'EXPLORE_DECISION' && intent !== 'RESULT' && intent !== 'EXPLORE_RESULT'))) {
      const challenge = latestInsight.challenges?.[0] || candidateRef || strategy.subtopic || 'the obstacle you encountered';
      
      if (/stop.*early|premature|thinking pause/i.test(lastAnswer)) {
        return {
          question: 'How did you handle those premature stops and prevent short thinking pauses from cutting off the recording?',
          questionType: 'follow_up',
          topic: 'Voice Activity Detection',
          difficulty,
          intent: 'EXPLORE_CHALLENGE',
          conversationalGoal: 'understand_challenge',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_CHALLENGE', subtopic: 'Thinking pauses' }
        };
      }

      if (/increase.*threshold|higher threshold/i.test(lastAnswer)) {
        return {
          question: 'Did increasing the silence threshold create any new challenges with latency or user responsiveness?',
          questionType: 'follow_up',
          topic: 'Voice Activity Detection',
          difficulty,
          intent: 'EXPLORE_CHALLENGE',
          conversationalGoal: 'understand_challenge',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_CHALLENGE', subtopic: 'Silence threshold' }
        };
      }

      if (/timeout|gemini|api/i.test(challenge) || /timeout|gemini|api/i.test(lastAnswer)) {
        return {
          question: 'What did you do when the AI model timed out, and how did your fallback strategy decide when to switch?',
          questionType: 'follow_up',
          topic: 'Resilience & Error Handling',
          difficulty,
          intent: 'EXPLORE_CHALLENGE',
          conversationalGoal: 'understand_challenge',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_CHALLENGE', subtopic: challenge }
        };
      }

      if (/voice|vad|silence|recording/i.test(challenge) || /voice|vad|silence/i.test(lastAnswer)) {
        return {
          question: 'What specifically made the voice interaction difficult, and how did you decide when the candidate had finished speaking?',
          questionType: 'follow_up',
          topic: 'Voice Activity Detection',
          difficulty,
          intent: 'EXPLORE_CHALLENGE',
          conversationalGoal: 'understand_challenge',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_CHALLENGE', subtopic: 'Voice detection' }
        };
      }

      return {
        question: `You highlighted a challenge regarding ${challenge}. What steps did you take to troubleshoot and resolve that problem?`,
        questionType: 'follow_up',
        topic: 'Problem Solving & Resilience',
        difficulty,
        intent: intent === 'CHALLENGE' ? 'CHALLENGE' : 'EXPLORE_CHALLENGE',
        conversationalGoal: 'understand_challenge',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: intent === 'CHALLENGE' ? 'CHALLENGE' : 'EXPLORE_CHALLENGE', subtopic: challenge }
      };
    }

    // 3. Decision / Why / Tradeoff Follow-Up
    if (intent === 'EXPLORE_DECISION' || intent === 'EXPLORE_WHY' || intent === 'DECISION' || (latestInsight.decisions && latestInsight.decisions.length > 0)) {
      const decision = latestInsight.decisions?.[0]?.choice || candidateRef || activeTopic || 'that technology';
      return {
        question: `Why did you select ${decision} for this implementation, and what trade-offs did you consider against other alternatives?`,
        questionType: 'follow_up',
        topic: 'Architectural Decisions',
        difficulty,
        intent: intent === 'DECISION' ? 'DECISION' : 'EXPLORE_DECISION',
        conversationalGoal: 'explore_technical_decision',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: intent === 'DECISION' ? 'DECISION' : 'EXPLORE_DECISION', subtopic: decision }
      };
    }

    // 4. Result / Outcome Follow-Up
    if (intent === 'EXPLORE_RESULT' || intent === 'RESULT' || (latestInsight.results && latestInsight.results.length > 0)) {
      const result = latestInsight.results?.[0] || 'the improvement';
      return {
        question: `What difference did ${result} make for the overall user experience and system reliability?`,
        questionType: 'follow_up',
        topic: 'Outcomes & Metrics',
        difficulty,
        intent: 'EXPLORE_RESULT',
        conversationalGoal: 'verify_result',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_RESULT', subtopic: result }
      };
    }

    // 5. Candidate-Owned Topic (Candidate introduced a new focal area like voice detection)
    if (intent === 'FOLLOW_CANDIDATE_TOPIC' || intent === 'CANDIDATE_TOPIC' || (latestInsight.candidateOwnedTopic && intent !== 'DEEP_DIVE' && intent !== 'FOLLOW_STORY')) {
      const candidateTopic = latestInsight.candidateOwnedTopic || candidateRef || activeTopic;
      return {
        question: `What specifically made ${candidateTopic} challenging to build, and how did you approach solving it?`,
        questionType: 'follow_up',
        topic: candidateTopic,
        difficulty,
        intent: 'FOLLOW_CANDIDATE_TOPIC',
        conversationalGoal: 'understand_candidate_reasoning',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'FOLLOW_CANDIDATE_TOPIC', candidateRef: candidateTopic }
      };
    }

    // 6. Candidate Struggling / Simplification
    if (intent === 'SIMPLIFY') {
      return {
        question: `That's okay. At a high level, what was your general approach to ${activeTopic}?`,
        questionType: 'follow_up',
        topic: activeTopic,
        difficulty,
        intent: 'SIMPLIFY',
        conversationalGoal: 'simplify_concept',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'SIMPLIFY', candidateRef: activeTopic }
      };
    }

    // 7. Ownership Clarification (when explicitly requested by reasoning plan)
    if (intent === 'CLARIFY_OWNERSHIP') {
      return {
        question: candidateRef
          ? `You mentioned working on ${candidateRef} with your team. What part of that implementation did you personally design and build?`
          : 'You mentioned your team worked on that system. What specific component did you personally own and implement?',
        questionType: 'follow_up',
        topic: activeTopic,
        difficulty,
        intent: 'CLARIFY_OWNERSHIP',
        conversationalGoal: 'clarify_ownership',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'CLARIFY_OWNERSHIP', candidateRef }
      };
    }

    // 8. Contradiction Clarification
    if (intent === 'EXPLORE_CONTRADICTION' || intent === 'CONTRADICTION') {
      return {
        question: 'Earlier in our conversation you mentioned using MongoDB, but you also referenced a MySQL database schema. Could you clarify how both databases fit into your project architecture?',
        questionType: 'follow_up',
        topic: 'Database Architecture',
        difficulty,
        intent: intent === 'CONTRADICTION' ? 'CONTRADICTION' : 'EXPLORE_CONTRADICTION',
        conversationalGoal: 'clarify_contradiction',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: intent === 'CONTRADICTION' ? 'CONTRADICTION' : 'EXPLORE_CONTRADICTION', candidateRef: strategy.candidateRef }
      };
    }

    // 9. Vague Answer Clarification (Only when not uncertain)
    if ((intent === 'CLARIFY' || intent === 'CLARIFICATION' || latestInsight.isVague) && !isUncertain) {
      if (lastAnswer.toLowerCase().includes('ai')) {
        return {
          question: 'When you say AI helped improve the system, what specific tasks did the AI perform and how did you integrate it with your backend?',
          questionType: 'follow_up',
          topic: 'AI Integration & Logic',
          difficulty,
          intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION',
          conversationalGoal: 'clarify_ambiguous_statement',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION' }
        };
      } else if (lastAnswer.toLowerCase().includes('performance') || lastAnswer.toLowerCase().includes('fast')) {
        return {
          question: 'You mentioned improving system performance. What specific metrics or bottlenecks did you optimize, and how did you measure the improvement?',
          questionType: 'follow_up',
          topic: 'Performance Optimization',
          difficulty,
          intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION',
          conversationalGoal: 'clarify_ambiguous_statement',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION' }
        };
      } else {
        const isAbstractTopic = /core principles|general|project overview|architecture/i.test(activeTopic);
        const questionText = isAbstractTopic
          ? 'Could you walk me through the high-level architecture or main components of your project?'
          : `Could you give a concrete example of how you approached ${activeTopic} in your implementation?`;
        return {
          question: questionText,
          questionType: 'follow_up',
          topic: isAbstractTopic ? 'Project Architecture' : activeTopic,
          difficulty,
          intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION',
          conversationalGoal: 'clarify_ambiguous_statement',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: intent === 'CLARIFY' ? 'CLARIFY' : 'CLARIFICATION' }
        };
      }
    }

    if (intent === 'EXPLORE_TRADEOFF' || intent === 'TRADEOFF') {
      const target = candidateRef || activeTopic;
      return {
        question: `What tradeoffs or limitations did you encounter when adopting ${target}?`,
        questionType: 'follow_up',
        topic: 'System Tradeoffs',
        difficulty,
        intent: intent === 'TRADEOFF' ? 'TRADEOFF' : 'EXPLORE_TRADEOFF',
        conversationalGoal: 'explore_tradeoff',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: intent === 'TRADEOFF' ? 'TRADEOFF' : 'EXPLORE_TRADEOFF', candidateRef: target }
      };
    }

    // 6. Result / Outcome Follow-Up
    if (intent === 'EXPLORE_RESULT' || (latestInsight.results && latestInsight.results.length > 0)) {
      const result = latestInsight.results?.[0] || 'the improvement';
      return {
        question: `What difference did ${result} make for the overall user experience and system reliability?`,
        questionType: 'follow_up',
        topic: 'Outcomes & Metrics',
        difficulty,
        intent: 'EXPLORE_RESULT',
        conversationalGoal: 'verify_result',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'EXPLORE_RESULT', subtopic: result }
      };
    }

    // 7. Follow Story / Deep Dive
    if (intent === 'FOLLOW_STORY' || intent === 'DEEPEN_TECHNICAL_DETAIL' || intent === 'DEEP_DIVE') {
      const targetEntity = strategy.targetTopic || reasoningPlan.targetTopic || latestInsight.technologies?.[0] || activeTopic;
      const targetIntent = intent === 'DEEP_DIVE' ? 'DEEP_DIVE' : 'FOLLOW_STORY';

      if (/collaborative filtering|recommendation/i.test(targetEntity) || /collaborative/i.test(lastAnswer)) {
        return {
          question: 'You mentioned using collaborative filtering in Python. How did you address the cold-start problem for new users or items?',
          questionType: 'follow_up',
          topic: 'Recommendation Algorithms',
          difficulty,
          intent: targetIntent,
          conversationalGoal: 'understand_candidate_reasoning',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: targetIntent, candidateRef: 'collaborative filtering' }
        };
      } else if (/react/i.test(targetEntity) || /frontend/i.test(targetEntity)) {
        return {
          question: 'You mentioned using React. How did you structure your components and manage shared application state?',
          questionType: 'follow_up',
          topic: 'React Architecture & State',
          difficulty,
          intent: targetIntent,
          conversationalGoal: 'understand_candidate_reasoning',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: targetIntent, candidateRef: targetEntity }
        };
      } else if (/node|express|backend/i.test(targetEntity)) {
        return {
          question: 'Since you worked with Node.js and Express, how did you structure your API routes, middleware, and error handling?',
          questionType: 'follow_up',
          topic: 'Backend API Architecture',
          difficulty,
          intent: targetIntent,
          conversationalGoal: 'understand_candidate_reasoning',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: targetIntent, candidateRef: targetEntity }
        };
      } else if (/mysql|postgres|database|sql/i.test(targetEntity)) {
        return {
          question: 'In your database design with MySQL, how did you handle indexing and query performance for high-traffic tables?',
          questionType: 'follow_up',
          topic: 'Database Optimization',
          difficulty,
          intent: targetIntent,
          conversationalGoal: 'understand_candidate_reasoning',
          isFollowUp: true,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: targetIntent, candidateRef: targetEntity }
        };
      }

      return {
        question: `You mentioned utilizing ${targetEntity}. Could you explain the internal design and how you handled edge cases in that part of the system?`,
        questionType: 'follow_up',
        topic: targetEntity,
        difficulty,
        intent: targetIntent,
        conversationalGoal: 'understand_candidate_reasoning',
        isFollowUp: true,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: targetIntent, candidateRef: targetEntity }
      };
    }

    // 8. Smooth Topic Transition
    if (intent === 'TRANSITION' || strategy.shouldTransition || reasoningPlan.transitionNeeded) {
      const nextTopic = reasoningPlan.targetTopic || strategy.targetTopic || 'API Design & Security';
      const prevTopic = strategy.prevTopic || activeTopic;
      if (/database/i.test(prevTopic) || /mysql/i.test(prevTopic)) {
        return {
          question: 'We\'ve covered your database design and persistence layer. Moving over to security, how did you protect your APIs and manage authentication tokens?',
          questionType: 'technical',
          topic: 'Authentication & Security',
          difficulty,
          intent: 'TRANSITION',
          conversationalGoal: 'transition_topic',
          isFollowUp: false,
          shouldContinue: true,
          metadata: { provider: 'contextual_fallback', intent: 'TRANSITION', prevTopic, targetTopic: nextTopic }
        };
      }

      return {
        question: `Building on what you shared about ${strategy.prevTopic || 'your previous work'}, let's talk about ${nextTopic}. How do you approach this in production applications?`,
        questionType: 'technical',
        topic: nextTopic,
        difficulty,
        intent: 'TRANSITION',
        conversationalGoal: 'transition_topic',
        isFollowUp: false,
        shouldContinue: true,
        metadata: { provider: 'contextual_fallback', intent: 'TRANSITION', targetTopic: nextTopic }
      };
    }

    // 9. Question Bank fallback
    const fallback = getFallbackQuestion({
      role: targetRole,
      interviewType,
      difficulty,
      turnNumber,
      previousQuestions: conversationHistory.map(t => t.question)
    });

    return {
      question: fallback.question,
      questionType: fallback.questionType || 'technical',
      topic: fallback.topic || 'General',
      difficulty: fallback.difficulty || difficulty,
      intent: 'TECHNICAL_PROBE',
      conversationalGoal: 'cover_missing_competency',
      isFollowUp: false,
      shouldContinue: true,
      metadata: { provider: 'contextual_fallback', intent: 'TECHNICAL_PROBE' }
    };
  }
}

module.exports = ContextualFallbackGenerator;
