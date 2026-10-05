const express = require('express');
const router = express.Router();
const InterviewController = require('../controllers/interviewController');
const { requireAuth } = require('../middleware/authMiddleware');

// Public/Config options
router.get('/options', InterviewController.getConfigOptions);

// Protected interview routes
router.post('/', requireAuth, InterviewController.create);
router.get('/', requireAuth, InterviewController.list);
router.get('/stats', requireAuth, InterviewController.getStats);
router.get('/:id', requireAuth, InterviewController.getById);

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB, 10) || 15) * 1024 * 1024
  }
});

// Phase 3 & 4 conversational and evaluation endpoints
router.post('/:id/start', requireAuth, InterviewController.start);
router.post('/:id/answer', requireAuth, InterviewController.answer);
router.get('/:id/current', requireAuth, InterviewController.getCurrent);
router.get('/:id/conversation', requireAuth, InterviewController.getConversation);
router.get('/:id/evaluations', requireAuth, InterviewController.getEvaluations);
router.get('/:id/evaluations/:conversationId', requireAuth, InterviewController.getEvaluationById);
router.post('/:id/cancel', requireAuth, InterviewController.cancel);

// Phase 5 Voice endpoints
router.post('/:id/voice/transcribe', requireAuth, upload.single('audio'), InterviewController.transcribeVoice);
router.post('/:id/voice/tts', requireAuth, InterviewController.synthesizeVoice);

// Phase 6 Report & Analytics endpoints
const ReportController = require('../controllers/reportController');
router.get('/:id/report', requireAuth, ReportController.getReport);
router.get('/:id/analytics', requireAuth, ReportController.getInterviewAnalytics);

module.exports = router;

