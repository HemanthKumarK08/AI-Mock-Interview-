export default function InterviewSession({ session, onNavigate }) {
  return (
    <div className="session-placeholder-container">
      <div className="card session-placeholder-card">
        <div className="status-badge-live">
          <span className="live-dot"></span> Session Status: {session?.status?.toUpperCase() || 'IN_PROGRESS'}
        </div>

        <div className="session-header">
          <h1>Interview Session #{session?.id || 'Active'}</h1>
          <p className="session-role">
            {session?.target_role || session?.targetRole || 'Target Role'} • {session?.interview_type || session?.interviewType} ({session?.difficulty})
          </p>
        </div>

        <div className="session-info-box">
          <div className="info-badge-row">
            <span className="pill-badge">Mode: {(session?.interview_mode || session?.interviewMode)?.toUpperCase()}</span>
            <span className="pill-badge">Questions: {session?.question_count || session?.questionCount}</span>
            <span className="pill-badge">Duration: {session?.duration_minutes || session?.durationMinutes} min</span>
          </div>

          <div className="phase-notice-box">
            <h3>🎙️ AI Interview Engine Foundation</h3>
            <p>
              Your interview session has been safely initialized and persisted in the database with status <code>{session?.status || 'in_progress'}</code>.
            </p>
            <p className="subtext">
              The AI Question Generator, Adaptive Follow-up Engine, and Real-time Voice/Text Evaluation will be connected in the subsequent phases.
            </p>
          </div>
        </div>

        <div className="session-actions">
          <button className="btn-primary" onClick={() => onNavigate('dashboard')}>
            ← Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
