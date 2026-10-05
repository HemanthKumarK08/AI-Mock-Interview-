/**
 * TTS Service Facade
 * Orchestrates text preparation, voice selection, sequential queueing, and provider execution.
 */

import BrowserSpeechProvider from './browserSpeechProvider';
import SpeechQueue from './speechQueue';
import SpeechPreparation from './speechPreparation';
import VoiceSettingsService from '../voiceSettingsService';

class TTSService {
  constructor() {
    this.provider = new BrowserSpeechProvider();
    this.queue = new SpeechQueue();
    this.currentVoiceSettings = VoiceSettingsService.loadSettings();
  }

  /**
   * Set or update active voice settings
   */
  setVoiceSettings(settings) {
    this.currentVoiceSettings = VoiceSettingsService.validateSettings(settings);
  }

  getVoiceSettings() {
    return { ...this.currentVoiceSettings };
  }

  isSupported() {
    return this.provider.isSupported();
  }

  /**
   * Speak an AI question or message aloud
   * @param {string} rawText - Raw response or question text
   * @param {Object} overrideOptions - Optional settings overrides
   * @param {Function} onEnd - Callback when speech completely finishes
   * @param {Function} onError - Callback on failure
   */
  speak(rawText, overrideOptions = {}, onEnd, onError) {
    // 1. Clean and prepare text for natural pronunciation
    const cleanText = SpeechPreparation.prepareTextForSpeech(rawText);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    // 2. Merge options with active voice configuration
    const options = {
      ...this.currentVoiceSettings,
      ...overrideOptions
    };

    // 3. Clear existing tasks in queue to ensure single authoritative stream
    this.queue.clear();

    // 4. Enqueue playback task
    this.queue.enqueue({
      text: cleanText,
      options,
      speakFn: (text, opt, resolve, reject) => {
        this.provider.speak(text, opt, resolve, reject);
      },
      onEnd,
      onError
    });
  }

  /**
   * Speak a short voice preview
   */
  preview(sampleText, settings, onEnd, onError) {
    this.stop();
    const cleanText = SpeechPreparation.prepareTextForSpeech(sampleText);
    const options = VoiceSettingsService.validateSettings(settings);

    this.provider.speak(cleanText, options, onEnd, onError);
  }

  stop() {
    this.queue.stop();
    this.provider.stop();
  }

  pause() {
    this.queue.pause();
    this.provider.pause();
  }

  resume() {
    this.queue.resume();
    this.provider.resume();
  }
}

// Singleton instance for application-wide voice consistency
const ttsServiceInstance = new TTSService();

export { TTSService };
export default ttsServiceInstance;
