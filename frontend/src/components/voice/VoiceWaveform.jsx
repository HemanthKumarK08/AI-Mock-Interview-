import React from 'react';

const VoiceWaveform = ({ audioLevel = 0, isUserSpeaking = false, isListening = false }) => {
  // Generate 16 responsive audio waveform bars
  const bars = [0.2, 0.4, 0.65, 0.9, 1.0, 0.85, 0.6, 0.4, 0.5, 0.8, 1.0, 0.75, 0.5, 0.35, 0.2, 0.1];

  return (
    <div className="voice-waveform-container">
      <div className="voice-waveform-bars">
        {bars.map((barScale, index) => {
          let heightPercent = 15;
          if (isUserSpeaking) {
            // Live reactivity to microphone audio level
            heightPercent = Math.max(15, Math.min(100, Math.round(barScale * audioLevel * 100)));
          } else if (isListening) {
            // Subtle breathing motion while waiting for candidate
            heightPercent = 18 + Math.sin(index + Date.now() / 300) * 8;
          }

          return (
            <div
              key={index}
              className={`waveform-bar ${isUserSpeaking ? 'active-speaking' : isListening ? 'active-listening' : 'idle'}`}
              style={{
                height: `${heightPercent}%`,
                transition: 'height 0.08s ease'
              }}
            />
          );
        })}
      </div>

      <div className="waveform-footer-label">
        {isUserSpeaking ? (
          <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Voice detected • Recording automatically
          </span>
        ) : isListening ? (
          <span className="text-cyan-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            Microphone active • Speak when ready
          </span>
        ) : (
          <span className="text-slate-500">Audio input standby</span>
        )}
      </div>
    </div>
  );
};

export default VoiceWaveform;
