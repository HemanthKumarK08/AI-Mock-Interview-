/**
 * Voice Settings Service
 * Manages voice configuration model, presets, dynamic voice discovery, and persistence.
 */

const STORAGE_KEY = 'mockinterviewai_voice_settings';

export const DEFAULT_VOICE_SETTINGS = {
  provider: 'auto',
  voiceURI: '',
  voiceName: 'Default AI Voice',
  language: 'en-US',
  gender: 'neutral',
  speakingRate: 0.95,     // Natural interview rate (0.75 to 1.5)
  pitch: 1.0,            // Natural pitch (0.8 to 1.3)
  volume: 1.0,           // 0.0 to 1.0
  preset: 'professional', // 'professional', 'friendly', 'interviewer', 'patient', 'custom'
  responsePause: 'natural', // 'short' (120ms), 'natural' (250ms), 'thoughtful' (450ms)
  sentencePause: 100,
  silenceDuration: 1600,  // Candidate VAD silence threshold (ms)
  vadSensitivity: 'medium' // 'low' (0.035), 'medium' (0.02), 'high' (0.012)
};

export const VOICE_PRESETS = {
  professional: {
    name: 'Professional',
    desc: 'Balanced, authoritative, and clear cadence for standard technical interviews',
    speakingRate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    responsePause: 'natural'
  },
  friendly: {
    name: 'Friendly',
    desc: 'Warm, slightly energetic tone with a dynamic conversational pace',
    speakingRate: 1.0,
    pitch: 1.05,
    volume: 1.0,
    responsePause: 'short'
  },
  interviewer: {
    name: 'Interviewer',
    desc: 'Deliberate, articulate pacing giving you ample time to absorb complex questions',
    speakingRate: 0.92,
    pitch: 0.98,
    volume: 1.0,
    responsePause: 'natural'
  },
  patient: {
    name: 'Patient',
    desc: 'Relaxed, calm pace designed to reduce interview anxiety and clarify questions',
    speakingRate: 0.88,
    pitch: 1.0,
    volume: 1.0,
    responsePause: 'thoughtful'
  },
  custom: {
    name: 'Custom',
    desc: 'Fine-tune speed, pitch, volume, and response timing manually',
    speakingRate: 0.95,
    pitch: 1.0,
    volume: 1.0,
    responsePause: 'natural'
  }
};

export const VAD_SENSITIVITIES = {
  low: { label: 'Low (Noisy Environment)', threshold: 0.035 },
  medium: { label: 'Medium (Standard)', threshold: 0.02 },
  high: { label: 'High (Quiet Room)', threshold: 0.012 }
};

export const RESPONSE_PAUSES = {
  short: { label: 'Quick (120ms)', ms: 120 },
  natural: { label: 'Natural (250ms)', ms: 250 },
  thoughtful: { label: 'Thoughtful (450ms)', ms: 450 }
};

export const PREVIEW_PHRASES = [
  "Hello. Welcome to your MockInterviewAI session. I'll be conducting your interview today. Let's begin.",
  "That's a good explanation. Could you also walk me through how you optimize database performance in production?",
  "Thank you for sharing that project experience. Let's move on to the next technical topic."
];

class VoiceSettingsService {
  /**
   * Load persisted settings with fallback to defaults
   */
  static loadSettings() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { ...DEFAULT_VOICE_SETTINGS };
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_VOICE_SETTINGS };
      }
      const parsed = JSON.parse(raw);
      return this.validateSettings({ ...DEFAULT_VOICE_SETTINGS, ...parsed });
    } catch (e) {
      console.warn('[VoiceSettings] Failed to load persisted settings:', e.message);
      return { ...DEFAULT_VOICE_SETTINGS };
    }
  }

  /**
   * Persist voice settings to localStorage safely
   */
  static saveSettings(settings) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const validated = this.validateSettings(settings);
      // Clean non-serializable fields if any
      const toStore = {
        provider: validated.provider,
        voiceURI: validated.voiceURI,
        voiceName: validated.voiceName,
        language: validated.language,
        gender: validated.gender,
        speakingRate: validated.speakingRate,
        pitch: validated.pitch,
        volume: validated.volume,
        preset: validated.preset,
        responsePause: validated.responsePause,
        sentencePause: validated.sentencePause,
        silenceDuration: validated.silenceDuration,
        vadSensitivity: validated.vadSensitivity
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      return validated;
    } catch (e) {
      console.warn('[VoiceSettings] Failed to save settings:', e.message);
      return settings;
    }
  }

  /**
   * Validate and bound settings
   */
  static validateSettings(settings = {}) {
    const speakingRate = Math.min(2.0, Math.max(0.5, parseFloat(settings.speakingRate) || 0.95));
    const pitch = Math.min(1.5, Math.max(0.5, parseFloat(settings.pitch) || 1.0));
    const volume = Math.min(1.0, Math.max(0.0, parseFloat(settings.volume) !== undefined ? parseFloat(settings.volume) : 1.0));
    const silenceDuration = Math.min(4000, Math.max(1000, parseInt(settings.silenceDuration, 10) || 1600));

    const preset = VOICE_PRESETS[settings.preset] ? settings.preset : 'custom';
    const vadSensitivity = VAD_SENSITIVITIES[settings.vadSensitivity] ? settings.vadSensitivity : 'medium';
    const responsePause = RESPONSE_PAUSES[settings.responsePause] ? settings.responsePause : 'natural';

    return {
      provider: settings.provider || 'auto',
      voiceURI: settings.voiceURI || '',
      voiceName: settings.voiceName || 'Default AI Voice',
      language: settings.language || 'en-US',
      gender: settings.gender || 'neutral',
      speakingRate,
      pitch,
      volume,
      preset,
      responsePause,
      sentencePause: parseInt(settings.sentencePause, 10) || 100,
      silenceDuration,
      vadSensitivity
    };
  }

  /**
   * Apply a preset configuration
   */
  static applyPreset(presetKey, currentSettings = {}) {
    const preset = VOICE_PRESETS[presetKey];
    if (!preset || presetKey === 'custom') {
      return { ...currentSettings, preset: 'custom' };
    }
    return this.validateSettings({
      ...currentSettings,
      preset: presetKey,
      speakingRate: preset.speakingRate,
      pitch: preset.pitch,
      volume: preset.volume,
      responsePause: preset.responsePause
    });
  }

  /**
   * Asynchronously discover and format available speech synthesis voices
   */
  static async getAvailableVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }

    return new Promise((resolve) => {
      let voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        resolve(this._formatVoices(voices));
        return;
      }

      // Handle async onvoiceschanged in Chrome/Safari
      let resolved = false;
      const onVoicesChanged = () => {
        if (resolved) return;
        resolved = true;
        voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = null;
        resolve(this._formatVoices(voices));
      };

      window.speechSynthesis.onvoiceschanged = onVoicesChanged;

      // Fallback timeout if onvoiceschanged doesn't fire
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          voices = window.speechSynthesis.getVoices();
          resolve(this._formatVoices(voices));
        }
      }, 500);
    });
  }

  /**
   * Format and organize system voices
   */
  static _formatVoices(voices) {
    if (!Array.isArray(voices)) return [];

    return voices.map((v) => {
      // Determine human-readable label
      const lang = v.lang || 'en-US';
      const isEnglish = lang.toLowerCase().startsWith('en');
      const isIndia = lang.toLowerCase().includes('in');
      const isUS = lang.toLowerCase().includes('us');
      const isUK = lang.toLowerCase().includes('gb') || lang.toLowerCase().includes('uk');

      let regionLabel = lang;
      if (isIndia) regionLabel = 'English (India)';
      else if (isUS) regionLabel = 'English (US)';
      else if (isUK) regionLabel = 'English (UK)';
      else if (isEnglish) regionLabel = `English (${lang})`;

      // Clean voice name
      const cleanName = v.name.replace(/(Google|Microsoft|Apple|Natural|Online|\(.*?\))/gi, '').trim() || v.name;

      return {
        voiceURI: v.voiceURI,
        name: v.name,
        displayName: `${cleanName} — ${regionLabel}`,
        lang: v.lang,
        regionLabel,
        default: v.default,
        localService: v.localService,
        isEnglish
      };
    }).sort((a, b) => {
      // Prioritize English voices and standard regional voices
      if (a.isEnglish && !b.isEnglish) return -1;
      if (!a.isEnglish && b.isEnglish) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }
}

export default VoiceSettingsService;
