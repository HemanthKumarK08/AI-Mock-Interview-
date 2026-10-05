const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/authMiddleware');

// Protected Candidate Analytics Routes
router.get('/summary', requireAuth, ReportController.getCandidateSummary);
router.get('/history', requireAuth, ReportController.getCandidateHistory);

module.exports = router;
