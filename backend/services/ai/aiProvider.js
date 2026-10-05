const GeminiProvider = require('./geminiProvider');
const FallbackProvider = require('./fallbackProvider');

class AIProvider {
  constructor() {
    this.gemini = new GeminiProvider();
  }

  async generateInterviewTurn(context) {
    if (this.gemini.isConfigured()) {
      try {
        const result = await this.gemini.generateInterviewTurn(context);
        return result;
      } catch (err) {
        console.warn(`[AI Orchestrator] Gemini error: ${err.message}. Activating local fallback provider.`);
        const fallback = FallbackProvider.generateInterviewTurn(context);
        fallback.metadata = {
          provider: 'fallback_bank',
          isFallback: true,
          fallbackReason: err.message
        };
        return fallback;
      }
    } else {
      // Gemini API Key not set - execute guaranteed fallback provider
      const fallback = FallbackProvider.generateInterviewTurn(context);
      fallback.metadata = {
        provider: 'fallback_bank',
        isFallback: true,
        fallbackReason: 'UNCONFIGURED'
      };
      return fallback;
    }
  }

  async evaluateAnswer(context) {
    const EvaluationFallbackProvider = require('./evaluationFallbackProvider');

    if (this.gemini.isConfigured()) {
      try {
        const result = await this.gemini.evaluateAnswer(context);
        return result;
      } catch (err) {
        console.warn(`[AI Orchestrator] Gemini evaluation error: ${err.message}. Activating local fallback evaluation provider.`);
        const fallback = EvaluationFallbackProvider.evaluateAnswer(context);
        fallback.metadata = {
          ...fallback.metadata,
          provider: 'fallback_evaluator',
          isFallback: true,
          fallbackReason: err.message
        };
        return fallback;
      }
    } else {
      const fallback = EvaluationFallbackProvider.evaluateAnswer(context);
      fallback.metadata = {
        ...fallback.metadata,
        provider: 'fallback_evaluator',
        isFallback: true,
        fallbackReason: 'UNCONFIGURED'
      };
      return fallback;
    }
  }
}

// Export singleton instance
module.exports = new AIProvider();
