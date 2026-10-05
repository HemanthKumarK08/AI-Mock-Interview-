import { useState, useEffect } from 'react';
import InterviewService from '../services/interviewService';
import ApiService from '../services/api';
import VoiceSettingsPanel from '../components/voice/VoiceSettingsPanel';

const DEFAULT_ROLES = [
  'Software Engineer',
  'Java Developer',
  'Python Developer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer'
];

export default function InterviewSetup({ onNavigate, onConfigSaved }) {
  const [targetRole, setTargetRole] = useState(DEFAULT_ROLES[0]);
  const [interviewType, setInterviewType] = useState('technical');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [interviewMode, setInterviewMode] = useState('text');
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadCandidateTarget() {
      try {
        const res = await ApiService.getProfile();
        if (res.success && res.data?.profile?.target_role) {
          const userTarget = res.data.profile.target_role;
          const match = DEFAULT_ROLES.find(r => r.toLowerCase() === userTarget.toLowerCase());
          if (match) {
            setTargetRole(match);
          }
        }
      } catch (err) {
        // Non-fatal
      } finally {
        setLoadingProfile(false);
      }
    }
    loadCandidateTarget();
  }, []);

  const handleProceed = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!targetRole) {
      setErrorMsg('Please select a target job role');
      return;
    }

    const config = {
      targetRole,
      interviewType,
      difficulty,
      interviewMode,
      questionCount: parseInt(questionCount, 10),
      durationMinutes: parseInt(durationMinutes, 10)
    };

    onConfigSaved(config);
    onNavigate('review');
  };

  return (
    <div className="setup-container">
      <div className="page-header">
        <div className="header-info">
          <h2>Configure Your Mock Interview</h2>
          <p>Customize your interview parameters to tailor the simulation to your goals</p>
        </div>
        <button className="btn-secondary" onClick={() => onNavigate('dashboard')}>
          Back to Dashboard
        </button>
      </div>

      {errorMsg && (
        <div className="alert-box alert-danger">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      <form onSubmit={handleProceed} className="setup-form">
        {/* Target Role */}
        <div className="card setup-card">
          <div className="setup-card-header">
            <span className="step-number">1</span>
            <div>
              <h3>Target Job Role</h3>
              <p className="text-muted">Select the role you are interviewing for</p>
            </div>
          </div>
          <div className="role-grid">
            {DEFAULT_ROLES.map((role) => (
              <button
                type="button"
                key={role}
                className={`role-select-btn ${targetRole === role ? 'selected' : ''}`}
                onClick={() => setTargetRole(role)}
              >
                <span className="role-btn-title">{role}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interview Type & Difficulty */}
        <div className="setup-two-col">
          <div className="card setup-card">
            <div className="setup-card-header">
              <span className="step-number">2</span>
              <div>
                <h3>Interview Type</h3>
                <p className="text-muted">Focus domain for the questions</p>
              </div>
            </div>
            <div className="option-button-group">
              {[
                { id: 'technical', label: 'Technical', desc: 'Core architecture, coding concepts & design' },
                { id: 'behavioral', label: 'Behavioral', desc: 'STAR methodology, leadership & teamwork' },
                { id: 'hr', label: 'HR & Fit', desc: 'Background, motivation & career goals' },
                { id: 'mixed', label: 'Mixed', desc: 'Balanced combination of technical & behavioral' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  className={`option-btn ${interviewType === opt.id ? 'selected' : ''}`}
                  onClick={() => setInterviewType(opt.id)}
                >
                  <span className="opt-title">{opt.label}</span>
                  <span className="opt-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card setup-card">
            <div className="setup-card-header">
              <span className="step-number">3</span>
              <div>
                <h3>Difficulty Level</h3>
                <p className="text-muted">Choose your target rigor level</p>
              </div>
            </div>
            <div className="option-button-group">
              {[
                { id: 'beginner', label: 'Beginner / Junior', desc: 'Entry-level fundamentals and standard scenarios' },
                { id: 'intermediate', label: 'Intermediate / Mid-Level', desc: 'Applied problem solving, optimization & deep dives' },
                { id: 'advanced', label: 'Advanced / Senior', desc: 'High-complexity system challenges & leadership edge cases' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  className={`option-btn ${difficulty === opt.id ? 'selected' : ''}`}
                  onClick={() => setDifficulty(opt.id)}
                >
                  <span className="opt-title">{opt.label}</span>
                  <span className="opt-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode, Question Count & Duration */}
        <div className="card setup-card">
          <div className="setup-card-header">
            <span className="step-number">4</span>
            <div>
              <h3>Interview Format & Scope</h3>
              <p className="text-muted">Configure mode, length, and time limit</p>
            </div>
          </div>

          <div className="scope-grid">
            {/* Mode */}
            <div className="scope-section">
              <label className="scope-label">Response Mode</label>
              <div className="pill-group">
                <button
                  type="button"
                  className={`pill-btn ${interviewMode === 'text' ? 'selected' : ''}`}
                  onClick={() => setInterviewMode('text')}
                >
                  💬 Text Chat
                </button>
                <button
                  type="button"
                  className={`pill-btn ${interviewMode === 'voice' ? 'selected' : ''}`}
                  onClick={() => setInterviewMode('voice')}
                >
                  🎙️ Voice Audio
                </button>
              </div>
            </div>

            {/* Questions */}
            <div className="scope-section">
              <label className="scope-label">Number of Questions</label>
              <div className="pill-group">
                {[5, 10, 15, 20].map(count => (
                  <button
                    type="button"
                    key={count}
                    className={`pill-btn ${questionCount === count ? 'selected' : ''}`}
                    onClick={() => setQuestionCount(count)}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="scope-section">
              <label className="scope-label">Estimated Duration</label>
              <div className="pill-group">
                {[15, 30, 45, 60].map(dur => (
                  <button
                    type="button"
                    key={dur}
                    className={`pill-btn ${durationMinutes === dur ? 'selected' : ''}`}
                    onClick={() => setDurationMinutes(dur)}
                  >
                    {dur} min
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Voice Settings Section (Shown if Voice Mode is selected) */}
        {interviewMode === 'voice' && (
          <div className="card setup-card voice-config-card animate-fade-in">
            <div className="setup-card-header">
              <span className="step-number">5</span>
              <div>
                <h3>AI Interviewer Voice Settings</h3>
                <p className="text-muted">Select and preview your AI interviewer's voice and speech cadence</p>
              </div>
            </div>
            <VoiceSettingsPanel compact={false} />
          </div>
        )}

        <div className="setup-actions">
          <button type="submit" className="btn-primary btn-lg">
            Review Configuration & Proceed →
          </button>
        </div>
      </form>
    </div>
  );
}

