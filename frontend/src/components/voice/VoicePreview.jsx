import React, { useState, useEffect } from 'react';
import ttsServiceInstance from '../../services/tts/ttsService';
import { PREVIEW_PHRASES } from '../../services/voiceSettingsService';

const VoicePreview = ({ settings }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    return () => {
      ttsServiceInstance.stop();
    };
  }, []);

  const handlePlayPreview = () => {
    setErrorMsg(null);
    setIsPlaying(true);

    const phrase = PREVIEW_PHRASES[phraseIndex];

    ttsServiceInstance.preview(
      phrase,
      settings,
      () => {
        setIsPlaying(false);
      },
      (err) => {
        setIsPlaying(false);
        console.warn('[VoicePreview] Error:', err);
        setErrorMsg('Voice preview was interrupted or not supported. You can still proceed with the interview.');
      }
    );
  };

  const handleStopPreview = () => {
    ttsServiceInstance.stop();
    setIsPlaying(false);
  };

  return (
    <div className="voice-preview-box">
      <div className="preview-controls-row">
        {isPlaying ? (
          <button
            type="button"
            className="btn-preview active"
            onClick={handleStopPreview}
          >
            <span className="w-2.5 h-2.5 bg-white rounded-xs animate-pulse"></span>
            <span>Stop Preview</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-preview"
            onClick={handlePlayPreview}
          >
            <span>🔊</span>
            <span>Preview AI Voice</span>
          </button>
        )}

        <div className="preview-sample-selector">
          <span className="sample-label">Sample:</span>
          <button
            type="button"
            className={`sample-pill ${phraseIndex === 0 ? 'selected' : ''}`}
            onClick={() => {
              setPhraseIndex(0);
              if (isPlaying) handleStopPreview();
            }}
          >
            Greeting
          </button>
          <button
            type="button"
            className={`sample-pill ${phraseIndex === 1 ? 'selected' : ''}`}
            onClick={() => {
              setPhraseIndex(1);
              if (isPlaying) handleStopPreview();
            }}
          >
            Question
          </button>
        </div>
      </div>

      <p className="preview-text-quote">
        "{PREVIEW_PHRASES[phraseIndex]}"
      </p>

      {errorMsg && (
        <div className="preview-error-note">
          <span>ℹ️ {errorMsg}</span>
        </div>
      )}
    </div>
  );
};

export default VoicePreview;
