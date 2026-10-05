import ApiService from './api';

class InterviewService {
  static async getConfigOptions() {
    return ApiService.request('/interviews/options', { method: 'GET' });
  }

  static async getMyInterviews() {
    return ApiService.request('/interviews', { method: 'GET' });
  }

  static async getStats() {
    return ApiService.request('/interviews/stats', { method: 'GET' });
  }

  static async getInterview(id) {
    return ApiService.request(`/interviews/${id}`, { method: 'GET' });
  }

  static async createInterview(configData) {
    return ApiService.request('/interviews', {
      method: 'POST',
      body: JSON.stringify(configData)
    });
  }

  static async startInterview(id) {
    return ApiService.request(`/interviews/${id}/start`, {
      method: 'POST'
    });
  }

  static async submitAnswer(id, answer) {
    return ApiService.request(`/interviews/${id}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer })
    });
  }

  static async getCurrentState(id) {
    return ApiService.request(`/interviews/${id}/current`, { method: 'GET' });
  }

  static async getConversation(id) {
    return ApiService.request(`/interviews/${id}/conversation`, { method: 'GET' });
  }

  static async getEvaluations(id) {
    return ApiService.request(`/interviews/${id}/evaluations`, { method: 'GET' });
  }

  static async getEvaluationById(sessionId, conversationId) {
    return ApiService.request(`/interviews/${sessionId}/evaluations/${conversationId}`, { method: 'GET' });
  }

  static async transcribeVoice(id, audioBlob, filename = 'recording.webm') {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    return ApiService.request(`/interviews/${id}/voice/transcribe`, {
      method: 'POST',
      body: formData
    });
  }

  static async synthesizeSpeech(id, text, options = {}) {
    return ApiService.request(`/interviews/${id}/voice/tts`, {
      method: 'POST',
      body: JSON.stringify({ text, options })
    });
  }

  static async cancelInterview(id) {
    return ApiService.request(`/interviews/${id}/cancel`, {
      method: 'POST'
    });
  }

  // Phase 6 Report & Analytics methods
  static async getReport(id) {
    return ApiService.request(`/interviews/${id}/report`, { method: 'GET' });
  }

  static async getAnalytics(id) {
    return ApiService.request(`/interviews/${id}/analytics`, { method: 'GET' });
  }

  static async getCandidateSummary() {
    return ApiService.request('/analytics/summary', { method: 'GET' });
  }

  static async getCandidateHistory() {
    return ApiService.request('/analytics/history', { method: 'GET' });
  }
}

export default InterviewService;
