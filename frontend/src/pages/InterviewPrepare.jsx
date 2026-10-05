import { useState } from 'react';
import InterviewService from '../services/interviewService';

export default function InterviewPrepare({ session, onNavigate, onSessionUpdated }) {
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!session) {
    return (
      <div className="auth-redirect-container">
        <div className="auth-redirect-box">
          <h3>No Active Session</h3>
          <p>Please configure a new mock interview session first.</p>
          <button className="btn-primary" onClick={() => onNavigate('setup')}>
            Start New Setup
          </button>
        </div>
      </div>
    );
  }

  const handleBegin = async () => {
    setStarting(true);
    setErrorMsg('');

    try {
      const res = await InterviewService.startInterview(session.id);
      if (res.success && res.data?.session) {
        onSessionUpdated(res.data.session);
        onNavigate('session');
      } else {
        setErrorMsg(res.message || 'Unable to start session');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error starting session');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setErrorMsg('');

    try {
      const res = await InterviewService.cancelInterview(session.id);
      if (res.success) {
        onNavigate('dashboard');
      } else {
        setErrorMsg(res.message || 'Unable to cancel session');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error cancelling session');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="prepare-container">
      <div className="card prepare-card">
        <div className="prepare-header">
          <div className="prepare-badge">Session #{session.id} • Ready</div>
          <h2>You're Ready to Begin</h2>
          <p className="prepare-sub">
            {session.target_role || session.targetRole} • {session.interview_type || session.interviewType} Interview ({session.difficulty})
          </p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-danger">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <div className="prepare-meta-bar">
          <div className="meta-pill">
            <span className="pill-lbl">Questions</span>
            <span className="pill-val">{session.question_count || session.questionCount}</span>
          </div>
          <div className="meta-pill">
            <span className="pill-lbl">Duration</span>
            <span className="pill-val">{session.duration_minutes || session.durationMinutes} min</span>
          </div>
          <div className="meta-pill">
            <span className="pill-lbl">Mode</span>
            <span className="pill-val">{(session.interview_mode || session.interviewMode)?.toUpperCase()}</span>
          </div>
        </div>

        <div className="prepare-checklist">
          <h3>Before You Begin:</h3>
          <div className="checklist-items">
            <div className="check-item">
              <span className="check-icon">✓</span>
              <div>
                <strong>Quiet Environment</strong>
                <p>Find a distraction-free space to focus on your interview answers.</p>
              </div>
            </div>
            <div className="check-item">
              <span className="check-icon">✓</span>
              <div>
                <strong>Stable Internet Connection</strong>
                <p>Ensure your network connection is active and stable.</p>
              </div>
            </div>
            <div className="check-item">
              <span className="check-icon">✓</span>
              <div>
                <strong>Natural & Clear Delivery</strong>
                <p>Structure your thoughts using the STAR method for behavioral and architectural questions.</p>
              </div>
            </div>
            {(session.interview_mode === 'voice' || session.interviewMode === 'voice') && (
              <div className="check-item voice-note">
                <span className="check-icon">🎙️</span>
                <div>
                  <strong>Voice Audio Mode Selected</strong>
                  <p>Microphone access and audio synthesis will be activated in the interview studio.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="prepare-actions">
          <button className="btn-secondary" onClick={handleCancel} disabled={cancelling || starting}>
            {cancelling ? 'Cancelling...' : 'Cancel Interview'}
          </button>
          <button className="btn-primary btn-lg" onClick={handleBegin} disabled={starting || cancelling}>
            {starting ? 'Starting Interview...' : 'Begin Interview →'}
          </button>
        </div>
      </div>
    </div>
  );
}
