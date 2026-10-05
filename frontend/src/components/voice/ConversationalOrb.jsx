import React from 'react';
import { VOICE_STATES } from '../../hooks/useVoiceInterview';

const ConversationalOrb = ({ voiceState, audioLevel = 0, isPaused = false }) => {
  const getOrbDetails = () => {
    if (isPaused) {
      return {
        mode: 'paused',
        title: 'Interview Paused',
        caption: 'Press Resume when you are ready to continue',
        colorClass: 'orb-paused',
        badge: '⏸ PAUSED',
        badgeClass: 'badge-paused'
      };
    }

    switch (voiceState) {
      case VOICE_STATES.INITIALIZING:
        return {
          mode: 'initializing',
          title: 'Initializing Voice System...',
          caption: 'Setting up audio hardware and loading questions',
          colorClass: 'orb-initializing',
          badge: '⚡ INITIALIZING',
          badgeClass: 'badge-init'
        };

      case VOICE_STATES.AI_SPEAKING:
        return {
          mode: 'ai_speaking',
          title: 'AI Interviewer Speaking...',
          caption: 'Listen carefully to the question',
          colorClass: 'orb-speaking',
          badge: '🔊 AI SPEAKING',
          badgeClass: 'badge-speaking'
        };

      case VOICE_STATES.WAITING_FOR_CANDIDATE:
        return {
          mode: 'waiting',
          title: 'Listening for Your Answer',
          caption: 'Speak naturally. Silence will automatically be detected when you finish.',
          colorClass: 'orb-listening',
          badge: '🎙 LISTENING',
          badgeClass: 'badge-listening'
        };

      case VOICE_STATES.USER_SPEAKING:
        return {
          mode: 'user_speaking',
          title: 'Candidate Speaking...',
          caption: 'Audio is actively recording. Pause when you have completed your answer.',
          colorClass: 'orb-user-speaking',
          badge: '● RECORDING',
          badgeClass: 'badge-user-speaking'
        };

      case VOICE_STATES.PROCESSING_AUDIO:
      case VOICE_STATES.TRANSCRIBING:
        return {
          mode: 'transcribing',
          title: 'Transcribing Speech...',
          caption: 'Converting spoken answer into structured text',
          colorClass: 'orb-transcribing',
          badge: '⚡ TRANSCRIBING',
          badgeClass: 'badge-transcribing'
        };

      case VOICE_STATES.EVALUATING:
      case VOICE_STATES.AI_THINKING:
      case VOICE_STATES.PREPARING_NEXT_QUESTION:
        return {
          mode: 'evaluating',
          title: 'Evaluating & Adapting...',
          caption: 'Analyzing answer depth and preparing follow-up',
          colorClass: 'orb-evaluating',
          badge: '🧠 EVALUATING',
          badgeClass: 'badge-evaluating'
        };

      case VOICE_STATES.COMPLETED:
        return {
          mode: 'completed',
          title: 'Interview Complete',
          caption: 'Generating your performance scorecard and analytics',
          colorClass: 'orb-completed',
          badge: '🎉 COMPLETED',
          badgeClass: 'badge-completed'
        };

      case VOICE_STATES.ERROR:
        return {
          mode: 'error',
          title: 'Voice Interrupted',
          caption: 'Please check microphone permissions or retry',
          colorClass: 'orb-error',
          badge: '⚠️ ATTENTION NEEDED',
          badgeClass: 'badge-error'
        };

      case VOICE_STATES.IDLE:
      default:
        return {
          mode: 'idle',
          title: 'Ready to Begin',
          caption: 'Click Start Interview to begin continuous AI voice conversation',
          colorClass: 'orb-idle',
          badge: '🎙 READY',
          badgeClass: 'badge-idle'
        };
    }
  };

  const details = getOrbDetails();
  const dynamicScale = voiceState === VOICE_STATES.USER_SPEAKING ? 1 + audioLevel * 0.4 : 1;

  return (
    <div className="conversational-orb-container">
      {/* Orb Stage */}
      <div className="orb-stage">
        {/* Outer Glow Ring */}
        <div className={`orb-outer-glow ${details.colorClass}`} style={{ transform: `scale(${dynamicScale})` }}></div>
        
        {/* Core Animated Sphere */}
        <div className={`orb-core ${details.colorClass}`}>
          <div className="orb-inner-light"></div>
          <div className="orb-particles">
            <span className="particle p1"></span>
            <span className="particle p2"></span>
            <span className="particle p3"></span>
          </div>
        </div>
      </div>

      {/* Dynamic Status Text */}
      <div className="orb-status-section">
        <div className={`orb-status-badge ${details.badgeClass}`}>
          <span className="orb-badge-dot"></span>
          <span>{details.badge}</span>
        </div>
        <h3 className="orb-title">{details.title}</h3>
        <p className="orb-caption">{details.caption}</p>
      </div>
    </div>
  );
};

export default ConversationalOrb;
