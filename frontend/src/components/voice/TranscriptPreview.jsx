import React, { useState, useEffect } from 'react';

const TranscriptPreview = ({ transcript, onSubmit, onRecordAgain, isSubmitting = false }) => {
  const [editedTranscript, setEditedTranscript] = useState(transcript || '');
  const [error, setError] = useState(null);

  useEffect(() => {
    setEditedTranscript(transcript || '');
    setError(null);
  }, [transcript]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const cleanText = editedTranscript.trim();
    if (!cleanText) {
      setError('Answer cannot be empty. Please speak or type your answer.');
      return;
    }
    setError(null);
    onSubmit(cleanText);
  };

  const wordCount = editedTranscript.trim() ? editedTranscript.trim().split(/\s+/).length : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">📝</span>
          <h3 className="font-semibold text-slate-200 text-sm">Transcript Preview & Review</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {wordCount} words | {editedTranscript.length} characters
        </span>
      </div>

      <div className="text-xs text-slate-400 bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex items-center gap-2">
        <span className="text-indigo-400 font-bold">Tip:</span>
        <span>Review and edit the speech recognition transcript below before submitting. Your edited text becomes the official answer.</span>
      </div>

      <div className="space-y-2">
        <textarea
          value={editedTranscript}
          onChange={(e) => {
            setEditedTranscript(e.target.value);
            if (error) setError(null);
          }}
          disabled={isSubmitting}
          rows={5}
          placeholder="Your transcribed answer will appear here. You can make manual corrections if needed..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y font-normal leading-relaxed disabled:opacity-50"
        />
        {error && (
          <p className="text-xs text-red-400 font-medium">{error}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onRecordAgain}
          disabled={isSubmitting}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-2"
        >
          <span>🎙</span> Record Again
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !editedTranscript.trim()}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Evaluating Answer...</span>
            </>
          ) : (
            <>
              <span>Submit Answer</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TranscriptPreview;
