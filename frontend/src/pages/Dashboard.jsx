import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InterviewService from '../services/interviewService';
import ApiService from '../services/api';

export default function Dashboard({ onNavigate, onResumeSession }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, ready: 0, cancelled: 0 });
  const [summaryAnalytics, setSummaryAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [profRes, intRes, statRes, sumRes] = await Promise.all([
          ApiService.getProfile().catch(() => ({ success: false })),
          InterviewService.getMyInterviews().catch(() => ({ success: false })),
          InterviewService.getStats().catch(() => ({ success: false })),
          InterviewService.getCandidateSummary().catch(() => ({ success: false }))
        ]);

        if (profRes.success && profRes.data?.profile) {
          setProfile(profRes.data.profile);
        }
        if (intRes.success && Array.isArray(intRes.data?.sessions)) {
          setInterviews(intRes.data.sessions);
        }
        if (statRes.success && statRes.data?.stats) {
          setStats(statRes.data.stats);
        }
        if (sumRes.success && sumRes.data?.summary) {
          setSummaryAnalytics(sumRes.data.summary);
        }
      } catch (err) {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const handleAction = (session) => {
    if (session.status === 'ready') {
      onResumeSession(session);
      onNavigate('prepare');
    } else if (session.status === 'in_progress') {
      onResumeSession(session);
      onNavigate('session');
    } else if (session.status === 'completed') {
      onNavigate('report', session);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <span className="status-pill ready">Ready</span>;
      case 'in_progress':
        return <span className="status-pill in-progress">In Progress</span>;
      case 'completed':
        return <span className="status-pill completed">Completed</span>;
      case 'cancelled':
        return <span className="status-pill cancelled">Cancelled</span>;
      default:
        return <span className="status-pill">{status}</span>;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Welcome Hero Banner */}
      <div className="welcome-banner">
        <div className="welcome-content">
          <div className="welcome-tag">Student Candidate Workspace</div>
          <h1>Good day, {user?.name || 'Student'}! 👋</h1>
          <p>
            {profile?.target_role
              ? `Preparing for ${profile.target_role} interviews`
              : 'Configure your interview simulations and track your practice sessions.'}
          </p>
          <div className="welcome-cta-group">
            <button className="btn-primary btn-lg" onClick={() => onNavigate('setup')}>
              🎯 Start New Mock Interview
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('profile')}>
              Edit Candidate Profile
            </button>
          </div>
        </div>

        <div className="welcome-stats">
          <div className="stat-card">
            <span className="stat-label">Target Role</span>
            <span className="stat-value">{profile?.target_role || 'Not Set'}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Experience</span>
            <span className="stat-value">{profile?.experience_years ? `${profile.experience_years} yrs` : 'Entry Level'}</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-row">
        <div className="card metric-card">
          <div className="metric-icon total">📋</div>
          <div className="metric-info">
            <span className="metric-num">{stats.total}</span>
            <span className="metric-lbl">Total Interviews</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon ready">⏳</div>
          <div className="metric-info">
            <span className="metric-num">{stats.ready}</span>
            <span className="metric-lbl">Ready to Start</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon in-progress">⚡</div>
          <div className="metric-info">
            <span className="metric-num">{stats.inProgress}</span>
            <span className="metric-lbl">In Progress</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon completed">✓</div>
          <div className="metric-info">
            <span className="metric-num">{stats.completed}</span>
            <span className="metric-lbl">Completed</span>
          </div>
        </div>
      </div>

      {/* Candidate Performance Summary (if completed interviews exist) */}
      {summaryAnalytics && summaryAnalytics.totalCompletedInterviews > 0 && (
        <div className="card performance-summary-card">
          <div className="card-header flex justify-between items-center">
            <div>
              <h3>Overall Performance Scorecard</h3>
              <p className="text-muted text-sm">Aggregated metrics across your completed interview simulations</p>
            </div>
            {summaryAnalytics.averageOverallScore !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-300">Mean Score:</span>
                <span className="score-badge badge-primary font-bold text-base px-3 py-1">
                  {summaryAnalytics.averageOverallScore} / 10
                </span>
              </div>
            )}
          </div>
          <div className="card-body">
            <div className="performance-dimensions-row">
              <div className="perf-dim-item">
                <span className="perf-dim-lbl">Technical</span>
                <span className="perf-dim-val">{summaryAnalytics.dimensionAverages?.technicalAccuracy ?? '—'}/10</span>
              </div>
              <div className="perf-dim-item">
                <span className="perf-dim-lbl">Relevance</span>
                <span className="perf-dim-val">{summaryAnalytics.dimensionAverages?.relevance ?? '—'}/10</span>
              </div>
              <div className="perf-dim-item">
                <span className="perf-dim-lbl">Completeness</span>
                <span className="perf-dim-val">{summaryAnalytics.dimensionAverages?.completeness ?? '—'}/10</span>
              </div>
              <div className="perf-dim-item">
                <span className="perf-dim-lbl">Clarity</span>
                <span className="perf-dim-val">{summaryAnalytics.dimensionAverages?.clarity ?? '—'}/10</span>
              </div>
              <div className="perf-dim-item">
                <span className="perf-dim-lbl">Communication</span>
                <span className="perf-dim-val">{summaryAnalytics.dimensionAverages?.communication ?? '—'}/10</span>
              </div>
            </div>

            {(summaryAnalytics.bestDimension || summaryAnalytics.weakestDimension) && (
              <div className="perf-highlights-row mt-4">
                {summaryAnalytics.bestDimension && (
                  <div className="highlight-pill best">
                    <span>🌟 Strongest Dimension:</span>
                    <strong>{summaryAnalytics.bestDimension.dimension} ({summaryAnalytics.bestDimension.score}/10)</strong>
                  </div>
                )}
                {summaryAnalytics.weakestDimension && (
                  <div className="highlight-pill improve">
                    <span>💡 Focus Area:</span>
                    <strong>{summaryAnalytics.weakestDimension.dimension} ({summaryAnalytics.weakestDimension.score}/10)</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Interviews Table & Empty State */}
      <div className="card session-list-card">
        <div className="card-header">
          <div>
            <h3>Recent Mock Interviews</h3>
            <p className="text-muted text-sm">Your configured sessions and simulation history</p>
          </div>
          {interviews.length > 0 && (
            <button className="btn-primary btn-sm" onClick={() => onNavigate('setup')}>
              + New Interview
            </button>
          )}
        </div>

        <div className="card-body">
          {loading ? (
            <div className="loading-container" style={{ minHeight: '150px' }}>
              <div className="spinner"></div>
              <p>Loading your interview sessions...</p>
            </div>
          ) : interviews.length === 0 ? (
            <div className="empty-state-box">
              <div className="empty-icon">🎯</div>
              <h3>No Mock Interviews Yet</h3>
              <p>
                Configure your target role, difficulty, and question format to start practicing with AI simulations.
              </p>
              <button className="btn-primary" onClick={() => onNavigate('setup')}>
                Start Your First Mock Interview →
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Target Role</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Mode</th>
                    <th>Questions</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((item) => (
                    <tr key={item.id}>
                      <td><strong>#{item.id}</strong></td>
                      <td>{item.target_role}</td>
                      <td className="capitalize">{item.interview_type}</td>
                      <td className="capitalize">{item.difficulty}</td>
                      <td>{item.interview_mode === 'voice' ? '🎙️ Voice' : '💬 Text'}</td>
                      <td>{item.question_count} Qs ({item.duration_minutes}m)</td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        {(item.status === 'ready' || item.status === 'in_progress') ? (
                          <button
                            className="btn-primary btn-xs"
                            onClick={() => handleAction(item)}
                          >
                            {item.status === 'ready' ? 'Prepare' : 'Resume'}
                          </button>
                        ) : item.status === 'completed' ? (
                          <button
                            className="btn-secondary btn-xs"
                            style={{ borderColor: '#6366f1', color: '#818cf8' }}
                            onClick={() => handleAction(item)}
                          >
                            View Report 📊
                          </button>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
