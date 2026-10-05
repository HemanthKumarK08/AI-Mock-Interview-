import React from 'react';

const VoiceStatus = ({ state, recordingTime, maxDuration = 120, errorMessage }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (state) {
      case 'requesting_permission':
        return {
          text: 'Requesting Mic Access...',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400 animate-pulse'
        };
      case 'recording':
        return {
          text: `Recording (${formatTime(recordingTime)} / ${formatTime(maxDuration)})`,
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-500 animate-ping'
        };
      case 'stopping':
        return {
          text: 'Stopping Audio...',
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400 animate-pulse'
        };
      case 'uploading':
      case 'transcribing':
        return {
          text: 'Transcribing Voice with STT...',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          dot: 'bg-purple-400 animate-spin'
        };
      case 'transcribed':
        return {
          text: 'Transcript Ready for Review',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400'
        };
      case 'submitting':
        return {
          text: 'Submitting Answer...',
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          dot: 'bg-cyan-400 animate-pulse'
        };
      case 'error':
        return {
          text: 'Voice Error',
          color: 'bg-red-500/10 text-red-400 border-red-500/30',
          dot: 'bg-red-500'
        };
      case 'idle':
      default:
        return {
          text: 'Microphone Inactive',
          color: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500'
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${badge.color}`}>
          <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
          <span>{badge.text}</span>
        </div>

        {state === 'recording' && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            LIVE REC
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default VoiceStatus;
