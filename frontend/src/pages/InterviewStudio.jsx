import { useState, useEffect, useRef } from 'react';
import InterviewService from '../services/interviewService';
import VoicePlayer from '../components/voice/VoicePlayer';
import ContinuousVoiceStudio from '../components/voice/ContinuousVoiceStudio';
import useVoiceInterview from '../hooks/useVoiceInterview';

export default function InterviewStudio({ session, onNavigate }) {
  const [conversation, setConversation] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [currentTurn, setCurrentTurn] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionData, setSessionData] = useState(session);
  const conversationEndRef = useRef(null);

  const sessionId = session?.id || sessionData?.id;
  const interviewMode = sessionData?.interview_mode || sessionData?.interviewMode || session?.interview_mode || session?.interviewMode || 'text';
  const isVoiceMode = interviewMode === 'voice';

  // Continuous Voice Orchestration Hook
  const voiceHook = useVoiceInterview({
    sessionId,
    sessionData: sessionData || session,
    onNavigate,
    onSessionUpdate: (updated) => setSessionData(updated)
  });

  const scrollToBottom = () => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isVoiceMode) {
      scrollToBottom();
    }
  }, [conversation, evaluations, currentTurn, submitting, isCompleted, isVoiceMode]);

  // Load / Recover interview state & evaluations on mount or refresh (for text mode)
  useEffect(() => {
    if (isVoiceMode) return; // Continuous voice studio manages its own initialization upon candidate gesture

    async function initInterview() {
      if (!sessionId) {
        setErrorMsg('No active interview session ID provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const startRes = await InterviewService.startInterview(sessionId);
        if (startRes.success) {
          if (startRes.data?.session) {
            setSessionData(startRes.data.session);
          }
          if (startRes.data?.completed) {
            setIsCompleted(true);
          } else if (startRes.data?.currentTurn) {
            setCurrentTurn(startRes.data.currentTurn);
          }
        }

        // Fetch complete conversation history
        const convRes = await InterviewService.getConversation(sessionId);
        if (convRes.success && Array.isArray(convRes.data?.conversation)) {
          setConversation(convRes.data.conversation);
          if (convRes.data.status === 'completed') {
            setIsCompleted(true);
          }
        }

        // Fetch all persisted evaluations
        const evalRes = await InterviewService.getEvaluations(sessionId);
        if (evalRes.success && Array.isArray(evalRes.data?.evaluations)) {
          const evalMap = {};
          evalRes.data.evaluations.forEach(ev => {
            evalMap[ev.turnNumber || ev.conversationId] = ev;
          });
          setEvaluations(evalMap);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to initialize AI interview session');
      } finally {
        setLoading(false);
      }
    }

    initInterview();
  }, [sessionId, isVoiceMode]);

  const submitAnswerText = async (answerText) => {
    if (!answerText.trim() || submitting || isCompleted) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await InterviewService.submitAnswer(sessionId, answerText.trim());
      if (res.success) {
        setCurrentAnswer('');

        // Store evaluation if returned
        if (res.data?.evaluation) {
          const ev = res.data.evaluation;
          setEvaluations(prev => ({
            ...prev,
            [ev.turnNumber || ev.conversationId || (conversation.length + 1)]: ev
          }));
        }

        // Refresh conversation history
        const convRes = await InterviewService.getConversation(sessionId);
        if (convRes.success && Array.isArray(convRes.data?.conversation)) {
          setConversation(convRes.data.conversation);
        }

        // Re-fetch all evaluations to ensure synchronization
        const evalRes = await InterviewService.getEvaluations(sessionId);
        if (evalRes.success && Array.isArray(evalRes.data?.evaluations)) {
          const evalMap = {};
          evalRes.data.evaluations.forEach(ev => {
            evalMap[ev.turnNumber || ev.conversationId] = ev;
          });
          setEvaluations(evalMap);
        }

        if (res.data?.completed) {
          setIsCompleted(true);
          setCurrentTurn(null);
        } else if (res.data?.currentTurn || res.data?.nextQuestion) {
          setCurrentTurn(res.data.currentTurn || res.data.nextQuestion);
        }
      } else {
        setErrorMsg(res.message || 'Unable to submit answer. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error submitting response. Your answer has been preserved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitTextAnswer = async (e) => {
    if (e) e.preventDefault();
    await submitAnswerText(currentAnswer);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmitTextAnswer();
    }
  };

  if (!sessionId) {
    return (
      <div className="auth-redirect-container">
        <div className="auth-redirect-box">
          <h3>No Session Found</h3>
          <p>Please select or configure an interview session from the dashboard.</p>
          <button className="btn-primary" onClick={() => onNavigate('dashboard')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If Voice Mode is active -> Render Continuous AI Voice Experience
  if (isVoiceMode) {
    return (
      <ContinuousVoiceStudio
        session={sessionData || session}
        voiceHook={voiceHook}
        onNavigate={onNavigate}
      />
    );
  }

  const roleTitle = sessionData?.target_role || sessionData?.targetRole || 'Software Engineer';
  const interviewType = sessionData?.interview_type || sessionData?.interviewType || 'technical';
  const difficulty = sessionData?.difficulty || 'intermediate';
  const questionCount = sessionData?.question_count || sessionData?.questionCount || 10;
  const currentNum = currentTurn ? (currentTurn.turn_number || currentTurn.turnNumber) : (isCompleted ? questionCount : (conversation.length || 1));
  const progressPercent = Math.min(100, Math.round((currentNum / questionCount) * 100));

  return (
    <div className="studio-layout">
      {/* Top Studio Header */}
      <header className="studio-header">
        <div className="studio-header-left">
          <div className="studio-badge-live">
            <span className="live-dot"></span> LIVE INTERVIEW #{sessionId}
          </div>
          <h2 className="studio-role-title">{roleTitle}</h2>
          <div className="studio-meta-tags">
            <span className="studio-tag type">{interviewType.toUpperCase()}</span>
            <span className="studio-tag diff">{difficulty.toUpperCase()}</span>
            <span className="studio-tag mode">💬 TEXT MODE</span>
          </div>
        </div>

        <div className="studio-header-right">
          <div className="progress-info">
            <span className="progress-text">
              Question <strong>{currentNum}</strong> of <strong>{questionCount}</strong>
            </span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => onNavigate('dashboard')}>
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="studio-body">
        {/* Conversation Feed */}
        <div className="conversation-scroll-container">
          {loading ? (
            <div className="loading-container" style={{ minHeight: '300px' }}>
              <div className="spinner"></div>
              <p>Initializing AI Interviewer & Evaluator...</p>
            </div>
          ) : (
            <div className="conversation-feed">
              {conversation.map((turn, index) => {
                const turnKey = turn.turnNumber || (index + 1);
                const ev = evaluations[turnKey] || evaluations[turn.id];

                return (
                  <div key={turnKey} className="turn-pair">
                    {/* AI Question Bubble */}
                    <div className="chat-bubble ai-bubble">
                      <div className="bubble-avatar ai-avatar">🤖</div>
                      <div className="bubble-content">
                        <div className="bubble-sender">
                          <span>AI Interviewer</span>
                          <span className="turn-label">Question #{turnKey}</span>
                          {turn.questionType === 'follow_up' && <span className="tag-followup">⚡ FOLLOW-UP</span>}
                          {turn.topic && <span className="topic-badge">{turn.topic}</span>}
                        </div>
                        <div className="bubble-text">{turn.question}</div>
                      </div>
                    </div>

                    {/* Student Answer Bubble */}
                    {turn.studentAnswer && (
                      <div className="chat-bubble user-bubble">
                        <div className="bubble-content user-content">
                          <div className="bubble-sender user-sender">
                            <span>You (Candidate)</span>
                          </div>
                          <div className="bubble-text">{turn.studentAnswer}</div>
                        </div>
                        <div className="bubble-avatar user-avatar">👤</div>
                      </div>
                    )}

                    {/* Phase 4 Answer Evaluation Feedback */}
                    {turn.studentAnswer && ev && (
                      <div className="evaluation-feedback-card">
                        <div className="evaluation-header">
                          <div className="evaluation-title">
                            <span className="eval-badge">⚡ AI EVALUATION</span>
                            <h4>Turn #{turnKey} Feedback</h4>
                          </div>
                          <div className="eval-confidence">
                            Confidence: {Math.round((ev.evaluationConfidence || 0.85) * 100)}%
                          </div>
                        </div>

                        {/* Dimensions Grid */}
                        <div className="eval-dimensions-grid">
                          {ev.technicalAccuracy !== null && ev.technicalAccuracy !== undefined && (
                            <div className="dimension-pill">
                              <span className="dim-name">Technical Accuracy</span>
                              <strong className={`dim-score ${ev.technicalAccuracy >= 7 ? 'good' : ev.technicalAccuracy >= 5 ? 'avg' : 'low'}`}>
                                {ev.technicalAccuracy} / 10
                              </strong>
                            </div>
                          )}
                          <div className="dimension-pill">
                            <span className="dim-name">Relevance</span>
                            <strong className={`dim-score ${ev.relevance >= 7 ? 'good' : ev.relevance >= 5 ? 'avg' : 'low'}`}>
                              {ev.relevance} / 10
                            </strong>
                          </div>
                          <div className="dimension-pill">
                            <span className="dim-name">Completeness</span>
                            <strong className={`dim-score ${ev.completeness >= 7 ? 'good' : ev.completeness >= 5 ? 'avg' : 'low'}`}>
                              {ev.completeness} / 10
                            </strong>
                          </div>
                          <div className="dimension-pill">
                            <span className="dim-name">Clarity</span>
                            <strong className={`dim-score ${ev.clarity >= 7 ? 'good' : ev.clarity >= 5 ? 'avg' : 'low'}`}>
                              {ev.clarity} / 10
                            </strong>
                          </div>
                          <div className="dimension-pill">
                            <span className="dim-name">Communication</span>
                            <strong className={`dim-score ${ev.communication >= 7 ? 'good' : ev.communication >= 5 ? 'avg' : 'low'}`}>
                              {ev.communication} / 10
                            </strong>
                          </div>
                        </div>

                        {/* Behavioral STAR Breakdown */}
                        {ev.star && (
                          <div className="star-feedback-section">
                            <div className="star-title">
                              <span>STAR Structure Analysis</span>
                              {ev.starCompleteness !== null && (
                                <span className="star-badge">STAR Completeness: {ev.starCompleteness}/10</span>
                              )}
                            </div>
                            <div className="star-indicators">
                              <span className={`star-item ${ev.star.situation ? 'present' : 'missing'}`}>
                                {ev.star.situation ? '✓' : '✗'} Situation
                              </span>
                              <span className={`star-item ${ev.star.task ? 'present' : 'missing'}`}>
                                {ev.star.task ? '✓' : '✗'} Task
                              </span>
                              <span className={`star-item ${ev.star.action ? 'present' : 'missing'}`}>
                                {ev.star.action ? '✓' : '✗'} Action
                              </span>
                              <span className={`star-item ${ev.star.result ? 'present' : 'missing'}`}>
                                {ev.star.result ? '✓' : '✗'} Result
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Strengths & Weaknesses */}
                        <div className="eval-points-row">
                          {Array.isArray(ev.strengths) && ev.strengths.length > 0 && (
                            <div className="eval-strengths">
                              <h6>Strengths</h6>
                              <ul>
                                {ev.strengths.map((str, i) => (
                                  <li key={i}>✓ {str}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(ev.weaknesses) && ev.weaknesses.length > 0 && (
                            <div className="eval-weaknesses">
                              <h6>Areas to Improve</h6>
                              <ul>
                                {ev.weaknesses.map((wk, i) => (
                                  <li key={i}>• {wk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Actionable Improvement */}
                        {ev.improvementSuggestion && (
                          <div className="eval-suggestion">
                            <span className="suggestion-icon">💡</span>
                            <div className="suggestion-text">
                              <strong>Recommendation:</strong> {ev.improvementSuggestion}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Current Active Turn if not already in conversation list */}
              {currentTurn && !conversation.some(t => t.turnNumber === (currentTurn.turn_number || currentTurn.turnNumber)) && (
                <div className="turn-pair active-turn">
                  <div className="chat-bubble ai-bubble active-ai">
                    <div className="bubble-avatar ai-avatar">🤖</div>
                    <div className="bubble-content">
                      <div className="bubble-sender">
                        <span>AI Interviewer</span>
                        <span className="turn-label">Question #{currentTurn.turn_number || currentTurn.turnNumber}</span>
                        {currentTurn.question_type === 'follow_up' && <span className="tag-followup">⚡ FOLLOW-UP</span>}
                        {(currentTurn.question_topic || currentTurn.topic) && (
                          <span className="topic-badge">{currentTurn.question_topic || currentTurn.topic}</span>
                        )}
                      </div>
                      <div className="bubble-text highlight-question">{currentTurn.question}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submitting / AI Thinking Animation */}
              {submitting && (
                <div className="ai-thinking-card">
                  <div className="thinking-spinner"></div>
                  <span>AI is evaluating your answer and preparing the next adaptive question...</span>
                </div>
              )}

              {/* Completion Banner */}
              {isCompleted && (
                <div className="completion-card">
                  <div className="completion-icon">🎉</div>
                  <h3>Interview Session Completed</h3>
                  <p>
                    You have completed all questions for the <strong>{roleTitle}</strong> mock interview simulation.
                  </p>
                  <p className="completion-note">
                    All question evaluations have been recorded and saved.
                  </p>
                  <div className="completion-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn-primary btn-lg" onClick={() => onNavigate('report', sessionId)}>
                      View Performance Report 📊
                    </button>
                    <button className="btn-secondary btn-lg" onClick={() => onNavigate('dashboard')}>
                      Return to Dashboard →
                    </button>
                  </div>
                </div>
              )}

              <div ref={conversationEndRef} />
            </div>
          )}
        </div>

        {/* Answer Composer (Visible only if interview is in progress) */}
        {!isCompleted && (
          <div className="composer-container">
            {errorMsg && (
              <div className="alert-box alert-danger">
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitTextAnswer} className="composer-form">
              <div className="composer-wrapper">
                <textarea
                  className="composer-textarea"
                  rows="4"
                  placeholder="Type your answer here in detail... (Press Ctrl+Enter or Cmd+Enter to submit)"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={submitting || loading}
                  maxLength={5000}
                  autoFocus
                />
                <div className="composer-footer">
                  <span className="char-count">{currentAnswer.length} / 5000 characters</span>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting || loading || !currentAnswer.trim()}
                  >
                    {submitting ? 'Analyzing Answer...' : 'Submit Answer ↵'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
