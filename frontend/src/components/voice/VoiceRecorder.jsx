import React, { useState, useEffect, useRef } from 'react';
import InterviewService from '../../services/interviewService';
import VoiceStatus from './VoiceStatus';

const MAX_DURATION_SECONDS = 120;

const VoiceRecorder = ({ sessionId, onTranscriptReady, isSubmitting = false }) => {
  const [recordingState, setRecordingState] = useState('idle'); // idle, requesting_permission, recording, stopping, transcribing, error
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, []);

  const cleanupAudioResources = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
    accumulatedTranscriptRef.current = '';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingState('error');
      setErrorMessage('Audio recording is not supported in this browser environment.');
      return;
    }

    try {
      setRecordingState('requesting_permission');
      // Request audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all microphone tracks immediately
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processCandidateAudio(audioBlob, mimeType);
      };

      // Start native browser SpeechRecognition if supported
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            let finalStr = '';
            let interimStr = '';
            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) {
                finalStr += res[0].transcript + ' ';
              } else {
                interimStr += res[0].transcript;
              }
            }
            const fullText = (finalStr + interimStr).trim();
            if (fullText) {
              accumulatedTranscriptRef.current = fullText;
            }
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch (_) {}
      }

      mediaRecorder.start(250); // Slice data every 250ms
      setRecordingState('recording');

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= MAX_DURATION_SECONDS) {
            stopRecording();
            return MAX_DURATION_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setRecordingState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access is required for voice interviews. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No microphone was found on this device. Please connect a microphone and try again.');
      } else {
        setErrorMessage(`Microphone error: ${err.message || 'Unable to access microphone'}`);
      }
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setRecordingState('stopping');
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    cleanupAudioResources();
    setRecordingState('idle');
    setRecordingTime(0);
    setErrorMessage(null);
    audioChunksRef.current = [];
    accumulatedTranscriptRef.current = '';
  };

  const processCandidateAudio = async (audioBlob, mimeType) => {
    setRecordingState('transcribing');
    try {
      let finalTranscript = (accumulatedTranscriptRef.current || '').trim();

      // If WebSpeech was empty and audioBlob has data, check backend STT
      if (!finalTranscript && audioBlob && audioBlob.size > 0) {
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
          const filename = `session_${sessionId}_recording.${ext}`;
          const res = await InterviewService.transcribeVoice(sessionId, audioBlob, filename);
          if (res.success && res.data?.transcript && res.data.transcript.trim()) {
            finalTranscript = res.data.transcript.trim();
          }
        } catch (_) {}
      }

      if (!finalTranscript || finalTranscript.trim().length === 0) {
        setRecordingState('error');
        setErrorMessage('No speech was detected. Please try recording your answer again.');
        return;
      }

      setRecordingState('idle');
      onTranscriptReady(finalTranscript);
    } catch (err) {
      setRecordingState('error');
      setErrorMessage(
        err.message || "We couldn't transcribe your answer. Please try again."
      );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 font-bold">🎙</span>
          <h3 className="font-semibold text-slate-200 text-sm">Voice Answer Studio</h3>
        </div>
        <span className="text-xs text-slate-400">Max limit: 2 mins</span>
      </div>

      <VoiceStatus
        state={recordingState}
        recordingTime={recordingTime}
        maxDuration={MAX_DURATION_SECONDS}
        errorMessage={errorMessage}
      />

      {/* Center Action Area */}
      <div className="flex flex-col items-center justify-center py-6 gap-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
        {recordingState === 'recording' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-rose-500/20 animate-ping absolute inset-0"></div>
              <button
                type="button"
                onClick={stopRecording}
                className="relative w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-600/30 transition transform hover:scale-105"
              >
                <span className="w-6 h-6 bg-white rounded-sm mb-1"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Stop</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 animate-pulse">Speak clearly into your microphone...</p>
          </div>
        ) : recordingState === 'transcribing' || recordingState === 'stopping' ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-12 h-12 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-xs text-indigo-300 font-medium">Processing & transcribing speech...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={startRecording}
              disabled={isSubmitting || recordingState === 'requesting_permission'}
              className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex flex-col items-center justify-center shadow-xl shadow-indigo-600/25 transition transform hover:scale-105"
            >
              <span className="text-2xl mb-0.5">🎙</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Record</span>
            </button>
            <p className="text-xs text-slate-400">Click to start recording your response</p>
          </div>
        )}

        {recordingState === 'recording' && (
          <button
            type="button"
            onClick={cancelRecording}
            className="text-xs text-slate-400 hover:text-red-400 transition underline underline-offset-4"
          >
            Cancel Recording
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorder;
