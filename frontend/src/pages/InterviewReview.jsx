import { useState } from 'react';
import InterviewService from '../services/interviewService';

export default function InterviewReview({ config, onNavigate, onSessionCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!config) {
    return (
      <div className="auth-redirect-container">
        <div className="auth-redirect-box">
          <h3>No Configuration Found</h3>
          <p>Please configure your mock interview parameters first.</p>
          <button className="btn-primary" onClick={() => onNavigate('setup')}>
            Go to Setup
          </button>
        </div>
      </div>
    );
  }

  const handleCreateSession = async () => {
    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await InterviewService.createInterview(config);
      if (res.success && res.data?.session) {
        onSessionCreated(res.data.session);
        onNavigate('prepare');
      } else {
        setErrorMsg(res.message || 'Unable to create interview session');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error creating interview session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="review-container">
      <div className="page-header">
        <div className="header-info">
          <h2>Review Interview Configuration</h2>
          <p>Please verify your simulation parameters before generating your session</p>
        </div>
        <button className="btn-secondary" onClick={() => onNavigate('setup')}>
          ← Back to Setup
        </button>
      </div>

      {errorMsg && (
        <div className="alert-box alert-danger">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      <div className="review-grid">
        <div className="card review-card">
          <div className="review-hero">
            <div className="review-role-badge">Selected Role</div>
            <h1 className="review-target-role">{config.targetRole}</h1>
            <div className="review-tags">
              <span className="review-tag">{config.interviewType?.toUpperCase()}</span>
              <span className="review-tag difficulty">{config.difficulty?.toUpperCase()}</span>
              <span className="review-tag mode">{config.interviewMode === 'voice' ? '🎙️ VOICE' : '💬 TEXT'}</span>
            </div>
          </div>

          <div className="review-details-table">
            <div className="review-row">
              <span className="rev-label">Target Role</span>
              <span className="rev-val">{config.targetRole}</span>
            </div>
            <div className="review-row">
              <span className="rev-label">Interview Type</span>
              <span className="rev-val capitalize">{config.interviewType}</span>
            </div>
            <div className="review-row">
              <span className="rev-label">Difficulty</span>
              <span className="rev-val capitalize">{config.difficulty}</span>
            </div>
            <div className="review-row">
              <span className="rev-label">Interview Mode</span>
              <span className="rev-val">{config.interviewMode === 'voice' ? 'Voice (Audio)' : 'Text (Interactive Chat)'}</span>
            </div>
            <div className="review-row">
              <span className="rev-label">Question Count</span>
              <span className="rev-val">{config.questionCount} Questions</span>
            </div>
            <div className="review-row">
              <span className="rev-label">Allocated Duration</span>
              <span className="rev-val">{config.durationMinutes} Minutes</span>
            </div>
          </div>

          <div className="review-actions">
            <button className="btn-secondary" onClick={() => onNavigate('setup')} disabled={submitting}>
              ← Edit Configuration
            </button>
            <button className="btn-primary btn-lg" onClick={handleCreateSession} disabled={submitting}>
              {submitting ? 'Creating Session...' : 'Confirm & Create Session →'}
            </button>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="card review-info-sidebar">
          <h3>Simulation Information</h3>
          <ul className="info-bullets">
            <li>Your session state will be set to <strong>Ready</strong> upon creation.</li>
            <li>You can review preparation instructions before officially starting.</li>
            <li>Sessions can be paused or cancelled at any time from your dashboard.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
