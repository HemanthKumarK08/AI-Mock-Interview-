/**
 * Browser Speech Synthesis Provider
 * High-reliability wrapper around the Web Speech API (SpeechSynthesis).
 */

class BrowserSpeechProvider {
  constructor() {
    this.name = 'browser_speech';
  }

  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /**
   * Speak a text string using configured voice settings
   */
  speak(text, options = {}, onEnd, onError) {
    if (!this.isSupported()) {
      const err = new Error('Speech synthesis is not supported in this browser.');
      if (onError) onError(err);
      return;
    }

    try {
      // Cancel previous utterance
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // Apply Voice Settings
      const rate = options.speakingRate !== undefined ? options.speakingRate : 0.95;
      const pitch = options.pitch !== undefined ? options.pitch : 1.0;
      const volume = options.volume !== undefined ? options.volume : 1.0;
      const lang = options.language || 'en-US';

      utterance.rate = Math.min(2.0, Math.max(0.5, rate));
      utterance.pitch = Math.min(1.5, Math.max(0.5, pitch));
      utterance.volume = Math.min(1.0, Math.max(0.0, volume));
      utterance.lang = lang;

      // Match configured Voice
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        let matchedVoice = null;

        // 1. Try matching by exact voiceURI
        if (options.voiceURI) {
          matchedVoice = voices.find((v) => v.voiceURI === options.voiceURI);
        }

        // 2. Try matching by voiceName
        if (!matchedVoice && options.voiceName && options.voiceName !== 'Default AI Voice') {
          matchedVoice = voices.find((v) => v.name === options.voiceName);
        }

        // 3. Try matching by language code (e.g. en-IN, en-US, en-GB)
        if (!matchedVoice && options.language) {
          matchedVoice = voices.find((v) => v.lang.toLowerCase() === options.language.toLowerCase());
        }

        // 4. Try matching any English voice
        if (!matchedVoice) {
          matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
        }

        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      let isCompleted = false;

      utterance.onstart = () => {
        if (options.onStart) options.onStart();
      };

      utterance.onend = () => {
        if (isCompleted) return;
        isCompleted = true;
        if (onEnd) onEnd();
      };

      utterance.onerror = (event) => {
        if (isCompleted) return;
        isCompleted = true;
        // Ignore canceled / interrupted errors when user pauses or navigates
        if (event.error === 'canceled' || event.error === 'interrupted') {
          if (onEnd) onEnd();
          return;
        }
        console.warn('[BrowserSpeech] Utterance error event:', event.error);
        if (onError) onError(event);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('[BrowserSpeech] Speak error:', err);
      if (onError) onError(err);
    }
  }

  stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  pause() {
    if (this.isSupported()) {
      window.speechSynthesis.pause();
    }
  }

  resume() {
    if (this.isSupported() && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }
}

export default BrowserSpeechProvider;
