import React, { useState } from 'react';
import ConversationalOrb from './ConversationalOrb';
import VoiceWaveform from './VoiceWaveform';
import VoiceSettingsPanel from './VoiceSettingsPanel';
import { VOICE_STATES } from '../../hooks/useVoiceInterview';

const ContinuousVoiceStudio = ({
  session,
  voiceHook,
  onNavigate
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const {
    voiceState,
    conversation,
    evaluations,
    currentTurn,
    audioLevel,
    liveTranscript,
    errorMessage,
    isPaused,
    hasStarted,
    voiceSettings,
    updateSettings,
    startContinuousInterview,
    pauseInterview,
    resumeInterview,
    replayCurrentQuestion,
    endInterview,
    retryListening
  } = voiceHook;

  const sessionId = session?.id;
  const roleTitle = session?.target_role || session?.targetRole || 'Software Engineer';
  const interviewType = session?.interview_type || session?.interviewType || 'technical';
  const difficulty = session?.difficulty || 'intermediate';
  const questionCount = session?.question_count || session?.questionCount || 10;

  const currentNum = currentTurn
    ? (currentTurn.turn_number || currentTurn.turnNumber)
    : (voiceState === VOICE_STATES.COMPLETED ? questionCount : (conversation.length || 1));
  const progressPercent = Math.min(100, Math.round((currentNum / questionCount) * 100));

  const activeQuestionText = currentTurn?.question || (conversation.length > 0 ? conversation[conversation.length - 1]?.question : '');

  const isUserSpeaking = voiceState === VOICE_STATES.USER_SPEAKING;
  const isListening = voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE;
  const isAISpeaking = voiceState === VOICE_STATES.AI_SPEAKING;
  const isCompleted = voiceState === VOICE_STATES.COMPLETED;

  return (
    <div className="continuous-voice-studio">
      {/* Studio Header Bar */}
      <header className="voice-studio-header">
        <div className="header-meta-left">
          <div className="live-indicator-pill">
            <span className="pulsing-live-dot"></span>
            <span>CONTINUOUS AI VOICE INTERVIEW</span>
          </div>
          <h2 className="voice-studio-role">{roleTitle}</h2>
          <div className="voice-meta-badges">
            <span className="badge-tag">{interviewType.toUpperCase()}</span>
            <span className="badge-tag">{difficulty.toUpperCase()}</span>
            <span className="badge-tag mode-voice">🎙 {voiceSettings?.voiceName || 'NATURAL TTS'}</span>
          </div>
        </div>

        <div className="header-meta-right">
          <div className="voice-progress-box">
            <span className="progress-label">
              Question <strong>{currentNum}</strong> of <strong>{questionCount}</strong>
            </span>
            <div className="progress-track">
              <div className="progress-indicator" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
          <button
            className="btn-history-toggle"
            onClick={() => setShowSettingsModal(true)}
            title="Adjust voice and pacing settings"
          >
            ⚙️ Voice Settings
          </button>
          <button
            className="btn-history-toggle"
            onClick={() => setShowHistory(!showHistory)}
            title="Toggle previous turn evaluations"
          >
            📋 {showHistory ? 'Hide Feed' : `Feed (${conversation.length})`}
          </button>
        </div>
      </header>

      {/* Main Continuous Voice Stage */}
      <div className="voice-stage-grid">
        <div className="voice-main-stage">
          {/* Central AI Conversational Orb */}
          <div className="orb-wrapper-card">
            <ConversationalOrb
              voiceState={voiceState}
              audioLevel={audioLevel}
              isPaused={isPaused}
            />
          </div>

          {/* Pre-Interview Voice Settings & Start Card */}
          {!hasStarted && !isCompleted && (
            <div className="voice-prestart-container">
              <div className="prestart-settings-wrapper">
                <VoiceSettingsPanel
                  value={voiceSettings}
                  onChange={updateSettings}
                  compact={false}
                />
              </div>

              <div className="voice-start-card">
                <div className="start-prompt-info">
                  <h3>Ready for Your Continuous AI Interview?</h3>
                  <p>
                    Once started, the AI interviewer will speak each question using your chosen voice. The microphone will activate automatically when the AI finishes speaking, and your answers will be evaluated seamlessly hands-free.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-start-continuous"
                  onClick={startContinuousInterview}
                >
                  <span className="mic-icon">🎙</span> Start AI Voice Interview
                </button>
              </div>
            </div>
          )}

          {/* Active AI Question Showcase Card */}
          {hasStarted && !isCompleted && (
            <div className={`ai-question-card ${isAISpeaking ? 'speaking-active' : ''}`}>
              <div className="question-card-header">
                <span className="ai-icon">🤖</span>
                <span className="question-index">Question #{currentNum}</span>
                {currentTurn?.question_type === 'follow_up' && (
                  <span className="tag-followup">⚡ ADAPTIVE FOLLOW-UP</span>
                )}
                {(currentTurn?.question_topic || currentTurn?.topic) && (
                  <span className="topic-badge">{currentTurn?.question_topic || currentTurn?.topic}</span>
                )}
              </div>
              <p className="ai-question-text">
                {activeQuestionText || 'Preparing your interview questions...'}
              </p>
            </div>
          )}

          {/* Candidate Listening & Live Waveform Stage */}
          {!isCompleted && hasStarted && (
            <div className="candidate-listening-card">
              <VoiceWaveform
                audioLevel={audioLevel}
                isUserSpeaking={isUserSpeaking}
                isListening={isListening}
              />

              {/* Live Caption / Transcript display */}
              {liveTranscript && (
                <div className="live-transcript-caption">
                  <span className="caption-label">Transcript:</span>
                  <span className="caption-text">"{liveTranscript}"</span>
                </div>
              )}
            </div>
          )}

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="voice-error-banner">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <strong>Attention:</strong> {errorMessage}
              </div>
              <button className="btn-retry-voice" onClick={retryListening}>
                Retry Listening
              </button>
            </div>
          )}

          {/* Completion Celebration Card */}
          {isCompleted && (
            <div className="voice-completed-card">
              <div className="completed-icon">🏆</div>
              <h3>Interview Completed Successfully</h3>
              <p>
                All your spoken responses have been transcribed, evaluated, and compiled into your comprehensive performance report.
              </p>
              <div className="completed-actions">
                <button
                  className="btn-primary btn-lg"
                  onClick={() => onNavigate('report', sessionId)}
                >
                  View Performance Scorecard & Analytics 📊
                </button>
                <button
                  className="btn-secondary btn-lg"
                  onClick={() => onNavigate('dashboard')}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Secondary Controls Bar */}
          {hasStarted && !isCompleted && (
            <div className="voice-controls-bar">
              {isPaused ? (
                <button className="btn-control resume" onClick={resumeInterview}>
                  ▶ Resume Interview
                </button>
              ) : (
                <button className="btn-control pause" onClick={pauseInterview}>
                  ⏸ Pause Interview
                </button>
              )}

              <button
                className="btn-control replay"
                onClick={replayCurrentQuestion}
                disabled={isAISpeaking || isUserSpeaking}
              >
                🔊 Replay Question
              </button>

              <button className="btn-control end" onClick={endInterview}>
                ⏹ End Interview
              </button>
            </div>
          )}
        </div>

        {/* Turn History / Feedback Drawer (Toggleable) */}
        {showHistory && (
          <aside className="voice-history-drawer">
            <div className="history-drawer-header">
              <h4>Conversation History & Feedbacks</h4>
              <button className="btn-close-drawer" onClick={() => setShowHistory(false)}>
                ✕
              </button>
            </div>

            <div className="history-feed-list">
              {conversation.length === 0 ? (
                <div className="empty-history">
                  <p>No answers recorded yet. Start speaking when the question finishes.</p>
                </div>
              ) : (
                conversation.map((turn, index) => {
                  const turnKey = turn.turnNumber || index + 1;
                  const ev = evaluations[turnKey] || evaluations[turn.id];

                  return (
                    <div key={turnKey} className="history-turn-item">
                      <div className="turn-q">
                        <span className="q-badge">Q#{turnKey}</span>
                        <p>{turn.question}</p>
                      </div>
                      {turn.studentAnswer && (
                        <div className="turn-a">
                          <span className="a-badge">Your Answer</span>
                          <p>{turn.studentAnswer}</p>
                        </div>
                      )}
                      {ev && (
                        <div className="turn-eval-summary">
                          <div className="eval-scores-mini">
                            <span>Relevance: <strong>{ev.relevance}/10</strong></span>
                            <span>Completeness: <strong>{ev.completeness}/10</strong></span>
                            <span>Clarity: <strong>{ev.clarity}/10</strong></span>
                          </div>
                          {ev.improvementSuggestion && (
                            <p className="eval-mini-suggestion">💡 {ev.improvementSuggestion}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* Settings Modal (Adjustable during active session) */}
        {showSettingsModal && (
          <div className="voice-modal-backdrop" onClick={() => setShowSettingsModal(false)}>
            <div className="voice-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="voice-modal-header">
                <h4>Voice & Conversation Settings</h4>
                <button className="btn-close-drawer" onClick={() => setShowSettingsModal(false)}>
                  ✕
                </button>
              </div>
              <div className="voice-modal-body">
                <VoiceSettingsPanel
                  value={voiceSettings}
                  onChange={updateSettings}
                  compact={true}
                />
              </div>
              <div className="voice-modal-footer">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowSettingsModal(false)}
                >
                  Save & Return to Interview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContinuousVoiceStudio;
