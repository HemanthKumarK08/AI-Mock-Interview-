import React, { useState, useEffect } from 'react';
import InterviewService from '../services/interviewService';

export default function InterviewReport({ sessionId, onNavigate }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTurns, setExpandedTurns] = useState({});

  useEffect(() => {
    async function fetchReport() {
      if (!sessionId) {
        setError('No interview session ID provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await InterviewService.getReport(sessionId);
        if (res.success && res.data?.report) {
          setReportData(res.data.report);
          // Expand all questions by default for quick scanning
          const initialExpanded = {};
          if (Array.isArray(res.data.report.questions)) {
            res.data.report.questions.forEach((q, idx) => {
              initialExpanded[q.turnNumber || idx + 1] = true;
            });
          }
          setExpandedTurns(initialExpanded);
        } else {
          setError(res.message || 'Unable to load interview report');
        }
      } catch (err) {
        setError(err.message || 'An error occurred while loading the report');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [sessionId]);

  const toggleTurn = (turnNumber) => {
    setExpandedTurns(prev => ({
      ...prev,
      [turnNumber]: !prev[turnNumber]
    }));
  };

  const getScoreBadge = (score) => {
    if (score === null || score === undefined) return { text: 'N/A', class: 'badge-neutral' };
    if (score >= 8.5) return { text: 'Exceptional', class: 'badge-success' };
    if (score >= 7.0) return { text: 'Strong', class: 'badge-primary' };
    if (score >= 5.5) return { text: 'Moderate', class: 'badge-warning' };
    return { text: 'Needs Work', class: 'badge-danger' };
  };

  if (loading) {
    return (
      <div className="report-loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Generating comprehensive interview performance report...</p>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="report-error-container">
        <div className="report-error-card">
          <span className="error-icon">⚠️</span>
          <h3>Report Unavailable</h3>
          <p>{error || 'The requested interview report could not be found.'}</p>
          <button className="btn-primary" onClick={() => onNavigate('dashboard')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { interview, summary, dimensions, strengths, improvementAreas, questions, followUpAnalytics, inputModes, starAnalysis, topics } = reportData;
  const overallBadge = getScoreBadge(summary.overallScore);

  const formatDuration = (secs) => {
    if (!secs) return '0 min';
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    if (mins === 0) return `${remainderSecs}s`;
    return `${mins}m ${remainderSecs}s`;
  };

  return (
    <div className="report-layout">
      {/* Top Header Navigation */}
      <div className="report-top-bar">
        <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={() => onNavigate('dashboard')}>
          <span>←</span> Back to Dashboard
        </button>
        <div className="report-actions-right">
          <button className="btn-secondary btn-sm" onClick={() => window.print()}>
            🖨 Print / Save PDF
          </button>
          <button className="btn-primary btn-sm" onClick={() => onNavigate('setup')}>
            + New Interview
          </button>
        </div>
      </div>

      {/* Main Report Header Hero */}
      <header className="report-header-hero">
        <div className="report-header-main">
          <div className="report-badge-status">
            <span className={`status-dot ${interview.status === 'completed' ? 'dot-completed' : 'dot-progress'}`}></span>
            {interview.status === 'completed' ? 'INTERVIEW COMPLETED' : 'IN PROGRESS'} • ID #{interview.id}
          </div>
          <h1 className="report-role-title">{interview.targetRole}</h1>
          <div className="report-meta-tags">
            <span className="meta-tag type">{interview.interviewType.toUpperCase()}</span>
            <span className="meta-tag diff">{interview.difficulty.toUpperCase()}</span>
            <span className="meta-tag mode">{interview.interviewMode === 'voice' ? '🎙 VOICE MODE' : '💬 TEXT MODE'}</span>
            <span className="meta-tag date">📅 {new Date(interview.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="meta-tag duration">⏱ {formatDuration(interview.actualDurationSeconds)}</span>
          </div>
        </div>

        {/* Big Overall Score Card */}
        <div className="report-hero-score-card">
          <div className="score-ring-wrapper">
            <div className="score-number">
              {summary.overallScore !== null ? summary.overallScore : '—'}
            </div>
            <div className="score-max">/ 10</div>
          </div>
          <div className="score-meta-block">
            <span className={`score-badge ${overallBadge.class}`}>{overallBadge.text}</span>
            <span className="score-subtitle">Overall Performance Score</span>
          </div>
        </div>
      </header>

      {/* Summary KPI Strip */}
      <div className="report-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Evaluated Answers</span>
          <span className="kpi-val">{summary.evaluatedAnswers} / {summary.totalQuestions}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Strong Responses</span>
          <span className="kpi-val text-emerald-500 font-bold">{summary.strongResponses}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Areas to Improve</span>
          <span className="kpi-val text-amber-500 font-bold">{summary.needsImprovementResponses}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Follow-up Questions</span>
          <span className="kpi-val">{summary.followUpQuestions} <span className="text-xs text-slate-400">({summary.followUpRate}%)</span></span>
        </div>
      </div>

      {/* Section 1: Dimension Scorecards */}
      <section className="report-section">
        <div className="section-header">
          <span className="section-icon">📊</span>
          <h2>Performance Dimensions</h2>
        </div>
        <div className="dimensions-cards-grid">
          {Object.entries(dimensions).map(([key, dim]) => {
            if (!dim.applicable) return null;
            const dimBadge = getScoreBadge(dim.score);
            const percent = dim.score !== null ? Math.round((dim.score / 10) * 100) : 0;

            return (
              <div key={key} className="dimension-card">
                <div className="dim-card-top">
                  <span className="dim-card-title">{dim.label}</span>
                  <span className={`dim-mini-badge ${dimBadge.class}`}>{dimBadge.text}</span>
                </div>
                <div className="dim-card-score-row">
                  <span className="dim-score-big">{dim.score !== null ? dim.score : '—'}</span>
                  <span className="dim-score-denom">/ 10</span>
                </div>
                <div className="dim-progress-track">
                  <div
                    className={`dim-progress-fill ${dim.score >= 7.5 ? 'bg-emerald-500' : dim.score >= 6.0 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Strengths & Growth Areas */}
      <section className="report-section">
        <div className="strengths-growth-grid">
          {/* Strengths Card */}
          <div className="feedback-column-card strengths-card">
            <div className="feedback-column-header">
              <span className="feedback-icon text-emerald-400">✓</span>
              <h3>Demonstrated Strengths</h3>
            </div>
            {strengths && strengths.length > 0 ? (
              <ul className="feedback-list">
                {strengths.map((s, idx) => (
                  <li key={idx} className="feedback-item strength-item">
                    <span className="item-bullet text-emerald-400">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-subtext">No specific recurring strengths identified.</p>
            )}
          </div>

          {/* Growth Areas Card */}
          <div className="feedback-column-card growth-card">
            <div className="feedback-column-header">
              <span className="feedback-icon text-amber-400">💡</span>
              <h3>Areas for Growth & Improvement</h3>
            </div>
            {improvementAreas && improvementAreas.length > 0 ? (
              <ul className="feedback-list">
                {improvementAreas.map((w, idx) => (
                  <li key={idx} className="feedback-item growth-item">
                    <span className="item-bullet text-amber-400">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-subtext">No major weaknesses identified. Keep up the solid performance!</p>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Detailed Question-by-Question Breakdown */}
      <section className="report-section">
        <div className="section-header">
          <span className="section-icon">📝</span>
          <h2>Question-by-Question Performance Breakdown</h2>
        </div>

        <div className="questions-breakdown-list">
          {questions.map((q) => {
            const isExpanded = !!expandedTurns[q.turnNumber];
            const qScoreBadge = getScoreBadge(q.evaluation?.overallTurnScore);

            return (
              <div key={q.turnNumber} className="question-accordion-card">
                {/* Accordion Header */}
                <div
                  className="accordion-header"
                  onClick={() => toggleTurn(q.turnNumber)}
                >
                  <div className="accordion-header-left">
                    <span className="turn-pill">Turn #{q.turnNumber}</span>
                    {q.questionType === 'follow_up' && (
                      <span className="tag-followup">⚡ FOLLOW-UP</span>
                    )}
                    {q.topic && <span className="topic-badge">{q.topic}</span>}
                    {q.inputMode === 'voice' && <span className="voice-pill">🎙 Voice</span>}
                    <h4 className="question-header-text">{q.question}</h4>
                  </div>

                  <div className="accordion-header-right">
                    {q.evaluation ? (
                      <div className="accordion-score-badge">
                        <span className="acc-score">{q.evaluation.overallTurnScore !== null ? q.evaluation.overallTurnScore : '—'}</span>
                        <span className="acc-max">/10</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Unanswered</span>
                    )}
                    <span className="chevron-icon">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="accordion-body">
                    {/* Candidate Answer */}
                    <div className="answer-review-box">
                      <div className="box-label">Your Response:</div>
                      {q.studentAnswer ? (
                        <p className="candidate-answer-text">{q.studentAnswer}</p>
                      ) : (
                        <p className="text-sm italic text-slate-500">No response recorded for this question.</p>
                      )}
                    </div>

                    {/* Evaluation Feedback */}
                    {q.evaluation && (
                      <div className="turn-evaluation-content">
                        {/* Turn Dimension Scores */}
                        <div className="turn-dimensions-row">
                          {q.evaluation.technicalAccuracy !== null && (
                            <div className="mini-dim-pill">
                              <span>Technical:</span>
                              <strong>{q.evaluation.technicalAccuracy}/10</strong>
                            </div>
                          )}
                          <div className="mini-dim-pill">
                            <span>Relevance:</span>
                            <strong>{q.evaluation.relevance}/10</strong>
                          </div>
                          <div className="mini-dim-pill">
                            <span>Completeness:</span>
                            <strong>{q.evaluation.completeness}/10</strong>
                          </div>
                          <div className="mini-dim-pill">
                            <span>Clarity:</span>
                            <strong>{q.evaluation.clarity}/10</strong>
                          </div>
                          <div className="mini-dim-pill">
                            <span>Communication:</span>
                            <strong>{q.evaluation.communication}/10</strong>
                          </div>
                        </div>

                        {/* STAR Indicators if Behavioral */}
                        {q.evaluation.star && (
                          <div className="turn-star-row">
                            <span className="text-xs font-semibold text-slate-400">STAR Structure:</span>
                            <span className={`star-tag ${q.evaluation.star.situation ? 'present' : 'missing'}`}>
                              {q.evaluation.star.situation ? '✓' : '✗'} Situation
                            </span>
                            <span className={`star-tag ${q.evaluation.star.task ? 'present' : 'missing'}`}>
                              {q.evaluation.star.task ? '✓' : '✗'} Task
                            </span>
                            <span className={`star-tag ${q.evaluation.star.action ? 'present' : 'missing'}`}>
                              {q.evaluation.star.action ? '✓' : '✗'} Action
                            </span>
                            <span className={`star-tag ${q.evaluation.star.result ? 'present' : 'missing'}`}>
                              {q.evaluation.star.result ? '✓' : '✗'} Result
                            </span>
                          </div>
                        )}

                        {/* Strengths & Weaknesses */}
                        <div className="turn-points-grid">
                          {q.evaluation.strengths && q.evaluation.strengths.length > 0 && (
                            <div className="turn-points-col">
                              <h5>Strengths</h5>
                              <ul>
                                {q.evaluation.strengths.map((str, i) => (
                                  <li key={i}>✓ {str}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {q.evaluation.weaknesses && q.evaluation.weaknesses.length > 0 && (
                            <div className="turn-points-col">
                              <h5>Improvements</h5>
                              <ul>
                                {q.evaluation.weaknesses.map((wk, i) => (
                                  <li key={i}>• {wk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Actionable Suggestion */}
                        {q.evaluation.improvementSuggestion && (
                          <div className="turn-recommendation">
                            <span className="rec-icon">💡</span>
                            <div>
                              <strong>Recommendation:</strong> {q.evaluation.improvementSuggestion}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 4: Behavioral & STAR Analytics (if applicable) */}
      {starAnalysis && starAnalysis.isApplicable && (
        <section className="report-section">
          <div className="section-header">
            <span className="section-icon">⭐</span>
            <h2>Behavioral Framework (STAR) Analysis</h2>
          </div>
          <div className="star-analytics-card">
            <div className="star-rates-grid">
              <div className="star-rate-item">
                <span className="star-part">Situation</span>
                <span className="star-pct">{starAnalysis.situationPresentRate}%</span>
                <div className="star-bar"><div className="star-fill" style={{ width: `${starAnalysis.situationPresentRate}%` }}></div></div>
              </div>
              <div className="star-rate-item">
                <span className="star-part">Task</span>
                <span className="star-pct">{starAnalysis.taskPresentRate}%</span>
                <div className="star-bar"><div className="star-fill" style={{ width: `${starAnalysis.taskPresentRate}%` }}></div></div>
              </div>
              <div className="star-rate-item">
                <span className="star-part">Action</span>
                <span className="star-pct">{starAnalysis.actionPresentRate}%</span>
                <div className="star-bar"><div className="star-fill" style={{ width: `${starAnalysis.actionPresentRate}%` }}></div></div>
              </div>
              <div className="star-rate-item">
                <span className="star-part">Result</span>
                <span className="star-pct">{starAnalysis.resultPresentRate}%</span>
                <div className="star-bar"><div className="star-fill" style={{ width: `${starAnalysis.resultPresentRate}%` }}></div></div>
              </div>
            </div>

            {starAnalysis.missingComponentsSummary && starAnalysis.missingComponentsSummary.length > 0 && (
              <div className="star-missing-box">
                <h6>Observations on Missing STAR Components:</h6>
                <ul>
                  {starAnalysis.missingComponentsSummary.map((msg, i) => (
                    <li key={i}>• {msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 5: Topics Performance Breakdown */}
      {topics && topics.length > 0 && (
        <section className="report-section">
          <div className="section-header">
            <span className="section-icon">🏷️</span>
            <h2>Topic & Domain Mastery Breakdown</h2>
          </div>
          <div className="topics-table-card">
            <table className="topics-table">
              <thead>
                <tr>
                  <th>Topic Domain</th>
                  <th>Questions</th>
                  <th>Evaluated</th>
                  <th>Average Score</th>
                  <th>Proficiency</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t, i) => {
                  const tBadge = getScoreBadge(t.averageScore);
                  return (
                    <tr key={i}>
                      <td className="font-semibold text-slate-200">{t.topic}</td>
                      <td>{t.questionCount}</td>
                      <td>{t.evaluatedCount}</td>
                      <td>
                        <strong className="text-slate-100">{t.averageScore !== null ? `${t.averageScore}/10` : '—'}</strong>
                      </td>
                      <td>
                        <span className={`dim-mini-badge ${tBadge.class}`}>{tBadge.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bottom Actions */}
      <div className="report-footer-actions">
        <button className="btn-secondary btn-lg" onClick={() => onNavigate('dashboard')}>
          ← Return to Dashboard
        </button>
        <button className="btn-primary btn-lg" onClick={() => onNavigate('setup')}>
          Practice Another Interview →
        </button>
      </div>
    </div>
  );
}
