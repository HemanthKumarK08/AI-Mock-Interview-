import React, { useState, useEffect, useRef } from 'react';

const VoicePlayer = ({ text, autoPlay = true, onEnded }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const utteranceRef = useRef(null);
  const lastSpokenTextRef = useRef('');

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    // Stop previous utterance if any
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setHasError(false);
    setAutoplayBlocked(false);

    if (text && text !== lastSpokenTextRef.current) {
      lastSpokenTextRef.current = text;
      if (autoPlay) {
        speakText(text, true);
      }
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [text, autoPlay]);

  const speakText = (textToSpeak, isAuto = false) => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
        setHasError(false);
        setAutoplayBlocked(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
        if (onEnded) onEnded();
      };

      utterance.onerror = (event) => {
        setIsPlaying(false);
        setIsPaused(false);
        if (event.error === 'not-allowed' && isAuto) {
          setAutoplayBlocked(true);
        } else {
          setHasError(true);
        }
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setHasError(true);
    }
  };

  const handlePlay = () => {
    if (isPaused && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speakText(text);
    }
  };

  const handlePause = () => {
    if ('speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/50 flex items-center gap-2">
        <span className="text-amber-400">ℹ</span>
        <span>Voice output is not supported in this browser. You can read the question text below.</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-xs text-amber-300 bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span>We couldn't play the voice version of the question. You can read the question and continue.</span>
        </div>
        <button
          onClick={() => speakText(text)}
          className="px-2.5 py-1 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded border border-amber-500/40 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
      <div className="flex items-center gap-2">
        {autoplayBlocked ? (
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition animate-pulse"
          >
            <span>▶</span> Play Question
          </button>
        ) : isPlaying ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
          >
            <span>⏸</span> Pause
          </button>
        ) : (
          <button
            onClick={handlePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <span>{isPaused ? '▶' : '🔊'}</span> {isPaused ? 'Resume' : 'Listen'}
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            ⏹ Stop
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        {isPlaying && (
          <span className="flex items-center gap-1 text-indigo-400 font-medium">
            <span className="w-1.5 h-3 bg-indigo-400 animate-pulse rounded-full"></span>
            <span className="w-1.5 h-4 bg-indigo-400 animate-pulse delay-75 rounded-full"></span>
            <span className="w-1.5 h-2 bg-indigo-400 animate-pulse delay-150 rounded-full"></span>
            AI Interviewer Speaking...
          </span>
        )}
        {!isPlaying && !isPaused && !autoplayBlocked && (
          <span>Question audio ready</span>
        )}
      </div>
    </div>
  );
};

export default VoicePlayer;
