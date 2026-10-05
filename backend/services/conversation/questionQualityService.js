/**
 * Question Quality Service (Phase 9)
 * 
 * Validates generated questions against human-like interview criteria:
 * 1. Relevance: Connected to current conversation context
 * 2. Continuity: Follows previous answer or provides a justified transition
 * 3. Novelty: No duplicate or semantic near-duplicate of prior questions
 * 4. Human-likeness: Sounds like a real human interviewer (not textbook/questionnaire)
 * 5. Specificity: Mentions concrete candidate facts/decisions/challenges when appropriate
 * 6. Goal Clarity: Has a clear conversational goal
 * 7. Spoken Length: 1-2 concise sentences, ideal for natural TTS
 * 8. Zero Leakage: No internal reasoning, scores, JSON, or meta-tokens in candidate-facing text
 */

class QuestionQualityService {
    /**
     * Validate a candidate question
     * @param {Object} params
     * @param {string} params.question - The question text to validate
     * @param {string} params.previousAnswer - Candidate's previous answer
     * @param {Array<string>} params.askedQuestions - All previously asked questions
     * @param {Object} params.reasoningPlan - Output from InterviewerReasoningEngine
     * @param {Object} params.answerUnderstanding - Output from AnswerUnderstandingService
     * @returns {Object} { isValid: boolean, score: number, issues: Array<string>, sanitizedQuestion: string }
     */
    static validateQuestion({
        question,
        previousAnswer = '',
        askedQuestions = [],
        reasoningPlan = {},
        answerUnderstanding = {}
    }) {
        const issues = [];
        let score = 1.0;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return {
                isValid: false,
                score: 0,
                issues: ['Question is empty or not a string'],
                sanitizedQuestion: ''
            };
        }

        // Clean & sanitize
        let sanitized = this.sanitizeQuestionText(question);
        if (sanitized.length === 0) {
            return {
                isValid: false,
                score: 0,
                issues: ['Question contains only metadata or invalid tokens'],
                sanitizedQuestion: ''
            };
        }

        // 1. Check for Internal Leakage (Crucial rule)
        const leakageCheck = this.checkInternalLeakage(question);
        if (leakageCheck.hasLeakage) {
            issues.push(`Internal leakage detected: ${leakageCheck.foundTokens.join(', ')}`);
            score -= 0.6;
        }

        // 2. Check Length & Sentence Count (Spoken length target: 1-2 sentences)
        const sentences = sanitized.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
        if (sentences.length > 3) {
            issues.push(`Question too long (${sentences.length} sentences). Spoken output should be concise (1-2 sentences).`);
            score -= 0.3;
        }
        if (sanitized.length > 280) {
            issues.push(`Character count too high (${sanitized.length} chars).`);
            score -= 0.2;
        }

        // 3. Check Novelty / Duplicate Detection (Exact & Semantic)
        const duplicateCheck = this.checkDuplicate(sanitized, askedQuestions);
        if (duplicateCheck.isDuplicate) {
            issues.push(`Duplicate/near-duplicate question detected (matches "${duplicateCheck.matchedQuestion}")`);
            score -= 0.5;
        }

        // 4. Check Robotic / Textbook Antipatterns
        const roboticCheck = this.checkRoboticPhrasing(sanitized);
        if (roboticCheck.isRobotic) {
            issues.push(`Robotic or questionnaire phrasing: ${roboticCheck.matchedPattern}`);
            score -= 0.25;
        }

        // 5. Check Multiple Questions in One Turn
        const questionMarks = (sanitized.match(/\?/g) || []).length;
        if (questionMarks > 2) {
            issues.push(`Contains too many question marks (${questionMarks}). Prefer a single primary question.`);
            score -= 0.2;
        }

        // 6. Check Uncertainty Violation & Grounding Gate (CRITICAL RULE)
        const isAnswerUncertain = answerUnderstanding?.isUncertain || answerUnderstanding?.intent === 'UNCERTAIN' ||
            /(?:didn'?t|did not|never|haven'?t)\s+(?:implement|build|develop|create|do|touch|work on)|(?:ask\s+(?:me\s+)?(?:other|another|something else|different)|only ask\s+(?:me\s+)?other)|(?:skip\s*(?:this|question)?)|(?:i don'?t know|dont know|no idea|not sure|not familiar|haven'?t worked|don'?t remember)/i.test(previousAnswer);
        
        let hasUngroundedDrilling = false;
        if (isAnswerUncertain) {
            const hasDrillingPhrasing = /implementation approach|tools did you use|internal design|edge cases|elaborate a bit more on that|explain the internal|how you approached core principles|concrete example of how you approached|how did you implement that|what were the edge cases/i.test(sanitized);
            if (hasDrillingPhrasing) {
                issues.push('Question inappropriately drills into unknown concept after candidate expressed uncertainty or non-implementation');
                score -= 0.6;
                hasUngroundedDrilling = true;
            }
        }

        // 7. Check Relevance / Context Continuity
        // If it's a deep dive or follow story, verify it references something from context or is grounded
        if (reasoningPlan.preferredStrategy === 'FOLLOW_STORY' || reasoningPlan.preferredStrategy === 'EXPLORE_CHALLENGE') {
            const hasGroundedReference = this.checkGroundedness(sanitized, answerUnderstanding, previousAnswer);
            if (!hasGroundedReference && previousAnswer.length > 50) {
                issues.push('Question misses referencing specific candidate context for a story/challenge follow-up');
                score -= 0.15;
            }
        }

        score = Math.max(0, Math.min(1.0, score));
        const isValid = score >= 0.55 && !leakageCheck.hasLeakage && !duplicateCheck.isDuplicate && !hasUngroundedDrilling;

        return {
            isValid,
            score: Math.round(score * 100) / 100,
            issues,
            sanitizedQuestion: sanitized
        };
    }

    /**
     * Remove developer tokens, markdown code blocks, JSON tags, or reasoning leaks
     */
    static sanitizeQuestionText(text) {
        if (!text) return '';
        let cleaned = text.trim();

        // Extract inner content if wrapped in markdown code blocks
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
            cleaned = codeBlockMatch[1].trim();
        }

        // Parse JSON formatting if raw object returned
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
            try {
                const parsed = JSON.parse(cleaned);
                cleaned = parsed.question || parsed.nextQuestion || parsed.text || '';
            } catch (e) {
                cleaned = cleaned.replace(/[{}\[\]"]/g, '');
            }
        }

        // Remove prefix artifacts like "Interviewer:", "AI:", "Question:", "Follow-up:"
        cleaned = cleaned.replace(/^(?:Interviewer|AI|Question|Follow-up|Next Question)\s*:\s*/i, '');

        // Remove metadata annotations like [Strategy: ...] or (Curiosity: ...)
        cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
        cleaned = cleaned.replace(/\([A-Z_]+:[^)]*\)/g, '');

        return cleaned.trim();
    }

    /**
     * Check if internal reasoning/score tokens were leaked
     */
    static checkInternalLeakage(text) {
        const leakagePatterns = [
            /curiosityScore/i,
            /preferredStrategy/i,
            /conversationalGoal/i,
            /strategy\s*:\s*[A-Z_]+/i,
            /confidence\s*:\s*0\.\d+/i,
            /topicState/i,
            /candidateProfile/i,
            /reasoning\s*:\s*/i,
            /thought process\s*:\s*/i,
            /FOLLOW_STORY/i,
            /EXPLORE_CHALLENGE/i,
            /EXPLORE_TRADEOFF/i,
            /CLARIFY_OWNERSHIP/i,
            /TRANSITION/i,
            /COVERAGE_BALANCE/i,
            /StoryThread/i,
            /unresolvedQuestions/i
        ];

        const foundTokens = [];
        for (const pattern of leakagePatterns) {
            if (pattern.test(text)) {
                foundTokens.push(pattern.source);
            }
        }

        return {
            hasLeakage: foundTokens.length > 0,
            foundTokens
        };
    }

    /**
     * Check if the question is an exact or semantic duplicate of prior questions
     */
    static checkDuplicate(question, askedQuestions) {
        if (!askedQuestions || askedQuestions.length === 0) {
            return { isDuplicate: false, matchedQuestion: null };
        }

        const normalizedCurrent = this.normalizeForComparison(question);

        for (const prior of askedQuestions) {
            const normalizedPrior = this.normalizeForComparison(prior);

            // 1. Exact normalized match
            if (normalizedCurrent === normalizedPrior) {
                return { isDuplicate: true, matchedQuestion: prior };
            }

            // 2. High Jaccard token overlap
            const similarity = this.calculateJaccardSimilarity(normalizedCurrent, normalizedPrior);
            if (similarity > 0.82) {
                return { isDuplicate: true, matchedQuestion: prior };
            }

            // 3. Specific semantic template checks
            if (this.isSemanticDuplicate(normalizedCurrent, normalizedPrior)) {
                return { isDuplicate: true, matchedQuestion: prior };
            }
        }

        return { isDuplicate: false, matchedQuestion: null };
    }

    /**
     * Detect robotic interview questionnaire phrasing
     */
    static checkRoboticPhrasing(text) {
        const roboticPhrases = [
            /please explain the rationale behind/i,
            /please elaborate upon the aforementioned/i,
            /describe your mitigation strategy/i,
            /what are the advantages and disadvantages of/i,
            /can you enumerate all/i,
            /state the primary characteristics of/i,
            /please provide a comprehensive breakdown/i
        ];

        for (const pattern of roboticPhrases) {
            if (pattern.test(text)) {
                return { isRobotic: true, matchedPattern: pattern.source };
            }
        }

        return { isRobotic: false, matchedPattern: null };
    }

    /**
     * Verify if the follow-up is grounded in what candidate said
     */
    static checkGroundedness(question, understanding = {}, previousAnswer = '') {
        const lowerQ = question.toLowerCase();
        const entities = [
            ...(understanding.technologies || []),
            ...(understanding.projects || []),
            ...(understanding.challenges || []),
            ...(understanding.decisions || []),
            ...(understanding.claims || [])
        ];

        for (const ent of entities) {
            if (typeof ent === 'string' && ent.length > 2 && lowerQ.includes(ent.toLowerCase())) {
                return true;
            }
        }

        // Check significant words from previous answer
        const words = previousAnswer.toLowerCase().split(/\W+/).filter(w => w.length > 5);
        for (const w of words) {
            if (lowerQ.includes(w)) {
                return true;
            }
        }

        return false;
    }

    static normalizeForComparison(str) {
        return (str || '')
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static calculateJaccardSimilarity(strA, strB) {
        const tokensA = new Set(strA.split(' ').filter(t => t.length > 2));
        const tokensB = new Set(strB.split(' ').filter(t => t.length > 2));

        if (tokensA.size === 0 || tokensB.size === 0) return 0;

        let intersection = 0;
        for (const token of tokensA) {
            if (tokensB.has(token)) intersection++;
        }

        const union = tokensA.size + tokensB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }

    static isSemanticDuplicate(normA, normB) {
        // e.g. "why did you choose X" vs "what made you select X"
        const patterns = [
            { a: /why did you (?:choose|use|select|pick) (\w+)/, b: /what made you (?:choose|use|select|pick) (\w+)/ },
            { a: /how did you handle (\w+)/, b: /what did you do when (\w+) occurred/ }
        ];

        for (const p of patterns) {
            const matchA1 = normA.match(p.a);
            const matchB1 = normB.match(p.b);
            if (matchA1 && matchB1 && matchA1[1] === matchB1[1]) return true;

            const matchA2 = normA.match(p.b);
            const matchB2 = normB.match(p.a);
            if (matchA2 && matchB2 && matchA2[1] === matchB2[1]) return true;
        }

        return false;
    }
}

module.exports = QuestionQualityService;
