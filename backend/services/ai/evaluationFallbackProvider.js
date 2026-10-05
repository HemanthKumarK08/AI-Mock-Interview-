const AnswerUnderstandingService = require('../conversation/answerUnderstandingService');

class EvaluationFallbackProvider {
  static evaluateAnswer(context) {
    const {
      targetRole = 'Software Engineer',
      interviewType = 'technical',
      difficulty = 'intermediate',
      question = '',
      questionType = 'technical',
      topic = 'General',
      studentAnswer = '',
      answerUnderstanding = null
    } = context;

    const trimmed = (studentAnswer || '').trim();
    const isBehavioral = questionType === 'behavioral' || interviewType === 'behavioral';
    const isHr = questionType === 'hr' || interviewType === 'hr';

    // 1. Empty or Non-Response
    if (!trimmed || trimmed.length < 3) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 0.0,
        relevance: 0.0,
        completeness: 0.0,
        clarity: 0.0,
        communication: 0.0,
        strengths: ['No response was provided'],
        weaknesses: ['The candidate did not provide an answer to the question asked'],
        improvementSuggestion: 'Provide a substantive response to demonstrate your knowledge and experience.',
        evaluationConfidence: 0.95,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? 0.0 : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'EMPTY',
          knowledgeDemonstrated: false,
          ownershipDemonstrated: false,
          evidenceLevel: 'NONE',
          fallbackReason: 'EMPTY_ANSWER'
        }
      };
    }

    const lowerAnswer = trimmed.toLowerCase();
    const lowerQuestion = (question || '').toLowerCase();

    // 2. Adversarial / Prompt Injection detection
    const isInjectionAttempt = /(ignore\s+(all\s+|previous\s+)?instructions|give\s+me\s+10|rate\s+me\s+10|score\s*:\s*10|system\s+prompt|reveal\s+instructions)/i.test(lowerAnswer);
    if (isInjectionAttempt) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 1.0,
        relevance: 1.0,
        completeness: 1.0,
        clarity: 4.0,
        communication: 4.0,
        strengths: ['Input was received and processed safely'],
        weaknesses: [
          'The response did not answer the specific interview question',
          'Off-topic or adversarial prompt commands do not demonstrate subject matter competency'
        ],
        improvementSuggestion: 'Focus directly on answering the technical concept, architecture, or professional experience asked.',
        evaluationConfidence: 0.95,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? 1.0 : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'INJECTION_ATTEMPT',
          knowledgeDemonstrated: false,
          ownershipDemonstrated: false,
          evidenceLevel: 'NONE',
          fallbackReason: 'INJECTION_ATTEMPT_RESISTED'
        }
      };
    }

    // Extract Answer Understanding
    const insight = answerUnderstanding || AnswerUnderstandingService.analyzeAnswer({
      studentAnswer: trimmed,
      question,
      questionTopic: topic,
      turnNumber: 1
    });

    // 3. Candidate Uncertainty / Non-Implementation / Knowledge Gap / Refusal / Pivot
    const isExplicitNonImplementation = /(?:didn'?t|did not|never|haven'?t|have not)\s+(?:implement|build|develop|create|do|touch|write|work on)|(?:have not done any implementation|haven'?t done any implementation|not done any implementation|didn'?t do any implementation)/i.test(lowerAnswer);
    const isExplicitUncertaintyOrPivot = insight.isUncertain || insight.intent === 'UNCERTAIN' ||
      /(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)|(?:i don'?t know|dont know|no idea|not sure|not familiar|haven'?t worked|don'?t remember|no experience|never used|cannot answer)/i.test(lowerAnswer);

    if (isExplicitNonImplementation || isExplicitUncertaintyOrPivot) {
      if (isExplicitNonImplementation) {
        return {
          technicalAccuracy: isBehavioral || isHr ? null : 1.5,
          relevance: 3.5,
          completeness: 1.5,
          clarity: 7.5,
          communication: 7.0,
          strengths: ['Honestly communicated project boundaries and personal implementation scope'],
          weaknesses: ['Did not demonstrate hands-on implementation experience for this specific topic'],
          improvementSuggestion: 'When you have not personally implemented a feature, clearly highlight the related components you did build and describe how your work integrated with the broader system.',
          evaluationConfidence: 0.95,
          star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
          starCompleteness: isBehavioral ? 1.5 : null,
          evaluationSource: 'fallback',
          metadata: {
            answerIntent: 'NON_IMPLEMENTATION',
            knowledgeDemonstrated: false,
            ownershipDemonstrated: false,
            evidenceLevel: 'NONE',
            fallbackReason: 'NON_IMPLEMENTATION'
          }
        };
      }

      // General uncertainty / knowledge gap / pivot request
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 1.5,
        relevance: 3.0,
        completeness: 1.5,
        clarity: 7.5,
        communication: 6.5,
        strengths: ['Acknowledged knowledge boundaries directly rather than providing fabricated or misleading technical claims'],
        weaknesses: ['Did not demonstrate conceptual or practical understanding of the requested topic'],
        improvementSuggestion: 'Review fundamental concepts and practical trade-offs for this area to build confidence for future technical discussions.',
        evaluationConfidence: 0.95,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? 1.5 : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'UNCERTAIN',
          knowledgeDemonstrated: false,
          ownershipDemonstrated: false,
          evidenceLevel: 'NONE',
          fallbackReason: 'UNCERTAINTY_KNOWLEDGE_GAP'
        }
      };
    }

    // 4. Factually Incorrect Technical Misconceptions
    const isJwtMisconception = /(jwt|json web token).*?(is a database|stores? (?:user )?passwords?|database used to|database to store)/i.test(lowerAnswer);
    const isSqlMisconception = /\bsql\b.*?(operating system|create os|make games|compiler)/i.test(lowerAnswer);
    const isHtmlMisconception = /\bhtml\b.*?(backend|database query|database management)/i.test(lowerAnswer);

    if (isJwtMisconception || isSqlMisconception || isHtmlMisconception) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 2.0,
        relevance: 4.0,
        completeness: 2.5,
        clarity: 6.5,
        communication: 6.0,
        strengths: ['Attempted to define the concept'],
        weaknesses: ['Contained a fundamental factual inaccuracy regarding the core purpose and architecture of the technology'],
        improvementSuggestion: 'Review the fundamental definition and architecture of this technology to ensure accurate technical explanations.',
        evaluationConfidence: 0.90,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? 2.0 : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'FACTUALLY_INCORRECT',
          knowledgeDemonstrated: false,
          ownershipDemonstrated: false,
          evidenceLevel: 'LOW',
          fallbackReason: 'FACTUAL_MISCONCEPTION'
        }
      };
    }

    // 5. Completely Off-Topic / Unrelated Answers
    const isOffTopicPhrasing = /(?:favorite food|pizza|weather is|movies?|my hobby|hobbies|weekend|sports)/i.test(lowerAnswer);
    const questionTokens = (lowerQuestion.match(/\b[a-z]{3,}\b/g) || [])
      .filter(t => !['what', 'when', 'where', 'which', 'explain', 'describe', 'difference', 'between', 'your', 'about', 'with', 'from', 'this', 'that', 'have', 'does', 'stand', 'tell'].includes(t));

    let matchedTokens = 0;
    questionTokens.forEach(token => {
      if (lowerAnswer.includes(token)) {
        matchedTokens++;
      }
    });

    const matchRatio = questionTokens.length > 0 ? matchedTokens / questionTokens.length : 0.5;

    if (isOffTopicPhrasing && matchRatio === 0 && (insight.technologies || []).length === 0) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 1.0,
        relevance: 1.0,
        completeness: 1.0,
        clarity: 6.0,
        communication: 4.0,
        strengths: ['Sentence was grammatically structured'],
        weaknesses: ['The response was completely off-topic and unrelated to the interview question asked'],
        improvementSuggestion: 'Ensure your response directly addresses the question and technical subject asked.',
        evaluationConfidence: 0.95,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? 1.0 : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'OFF_TOPIC',
          knowledgeDemonstrated: false,
          ownershipDemonstrated: false,
          evidenceLevel: 'NONE',
          fallbackReason: 'OFF_TOPIC'
        }
      };
    }

    // 6. Concise Correct Answer (Definition / Acronym / Principle)
    const isSqlDef = /structured query language/i.test(lowerAnswer);
    const isPolymorphismDef = /(?:allows? (?:the same )?interface|different (?:objects|implementations|forms)|same interface to have different|many forms)/i.test(lowerAnswer);
    const isRestDef = /(?:representational state transfer|stateless|http methods|resources)/i.test(lowerAnswer) && /rest/i.test(lowerQuestion);
    const isBigODef = /(?:upper bound|worst-case|time complexity|space complexity|asymptotic)/i.test(lowerAnswer) && /big-o|complexity/i.test(lowerQuestion);
    const isCssDef = /cascading style sheets/i.test(lowerAnswer);

    const isConciseDefinitionQuestion = /what does .*? stand for|what is (?:sql|polymorphism|big-o|css|rest|jwt)/i.test(lowerQuestion);
    const isConciseCorrect = isSqlDef || isPolymorphismDef || isCssDef || (isConciseDefinitionQuestion && (isRestDef || isBigODef));

    if (isConciseCorrect && trimmed.length < 120) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : 9.0,
        relevance: 9.5,
        completeness: 8.5,
        clarity: 9.0,
        communication: 8.5,
        strengths: ['Accurate, concise, and direct definition without unnecessary filler'],
        weaknesses: [],
        improvementSuggestion: 'To demonstrate comprehensive depth, follow concise definitions with a brief real-world example or trade-off.',
        evaluationConfidence: 0.90,
        star: isBehavioral ? { situation: false, task: false, action: false, result: false } : null,
        starCompleteness: isBehavioral ? null : null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'CONCISE_CORRECT',
          knowledgeDemonstrated: true,
          ownershipDemonstrated: false,
          evidenceLevel: 'MODERATE',
          fallbackReason: 'CONCISE_CORRECT_DEFINITION'
        }
      };
    }

    // 7. Behavioral STAR Analysis
    if (isBehavioral) {
      const hasSituation = /(when|project|team|company|situation|time when|at my|during|while working)/i.test(lowerAnswer);
      const hasTask = /(task|goal|responsible|challenge|needed to|had to|objective|problem was)/i.test(lowerAnswer);
      const hasAction = /(i |we |implemented|designed|created|led|resolved|handled|developed|built|took action|decided)/i.test(lowerAnswer);
      const hasResult = /(result|outcome|finally|succeeded|improved|reduced|increased|achieved|learned|boosted|resolved)/i.test(lowerAnswer);

      const star = {
        situation: hasSituation,
        task: hasTask,
        action: hasAction,
        result: hasResult
      };

      const starCount = (hasSituation ? 1 : 0) + (hasTask ? 1 : 0) + (hasAction ? 1 : 0) + (hasResult ? 1 : 0);
      const starCompleteness = parseFloat((starCount * 2.5).toFixed(1));

      const strengths = [];
      if (hasSituation && hasAction) strengths.push('Clearly outlined the context and specific actions taken');
      if (hasResult) strengths.push('Articulated the final result and positive outcome achieved');
      if (strengths.length === 0) strengths.push('Communicated a structured behavioral experience');

      const weaknesses = [];
      if (!hasResult) weaknesses.push('Did not explicitly describe the quantifiable outcome or long-term impact');
      if (!hasTask) weaknesses.push('Could clarify your specific responsibility versus team responsibility');

      const improvementSuggestion = !hasResult
        ? 'Structure your story using STAR and make sure to highlight the concrete business outcome or metrics achieved.'
        : 'Highlight quantifiable metrics and personal ownership to further strengthen your behavioral examples.';

      return {
        technicalAccuracy: null,
        relevance: Math.min(10.0, Math.max(5.0, parseFloat((6.0 + starCount * 1.0).toFixed(1)))),
        completeness: Math.min(10.0, Math.max(4.0, starCompleteness)),
        clarity: 8.5,
        communication: 8.5,
        strengths,
        weaknesses,
        improvementSuggestion,
        evaluationConfidence: 0.85,
        star,
        starCompleteness,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'BEHAVIORAL_STAR',
          knowledgeDemonstrated: true,
          ownershipDemonstrated: hasAction,
          evidenceLevel: starCount >= 3 ? 'HIGH' : 'MODERATE',
          fallbackReason: 'BEHAVIORAL_STAR_EVALUATION'
        }
      };
    }

    // 8. HR Evaluation
    if (isHr) {
      const strengths = ['Articulated motivation, culture alignment, and professional perspective clearly'];
      return {
        technicalAccuracy: null,
        relevance: Math.min(9.5, Math.max(7.0, parseFloat((7.5 + matchRatio * 2.0).toFixed(1)))),
        completeness: Math.min(9.5, Math.max(6.5, parseFloat((6.5 + (trimmed.length > 50 ? 2.0 : 1.0)).toFixed(1)))),
        clarity: 8.8,
        communication: 8.8,
        strengths,
        weaknesses: [],
        improvementSuggestion: 'Connect your career objectives and previous achievements directly to company mission and team goals.',
        evaluationConfidence: 0.85,
        star: null,
        starCompleteness: null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'HR_CULTURE_FIT',
          knowledgeDemonstrated: true,
          ownershipDemonstrated: true,
          evidenceLevel: 'HIGH',
          fallbackReason: 'HR_EVALUATION'
        }
      };
    }

    // 9. Strong vs Partial Technical Answers
    const hasArchitecturalMechanisms = /(?:stateless|endpoints?|resources?|http verbs?|status codes?|authentication tokens?|indexing|caching|concurrency|transactions|acid|microservices?|pub\/sub|middleware|g1|zgc|garbage collection)/i.test(lowerAnswer);
    const hasDetailedKnowledge = (insight.decisions && insight.decisions.length > 0) ||
      (insight.challenges && insight.challenges.length > 0) ||
      ((insight.technologies || []).length >= 2 && trimmed.length > 60) ||
      (hasArchitecturalMechanisms && trimmed.length > 70) ||
      (matchRatio >= 0.4 && trimmed.length > 80);

    if (hasDetailedKnowledge) {
      const strengths = [
        'Demonstrated strong technical understanding and architectural concepts'
      ];
      if (insight.decisions?.length > 0) strengths.push('Articulated technical choices and rationale clearly');
      if (insight.challenges?.length > 0) strengths.push('Discussed practical troubleshooting and problem-solving approaches');

      return {
        technicalAccuracy: isBehavioral || isHr ? null : Math.min(9.8, parseFloat((8.6 + matchRatio * 0.8).toFixed(1))),
        relevance: Math.min(10.0, parseFloat((8.8 + matchRatio * 0.8).toFixed(1))),
        completeness: Math.min(9.6, parseFloat((8.2 + (trimmed.length > 100 ? 1.0 : 0.5)).toFixed(1))),
        clarity: 8.8,
        communication: 8.8,
        strengths,
        weaknesses: [],
        improvementSuggestion: 'Continue providing structured technical explanations with concrete production trade-offs.',
        evaluationConfidence: 0.85,
        star: null,
        starCompleteness: null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'STRONG',
          knowledgeDemonstrated: true,
          ownershipDemonstrated: true,
          evidenceLevel: 'HIGH',
          fallbackReason: 'STRONG_TECHNICAL_ANSWER'
        }
      };
    }

    // Partial Technical Answer
    const hasPartialKnowledge = matchRatio >= 0.2 || (insight.technologies || []).length > 0 || trimmed.length > 30;
    if (hasPartialKnowledge) {
      return {
        technicalAccuracy: isBehavioral || isHr ? null : Math.min(7.5, Math.max(5.5, parseFloat((5.5 + matchRatio * 2.0).toFixed(1)))),
        relevance: Math.min(8.5, Math.max(6.5, parseFloat((6.5 + matchRatio * 2.0).toFixed(1)))),
        completeness: Math.min(6.5, Math.max(4.5, parseFloat((4.5 + (trimmed.length > 60 ? 1.5 : 0.5)).toFixed(1)))),
        clarity: 7.8,
        communication: 7.8,
        strengths: ['Correctly identified fundamental concepts and technical keywords'],
        weaknesses: ['Omitted deeper architectural constraints, failure modes, or design trade-offs'],
        improvementSuggestion: 'Broaden your explanation by discussing architectural constraints, trade-offs, and practical integration details.',
        evaluationConfidence: 0.80,
        star: null,
        starCompleteness: null,
        evaluationSource: 'fallback',
        metadata: {
          answerIntent: 'PARTIAL',
          knowledgeDemonstrated: true,
          ownershipDemonstrated: false,
          evidenceLevel: 'MODERATE',
          fallbackReason: 'PARTIAL_TECHNICAL_ANSWER'
        }
      };
    }

    // Default basic response
    return {
      technicalAccuracy: isBehavioral || isHr ? null : 4.5,
      relevance: 5.0,
      completeness: 4.0,
      clarity: 6.5,
      communication: 6.5,
      strengths: ['Communicated core thought clearly'],
      weaknesses: ['Could link the response more tightly to the query'],
      improvementSuggestion: 'Structure your answer by defining the core concept, discussing trade-offs, and illustrating with a specific example.',
      evaluationConfidence: 0.70,
      star: null,
      starCompleteness: null,
      evaluationSource: 'fallback',
      metadata: {
        answerIntent: 'BASIC',
        knowledgeDemonstrated: false,
        ownershipDemonstrated: false,
        evidenceLevel: 'LOW',
        fallbackReason: 'BASIC_FALLBACK'
      }
    };
  }
}

module.exports = EvaluationFallbackProvider;

