const { GoogleGenAI } = require('@google/genai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { buildSystemPrompt, buildTurnPrompt } = require('../promptBuilder');

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

class GeminiProvider {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.aiClient = null;

    if (this.apiKey) {
      try {
        this.aiClient = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('[AI] Failed to initialize GoogleGenAI client:', err.message);
      }
    }
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateInterviewTurn(context, attempt = 1) {
    if (!this.isConfigured() || !this.aiClient) {
      throw new Error('GEMINI_API_KEY is not configured in environment');
    }

    const systemPrompt = buildSystemPrompt(context);
    const turnPrompt = buildTurnPrompt(context);

    try {
      const response = await this.callWithTimeout(async () => {
        const result = await this.aiClient.models.generateContent({
          model: this.modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${turnPrompt}` }]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        });
        return result;
      }, DEFAULT_TIMEOUT_MS);

      const rawText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text);
      if (!rawText) {
        throw new Error('Empty response received from Gemini API');
      }

      const parsed = this.parseAndValidateResponse(rawText, context);
      return {
        ...parsed,
        metadata: {
          provider: 'gemini',
          model: this.modelName,
          attempt,
          isFallback: false
        }
      };
    } catch (err) {
      console.warn(`[AI] Gemini attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const backoffMs = attempt * 800;
        await new Promise(r => setTimeout(r, backoffMs));
        return this.generateInterviewTurn(context, attempt + 1);
      }
      throw err;
    }
  }

  async callWithTimeout(asyncFn, timeoutMs) {
    return Promise.race([
      asyncFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`AI_TIMEOUT: Gemini API did not respond within ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  parseAndValidateResponse(rawText, context) {
    let cleanText = rawText.trim();
    // Strip markdown code fences if model included them
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      throw new Error(`MALFORMED_AI_JSON: Failed to parse JSON response: ${e.message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('INVALID_AI_SCHEMA: Response is not a JSON object');
    }

    // Validate required fields
    if (typeof parsed.question !== 'string') {
      throw new Error('INVALID_AI_SCHEMA: Field "question" is missing or invalid');
    }

    const questionType = (parsed.questionType || 'technical').toLowerCase();
    const allowedTypes = ['technical', 'behavioral', 'hr', 'follow_up', 'scenario', 'introduction', 'completion'];
    const validQuestionType = allowedTypes.includes(questionType) ? questionType : 'technical';

    return {
      question: parsed.question.trim(),
      questionType: validQuestionType,
      topic: String(parsed.topic || context.strategy?.targetTopic || 'General').slice(0, 100),
      subtopic: parsed.subtopic ? String(parsed.subtopic).slice(0, 100) : null,
      intent: parsed.intent ? String(parsed.intent).toUpperCase() : (context.strategy?.intent || 'TECHNICAL_PROBE'),
      candidateRef: parsed.candidateRef ? String(parsed.candidateRef).slice(0, 200) : (context.strategy?.candidateRef || null),
      difficulty: String(parsed.difficulty || context.difficulty || 'intermediate').toLowerCase(),
      isFollowUp: Boolean(parsed.isFollowUp),
      shouldContinue: parsed.shouldContinue !== undefined ? Boolean(parsed.shouldContinue) : true
    };
  }
  async evaluateAnswer(context, attempt = 1) {
    if (!this.isConfigured() || !this.aiClient) {
      throw new Error('GEMINI_API_KEY is not configured in environment');
    }

    const EvaluationPromptBuilder = require('../evaluationPromptBuilder');
    const prompt = EvaluationPromptBuilder.buildEvaluationPrompt(context);

    try {
      const response = await this.callWithTimeout(async () => {
        const result = await this.aiClient.models.generateContent({
          model: this.modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        });
        return result;
      }, DEFAULT_TIMEOUT_MS);

      const rawText = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text);
      if (!rawText) {
        throw new Error('Empty evaluation response received from Gemini API');
      }

      const parsed = this.parseAndValidateEvaluation(rawText, context);
      return {
        ...parsed,
        evaluationSource: 'gemini',
        metadata: {
          provider: 'gemini',
          model: this.modelName,
          attempt,
          isFallback: false
        }
      };
    } catch (err) {
      console.warn(`[AI Evaluator] Gemini attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const backoffMs = attempt * 800;
        await new Promise(r => setTimeout(r, backoffMs));
        return this.evaluateAnswer(context, attempt + 1);
      }
      throw err;
    }
  }

  parseAndValidateEvaluation(rawText, context) {
    let cleanText = rawText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      throw new Error(`MALFORMED_AI_JSON: Failed to parse evaluation JSON: ${e.message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('INVALID_AI_SCHEMA: Evaluation response is not a JSON object');
    }

    const validateScore = (val, name, required = true) => {
      if (val === null || val === undefined) {
        if (required) throw new Error(`INVALID_EVALUATION: Missing required score ${name}`);
        return null;
      }
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 10) {
        throw new Error(`INVALID_EVALUATION: Score ${name} must be between 0 and 10, got ${val}`);
      }
      return parseFloat(num.toFixed(1));
    };

    const isBehavioral = context.questionType === 'behavioral' || context.interviewType === 'behavioral';
    const isHr = context.questionType === 'hr' || context.interviewType === 'hr';

    const technicalAccuracy = isBehavioral || isHr
      ? (parsed.technicalAccuracy !== null && parsed.technicalAccuracy !== undefined ? validateScore(parsed.technicalAccuracy, 'technicalAccuracy', false) : null)
      : validateScore(parsed.technicalAccuracy, 'technicalAccuracy', true);

    const relevance = validateScore(parsed.relevance, 'relevance', true);
    const completeness = validateScore(parsed.completeness, 'completeness', true);
    const clarity = validateScore(parsed.clarity, 'clarity', true);
    const communication = validateScore(parsed.communication, 'communication', true);

    // Confidence
    let confidence = Number(parsed.evaluationConfidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.85;
    }

    // Strengths & Weaknesses
    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter(s => typeof s === 'string' && s.trim().length > 0).map(s => s.trim().slice(0, 300))
      : [];
    if (strengths.length === 0) {
      strengths.push('Submitted a relevant response');
    }

    const weaknesses = Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.filter(w => typeof w === 'string' && w.trim().length > 0).map(w => w.trim().slice(0, 300))
      : [];

    const improvementSuggestion = typeof parsed.improvementSuggestion === 'string' && parsed.improvementSuggestion.trim()
      ? parsed.improvementSuggestion.trim().slice(0, 500)
      : 'Structure your explanation clearly and support your points with concrete domain examples.';

    // STAR
    let star = null;
    let starCompleteness = null;
    if (isBehavioral && parsed.star && typeof parsed.star === 'object') {
      star = {
        situation: Boolean(parsed.star.situation),
        task: Boolean(parsed.star.task),
        action: Boolean(parsed.star.action),
        result: Boolean(parsed.star.result)
      };
      starCompleteness = validateScore(parsed.starCompleteness, 'starCompleteness', false);
      if (starCompleteness === null) {
        const count = (star.situation ? 1 : 0) + (star.task ? 1 : 0) + (star.action ? 1 : 0) + (star.result ? 1 : 0);
        starCompleteness = parseFloat((count * 2.5).toFixed(1));
      }
    }

    // Sanity Guardrail: Empty/ultra-short answer cannot have perfect accuracy/completeness
    const answerLen = (context.studentAnswer || '').trim().length;
    if (answerLen < 15 && (completeness > 5 || (technicalAccuracy && technicalAccuracy > 5))) {
      throw new Error('INVALID_EVALUATION: Guardrail rejected high score on short answer');
    }

    return {
      technicalAccuracy,
      relevance,
      completeness,
      clarity,
      communication,
      strengths,
      weaknesses,
      improvementSuggestion,
      evaluationConfidence: parseFloat(confidence.toFixed(2)),
      star,
      starCompleteness
    };
  }
}

module.exports = GeminiProvider;
