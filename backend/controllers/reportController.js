const InterviewReportService = require('../services/interviewReportService');

class ReportController {
  /**
   * GET /api/interviews/:id/report
   */
  static async getReport(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid interview session ID' });
      }

      const report = await InterviewReportService.generateReport(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        data: {
          report
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while generating interview report'
      });
    }
  }

  /**
   * GET /api/interviews/:id/analytics
   */
  static async getInterviewAnalytics(req, res) {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, message: 'Invalid interview session ID' });
      }

      const report = await InterviewReportService.generateReport(req.user.id, sessionId);
      return res.status(200).json({
        success: true,
        data: {
          analytics: {
            interviewId: report.interview.id,
            targetRole: report.interview.targetRole,
            interviewType: report.interview.interviewType,
            overallScore: report.summary.overallScore,
            dimensions: report.dimensions,
            followUpAnalytics: report.followUpAnalytics,
            inputModes: report.inputModes,
            starAnalysis: report.starAnalysis,
            topics: report.topics
          }
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching interview analytics'
      });
    }
  }

  /**
   * GET /api/analytics/summary
   */
  static async getCandidateSummary(req, res) {
    try {
      const summary = await InterviewReportService.getCandidateSummary(req.user.id);
      return res.status(200).json({
        success: true,
        data: {
          summary
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching candidate summary analytics'
      });
    }
  }

  /**
   * GET /api/analytics/history
   */
  static async getCandidateHistory(req, res) {
    try {
      const historyData = await InterviewReportService.getCandidateHistory(req.user.id);
      return res.status(200).json({
        success: true,
        data: historyData
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching candidate performance history'
      });
    }
  }
}

module.exports = ReportController;
