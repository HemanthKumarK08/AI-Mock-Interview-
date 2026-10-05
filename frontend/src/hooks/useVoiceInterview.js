import { useState, useEffect, useRef, useCallback } from 'react';
import InterviewService from '../services/interviewService';
import VoiceSettingsService from '../services/voiceSettingsService';
import ttsServiceInstance from '../services/tts/ttsService';

export const VOICE_STATES = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  AI_THINKING: 'ai_thinking',
  AI_SPEAKING: 'ai_speaking',
  WAITING_FOR_CANDIDATE: 'waiting_for_candidate',
  USER_SPEAKING: 'user_speaking',
  PROCESSING_AUDIO: 'processing_audio',
  TRANSCRIBING: 'transcribing',
  EVALUATING: 'evaluating',
  PREPARING_NEXT_QUESTION: 'preparing_next_question',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export function useVoiceInterview({
  sessionId,
  sessionData,
  initialVoiceSettings,
  onNavigate,
  onSessionUpdate
}) {
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  const [conversation, setConversation] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [currentTurn, setCurrentTurn] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(() => initialVoiceSettings || VoiceSettingsService.loadSettings());

  // Audio & Hardware Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const vadAnimationIdRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // State Tracking & Isolation Refs
  const voiceTurnIdRef = useRef(0);
  const accumulatedTranscriptRef = useRef('');
  const voiceStateRef = useRef(VOICE_STATES.IDLE);
  const isPausedRef = useRef(false);
  const isProcessingLockRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const silenceStartTimeRef = useRef(0);
  const recordingTimerRef = useRef(null);
  const lastSpokenTextRef = useRef('');
  const isClosingSpeechRef = useRef(false);
  const voiceSettingsRef = useRef(voiceSettings);

  // Keep refs synchronized with state
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
    ttsServiceInstance.setVoiceSettings(voiceSettings);
  }, [voiceSettings]);

  const updateVoiceState = useCallback((newState) => {
    console.log(`[VOICE TURN ${voiceTurnIdRef.current}] State: ${voiceStateRef.current} -> ${newState}`);
    voiceStateRef.current = newState;
    setVoiceState(newState);
  }, []);

  // Update voice settings dynamically
  const updateSettings = useCallback((newSettings) => {
    const validated = VoiceSettingsService.validateSettings(newSettings);
    setVoiceSettings(validated);
    VoiceSettingsService.saveSettings(validated);
    ttsServiceInstance.setVoiceSettings(validated);
  }, []);

  // Cleanup audio tracks and context
  const cleanupAudio = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }
    ttsServiceInstance.stop();
    setAudioLevel(0);
  }, []);

  // Stop microphone recording & disable tracks while AI is speaking
  const muteAndDisableMicrophone = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch (_) {}
      speechRecognitionRef.current = null;
    }
    if (vadAnimationIdRef.current) {
      cancelAnimationFrame(vadAnimationIdRef.current);
      vadAnimationIdRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }
    setAudioLevel(0);
  }, []);

  // TTS Output Synthesizer with Fluent Voice Pipeline
  const speakAI = useCallback((text, onSpeechEndedCallback) => {
    // Crucial safeguard: Mute & disable microphone so AI never hears itself
    muteAndDisableMicrophone();
    updateVoiceState(VOICE_STATES.AI_SPEAKING);

    const currentTurnId = voiceTurnIdRef.current;
    console.log(`[VOICE TURN ${currentTurnId}] AI TTS START: "${text.substring(0, 50)}..."`);

    let hasEnded = false;
    const handleEnd = () => {
      if (hasEnded) return;
      hasEnded = true;
      console.log(`[VOICE TURN ${currentTurnId}] AI TTS END`);
      if (onSpeechEndedCallback) {
        onSpeechEndedCallback();
      }
    };

    lastSpokenTextRef.current = text;

    // Use unified TTS service with configured voice settings
    ttsServiceInstance.speak(
      text,
      voiceSettingsRef.current,
      handleEnd,
      (err) => {
        console.warn(`[VOICE TURN ${currentTurnId}] TTS synthesis error:`, err);
        handleEnd();
      }
    );
  }, [muteAndDisableMicrophone, updateVoiceState]);

  // Forward declaration of functions needed by callbacks
  const submitCandidateAnswer = useCallback(async (transcriptText, turnId) => {
    if (turnId && turnId !== voiceTurnIdRef.current) {
      console.warn(`[VOICE TURN ${turnId}] Ignoring stale answer submission (current turn: ${voiceTurnIdRef.current})`);
      return;
    }

    if (isProcessingLockRef.current) {
      console.warn(`[VOICE TURN ${turnId}] Answer processing already in progress. Ignoring duplicate submission.`);
      return;
    }

    isProcessingLockRef.current = true;
    updateVoiceState(VOICE_STATES.EVALUATING);
    setErrorMessage(null);

    try {
      console.log(`[VOICE TURN ${turnId}] SUBMITTING ANSWER: "${transcriptText}"`);
      const res = await InterviewService.submitAnswer(sessionId, transcriptText);

      if (res.success) {
        console.log(`[VOICE TURN ${turnId}] Answer evaluation completed successfully`);

        // Store evaluation if returned
        if (res.data?.evaluation) {
          const ev = res.data.evaluation;
          setEvaluations((prev) => ({
            ...prev,
            [ev.turnNumber || ev.conversationId || conversation.length + 1]: ev
          }));
        }

        // Fetch refreshed conversation history
        const convRes = await InterviewService.getConversation(sessionId);
        if (convRes.success && Array.isArray(convRes.data?.conversation)) {
          setConversation(convRes.data.conversation);
        }

        // Re-fetch evaluations
        const evalRes = await InterviewService.getEvaluations(sessionId);
        if (evalRes.success && Array.isArray(evalRes.data?.evaluations)) {
          const evalMap = {};
          evalRes.data.evaluations.forEach((ev) => {
            evalMap[ev.turnNumber || ev.conversationId] = ev;
          });
          setEvaluations(evalMap);
        }

        // Check if interview reached completion
        if (res.data?.completed || res.data?.session?.status === 'completed') {
          console.log(`[VOICE TURN ${turnId}] All interview questions completed!`);
          isClosingSpeechRef.current = true;
          updateVoiceState(VOICE_STATES.COMPLETED);
          if (onSessionUpdate) {
            onSessionUpdate({ ...sessionData, status: 'completed' });
          }

          // Automatically speak closing summary
          const closingText =
            'Thank you for completing the interview. All your responses have been evaluated and your performance report is now ready.';
          speakAI(closingText, () => {
            console.log(`[VOICE TURN ${turnId}] Final closing speech finished. Ready for report.`);
          });
        } else {
          // Prepare and speak next question / adaptive follow-up
          updateVoiceState(VOICE_STATES.PREPARING_NEXT_QUESTION);
          const nextQuestionObj = res.data?.currentTurn || res.data?.nextQuestion;
          setCurrentTurn(nextQuestionObj);

          const nextQuestionText = nextQuestionObj?.question || 'Please proceed to the next question.';
          console.log(`[VOICE TURN ${turnId}] AI speaking next question: "${nextQuestionText.substring(0, 50)}..."`);

          // Automatic next AI speech -> auto-listen on end
          speakAI(nextQuestionText, () => {
            startCandidateListening();
          });
        }
      } else {
        setErrorMessage(res.message || 'Unable to evaluate answer. Please try speaking again.');
        startCandidateListening();
      }
    } catch (err) {
      console.error(`[VOICE TURN ${turnId}] Answer submission error:`, err);
      setErrorMessage(err.message || 'Network error evaluating answer. Please try again.');
      startCandidateListening();
    } finally {
      isProcessingLockRef.current = false;
    }
  }, [
    conversation.length,
    onSessionUpdate,
    sessionId,
    sessionData,
    speakAI,
    updateVoiceState
  ]);

  // Process candidate speech on silence completion
  const processCandidateSpeech = useCallback(async (turnId, audioBlob, mimeType) => {
    if (turnId !== voiceTurnIdRef.current) {
      console.warn(`[VOICE TURN ${turnId}] Stale speech processing aborted (current turn: ${voiceTurnIdRef.current})`);
      return;
    }

    updateVoiceState(VOICE_STATES.TRANSCRIBING);

    let finalTranscript = (accumulatedTranscriptRef.current || '').trim();
    console.log(`[VOICE TURN ${turnId}] WebSpeech real-time transcript: "${finalTranscript}"`);

    // If WebSpeech did not capture transcript and audio blob is available, attempt backend STT
    if (!finalTranscript && audioBlob && audioBlob.size > 0) {
      try {
        console.log(`[VOICE TURN ${turnId}] Requesting backend STT for ${audioBlob.size} bytes audio...`);
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
        const filename = `continuous_session_${sessionId}_${Date.now()}.${ext}`;
        const res = await InterviewService.transcribeVoice(sessionId, audioBlob, filename);
        if (res.success && res.data?.transcript && res.data.transcript.trim()) {
          finalTranscript = res.data.transcript.trim();
          console.log(`[VOICE TURN ${turnId}] Backend STT transcript: "${finalTranscript}"`);
        }
      } catch (err) {
        console.warn(`[VOICE TURN ${turnId}] Backend STT attempt failed:`, err.message);
      }
    }

    // STRICT STT INTEGRITY GATE:
    // If no candidate speech was captured (empty/null/whitespace), DO NOT submit fabricated text!
    if (!finalTranscript || finalTranscript.trim().length === 0) {
      console.warn(`[VOICE TURN ${turnId}] STT FAILURE: No speech detected. Not submitting any fabricated answer.`);
      setErrorMessage("I couldn't clearly hear your answer. Please try again.");
      setTimeout(() => {
        if (
          voiceStateRef.current !== VOICE_STATES.AI_SPEAKING &&
          voiceStateRef.current !== VOICE_STATES.COMPLETED &&
          !isPausedRef.current
        ) {
          startCandidateListening();
        }
      }, 800);
      return;
    }

    // Legitimate candidate answer (including "I don't know", "not sure", etc.)
    console.log(`[VOICE TURN ${turnId}] REAL TRANSCRIPT ACCEPTED: "${finalTranscript}"`);
    setLiveTranscript(finalTranscript);
    await submitCandidateAnswer(finalTranscript, turnId);
  }, [sessionId, submitCandidateAnswer, updateVoiceState]);

  // VAD Audio Level Monitor Loop
  const startVADLoop = useCallback((turnId) => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const speechThreshold = voiceSettingsRef.current.vadSensitivity === 'low'
      ? 0.035
      : voiceSettingsRef.current.vadSensitivity === 'high'
        ? 0.012
        : 0.02;

    const silenceDurationThreshold = voiceSettingsRef.current.silenceDuration || 1600;
    const minimumSpeechDuration = 400;

    const checkAudioLevel = () => {
      if (isPausedRef.current) {
        vadAnimationIdRef.current = requestAnimationFrame(checkAudioLevel);
        return;
      }

      // If turn changed or state is not listening/speaking, stop loop
      if (
        turnId !== voiceTurnIdRef.current ||
        voiceStateRef.current === VOICE_STATES.AI_SPEAKING ||
        voiceStateRef.current === VOICE_STATES.COMPLETED ||
        voiceStateRef.current === VOICE_STATES.TRANSCRIBING ||
        voiceStateRef.current === VOICE_STATES.EVALUATING
      ) {
        return;
      }

      analyser.getByteTimeDomainData(dataArray);

      // Compute RMS volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / bufferLength);
      setAudioLevel(Math.min(1, rms * 5));

      const now = Date.now();

      // State: WAITING_FOR_CANDIDATE
      if (voiceStateRef.current === VOICE_STATES.WAITING_FOR_CANDIDATE) {
        if (rms >= speechThreshold) {
          console.log(`[VOICE TURN ${turnId}] VAD SPEECH START (RMS: ${rms.toFixed(3)})`);
          updateVoiceState(VOICE_STATES.USER_SPEAKING);
          speechStartTimeRef.current = now;
          silenceStartTimeRef.current = 0;

          // Start MediaRecorder if not already recording
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
            audioChunksRef.current = [];
            try {
              mediaRecorderRef.current.start(250);
            } catch (err) {
              console.error(`[VOICE TURN ${turnId}] Failed to start MediaRecorder:`, err);
            }
          }
        }
      }

      // State: USER_SPEAKING
      else if (voiceStateRef.current === VOICE_STATES.USER_SPEAKING) {
        const speechDuration = now - speechStartTimeRef.current;

        if (rms >= speechThreshold) {
          // Candidate is actively speaking, reset silence timer
          silenceStartTimeRef.current = 0;
        } else {
          // Audio dropped below threshold -> candidate might have paused or finished
          if (silenceStartTimeRef.current === 0) {
            silenceStartTimeRef.current = now;
          } else {
            const silenceDuration = now - silenceStartTimeRef.current;

            // Sustained silence reached & candidate spoke for minimum required duration
            if (
              silenceDuration >= silenceDurationThreshold &&
              speechDuration >= minimumSpeechDuration
            ) {
              console.log(`[VOICE TURN ${turnId}] VAD SILENCE DETECTED (sustained silence: ${silenceDuration}ms)`);
              updateVoiceState(VOICE_STATES.PROCESSING_AUDIO);

              // Stop browser speech recognition
              if (speechRecognitionRef.current) {
                try {
                  speechRecognitionRef.current.stop();
                } catch (_) {}
              }

              // Stop MediaRecorder
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  mediaRecorderRef.current.stop();
                } catch (err) {
                  console.error(`[VOICE TURN ${turnId}] Failed to stop MediaRecorder:`, err);
                }
              }
              return; // Exit VAD loop while processing candidate audio
            }
          }
        }
      }

      vadAnimationIdRef.current = requestAnimationFrame(checkAudioLevel);
    };

    vadAnimationIdRef.current = requestAnimationFrame(checkAudioLevel);
  }, [updateVoiceState]);

  // Start Candidate Listening
  const startCandidateListening = useCallback(() => {
    if (isPausedRef.current || isClosingSpeechRef.current) return;

    voiceTurnIdRef.current += 1;
    const turnId = voiceTurnIdRef.current;

    console.log(`[VOICE TURN ${turnId}] MIC START — WAITING_FOR_CANDIDATE`);
    updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE);
    setLiveTranscript('');
    accumulatedTranscriptRef.current = '';
    setRecordingDuration(0);
    audioChunksRef.current = [];
    speechStartTimeRef.current = 0;
    silenceStartTimeRef.current = 0;

    // Enable microphone stream tracks
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }

    // Resume AudioContext if suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    // Initialize native browser SpeechRecognition for live real-time candidate speech capture
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      try {
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.abort();
          } catch (_) {}
        }

        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = voiceSettingsRef.current?.language || 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          console.log(`[VOICE TURN ${turnId}] Browser SpeechRecognition ACTIVE`);
        };

        recognition.onresult = (event) => {
          if (turnId !== voiceTurnIdRef.current) return;

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
            setLiveTranscript(fullText);

            if (voiceStateRef.current === VOICE_STATES.WAITING_FOR_CANDIDATE) {
              console.log(`[VOICE TURN ${turnId}] Speech detected from SpeechRecognition: "${fullText}"`);
              updateVoiceState(VOICE_STATES.USER_SPEAKING);
              speechStartTimeRef.current = Date.now();
              silenceStartTimeRef.current = 0;

              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                audioChunksRef.current = [];
                try {
                  mediaRecorderRef.current.start(250);
                } catch (_) {}
              }
            }
          }
        };

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn(`[VOICE TURN ${turnId}] SpeechRecognition error:`, e.error);
          }
        };

        recognition.onend = () => {
          console.log(`[VOICE TURN ${turnId}] Browser SpeechRecognition ended`);
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn(`[VOICE TURN ${turnId}] SpeechRecognition init error:`, err);
      }
    }

    startVADLoop(turnId);
  }, [startVADLoop, updateVoiceState]);

  // Initialize Microphone & Web Audio Environment
  const initializeAudioContext = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    // Request audio stream with browser AEC & noise suppression
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    microphoneStreamRef.current = stream;

    // Initialize Web Audio Context & Analyser
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Supported MIME type detection
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    let selectedMimeType = 'audio/webm';
    for (const type of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const turnId = voiceTurnIdRef.current;
      const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
      console.log(`[VOICE TURN ${turnId}] MEDIA RECORDER STOP — Blob size: ${audioBlob.size} bytes`);
      await processCandidateSpeech(turnId, audioBlob, selectedMimeType);
    };

    return stream;
  }, [processCandidateSpeech]);

  // Start / Create Continuous Interview Session
  const startContinuousInterview = useCallback(async () => {
    try {
      setErrorMessage(null);
      updateVoiceState(VOICE_STATES.INITIALIZING);
      setHasStarted(true);

      // Step 1: Initialize audio hardware upon candidate user gesture
      await initializeAudioContext();
      console.log('[VOICE] AudioContext & Microphone initialized successfully');

      // Step 2: Start / Recover interview session
      const startRes = await InterviewService.startInterview(sessionId);
      if (startRes.success) {
        if (startRes.data?.session && onSessionUpdate) {
          onSessionUpdate(startRes.data.session);
        }

        if (startRes.data?.completed) {
          updateVoiceState(VOICE_STATES.COMPLETED);
          return;
        }

        const initialTurn = startRes.data?.currentTurn;
        setCurrentTurn(initialTurn);

        // Fetch conversation & evaluations
        const convRes = await InterviewService.getConversation(sessionId);
        if (convRes.success && Array.isArray(convRes.data?.conversation)) {
          setConversation(convRes.data.conversation);
        }

        const evalRes = await InterviewService.getEvaluations(sessionId);
        if (evalRes.success && Array.isArray(evalRes.data?.evaluations)) {
          const evalMap = {};
          evalRes.data.evaluations.forEach((ev) => {
            evalMap[ev.turnNumber || ev.conversationId] = ev;
          });
          setEvaluations(evalMap);
        }

        // Step 3: Automatically speak opening message & first question
        const firstQuestion = initialTurn?.question || 'Welcome to your interview. Let us begin with the first question.';
        console.log('[VOICE] Starting interview with AI question: "' + firstQuestion.substring(0, 50) + '..."');

        speakAI(firstQuestion, () => {
          // Step 4: Automatically activate microphone when AI finishes speaking
          startCandidateListening();
        });
      } else {
        updateVoiceState(VOICE_STATES.ERROR);
        setErrorMessage(startRes.message || 'Failed to start interview session.');
      }
    } catch (err) {
      console.error('[VOICE] Start interview error:', err);
      updateVoiceState(VOICE_STATES.ERROR);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access is required for voice interviews. Please allow microphone permissions and click Retry.');
      } else {
        setErrorMessage(err.message || 'Unable to initialize voice system. Please check your browser audio settings.');
      }
    }
  }, [
    initializeAudioContext,
    onSessionUpdate,
    sessionId,
    speakAI,
    startCandidateListening,
    updateVoiceState
  ]);

  // Secondary Control: Pause Interview
  const pauseInterview = useCallback(() => {
    setIsPaused(true);
    muteAndDisableMicrophone();
    ttsServiceInstance.pause();
  }, [muteAndDisableMicrophone]);

  // Secondary Control: Resume Interview
  const resumeInterview = useCallback(() => {
    setIsPaused(false);
    ttsServiceInstance.resume();
    if (voiceStateRef.current === VOICE_STATES.WAITING_FOR_CANDIDATE || voiceStateRef.current === VOICE_STATES.USER_SPEAKING) {
      startCandidateListening();
    }
  }, [startCandidateListening]);

  // Secondary Control: Replay Current Question
  const replayCurrentQuestion = useCallback(() => {
    const questionText = currentTurn?.question || (conversation.length > 0 ? conversation[conversation.length - 1]?.question : '');
    if (!questionText) return;

    ttsServiceInstance.stop();
    speakAI(questionText, () => {
      startCandidateListening();
    });
  }, [conversation, currentTurn, speakAI, startCandidateListening]);

  // Secondary Control: Cancel / End Interview Early
  const endInterview = useCallback(async () => {
    cleanupAudio();
    updateVoiceState(VOICE_STATES.COMPLETED);
    if (onNavigate) {
      onNavigate('report', sessionId);
    }
  }, [cleanupAudio, onNavigate, sessionId, updateVoiceState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    voiceState,
    conversation,
    evaluations,
    currentTurn,
    audioLevel,
    liveTranscript,
    errorMessage,
    isPaused,
    hasStarted,
    recordingDuration,
    voiceSettings,
    updateSettings,
    startContinuousInterview,
    pauseInterview,
    resumeInterview,
    replayCurrentQuestion,
    endInterview,
    speakAI,
    retryListening: startCandidateListening
  };
}

export default useVoiceInterview;
