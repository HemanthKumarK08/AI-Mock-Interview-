// Fallback Provider for MockInterviewAI (Phase 8)
// Integrates contextual fallback generation for intelligent conversation turns

const ContextualFallbackGenerator = require('../conversation/contextualFallbackGenerator');

class FallbackProvider {
  static generateInterviewTurn(context) {
    const turnResult = ContextualFallbackGenerator.generateTurn(context);

    return {
      question: turnResult.question,
      questionType: turnResult.questionType || 'technical',
      topic: turnResult.topic || 'General',
      subtopic: turnResult.subtopic || null,
      intent: turnResult.intent || 'TECHNICAL_PROBE',
      difficulty: turnResult.difficulty || context.difficulty || 'intermediate',
      isFollowUp: turnResult.isFollowUp || false,
      shouldContinue: turnResult.shouldContinue !== false,
      candidateRef: turnResult.candidateRef || null,
      metadata: {
        provider: 'contextual_fallback',
        intent: turnResult.intent || 'TECHNICAL_PROBE',
        isFallback: true,
        ...(turnResult.metadata || {})
      }
    };
  }
}

module.exports = FallbackProvider;
