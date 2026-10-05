const InterviewSessionService = require('../services/interviewSessionService');
const ConversationEngine = require('../services/conversationEngine');
const {
  ALLOWED_TARGET_ROLES,
  ALLOWED_INTERVIEW_TYPES,
  ALLOWED_DIFFICULTIES,
  ALLOWED_INTERVIEW_MODES,
  ALLOWED_QUESTION_COUNTS,
  ALLOWED_DURATIONS_MINUTES
} = require('../config/interviewOptions');

class InterviewController {
  static async getConfigOptions(req, res) {
    return res.status(200).json({
      success: true,
      data: {
        roles: ALLOWED_TARGET_ROLES,
        types: ALLOWED_INTERVIEW_TYPES,
        difficulties: ALLOWED_DIFFICULTIES,
        modes: ALLOWED_INTERVIEW_MODES,
        questionCounts: ALLOWED_QUESTION_COUNTS,
        durations: ALLOWED_DURATIONS_MINUTES
      }
    });
  }

  static async create(req, res) {
    try {
      const {
        targetRole,
        interviewType,
        difficulty,
        interviewMode,
        questionCount,
        durationMinutes
      } = req.body;

      const session = await InterviewSessionService.createSession(req.user.id, {
        targetRole,
        interviewType,
        difficulty,
        interviewMode,
        questionCount,
        durationMinutes
      });

      return res.status(201).json({
        success: true,
        message: 'Interview session created successfully',
        data: {
          session
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while creating interview session'
      });
    }
  }

  static async list(req, res) {
    try {
      const sessions = await InterviewSessionService.listSessions(req.user.id);
      return res.status(200).json({
        success: true,
        data: {
          sessions
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching interview sessions'
      });
    }
  }

  static async getById(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const session = await InterviewSessionService.getSession(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        data: {
          session
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while retrieving interview session'
      });
    }
  }

  static async start(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const result = await ConversationEngine.startInterview(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        message: 'Interview started successfully',
        data: result
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while starting interview session'
      });
    }
  }

  static async answer(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const { answer } = req.body;
      const result = await ConversationEngine.submitAnswer(req.user.id, sessionId, answer);

      return res.status(200).json({
        success: true,
        message: result.completed ? 'Interview completed' : 'Answer recorded successfully',
        data: result
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while processing student answer'
      });
    }
  }

  static async getCurrent(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const state = await ConversationEngine.getCurrentState(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        data: state
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while retrieving current interview state'
      });
    }
  }

  static async getConversation(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const history = await ConversationEngine.getConversation(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while retrieving conversation history'
      });
    }
  }

  static async cancel(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const session = await InterviewSessionService.cancelSession(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        message: 'Interview session cancelled',
        data: {
          session
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while cancelling interview session'
      });
    }
  }

  static async getStats(req, res) {
    try {
      const stats = await InterviewSessionService.getStats(req.user.id);
      return res.status(200).json({
        success: true,
        data: {
          stats
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching interview statistics'
      });
    }
  }

  static async getEvaluations(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const AnswerEvaluationService = require('../services/answerEvaluationService');
      const evaluations = await AnswerEvaluationService.getEvaluationsForSession(req.user.id, sessionId);

      return res.status(200).json({
        success: true,
        data: {
          evaluations
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while retrieving evaluations'
      });
    }
  }

  static async getEvaluationById(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      const conversationId = parseInt(req.params.conversationId, 10);
      if (isNaN(sessionId) || isNaN(conversationId)) {
        return res.status(400).json({ success: false, message: 'Invalid session or conversation ID' });
      }

      const AnswerEvaluationService = require('../services/answerEvaluationService');
      const evaluation = await AnswerEvaluationService.getEvaluationForConversation(req.user.id, sessionId, conversationId);

      return res.status(200).json({
        success: true,
        data: {
          evaluation
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while retrieving conversation evaluation'
      });
    }
  }

  static async transcribeVoice(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      const session = await InterviewSessionService.getSession(req.user.id, sessionId);
      if (session.interview_mode !== 'voice') {
        return res.status(400).json({
          success: false,
          message: `Session #${sessionId} is in '${session.interview_mode}' mode. Voice transcription is only allowed for voice-mode interviews.`
        });
      }

      if (session.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: `Cannot transcribe voice for session with status '${session.status}'`
        });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'No audio file received in upload payload'
        });
      }

      const SpeechToTextService = require('../services/speech/speechToTextService');
      const mimeType = req.file.mimetype || 'audio/webm';
      const result = await SpeechToTextService.transcribeAudio(req.file.buffer, mimeType);

      return res.status(200).json({
        success: true,
        message: 'Audio transcribed successfully',
        data: {
          transcript: result.transcript,
          language: result.language,
          durationMs: result.durationMs,
          confidence: result.confidence
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred during voice transcription'
      });
    }
  }

  static async synthesizeVoice(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid session ID' });
      }

      await InterviewSessionService.getSession(req.user.id, sessionId);
      const { text, options } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Text is required for speech synthesis' });
      }

      const TextToSpeechService = require('../services/speech/textToSpeechService');
      const speechData = await TextToSpeechService.synthesizeQuestionAudio(text, options);

      return res.status(200).json({
        success: true,
        data: speechData
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred during speech synthesis'
      });
    }
  }
}

module.exports = InterviewController;

