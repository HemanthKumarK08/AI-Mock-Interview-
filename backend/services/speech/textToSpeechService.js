const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TextToSpeechService {
  static getProviderConfig() {
    return {
      provider: process.env.TTS_PROVIDER || 'web_speech',
      language: process.env.TTS_LANGUAGE || 'en-US',
      voice: process.env.TTS_VOICE || 'default',
      timeoutMs: parseInt(process.env.TTS_TIMEOUT_MS, 10) || 20000
    };
  }

  static async synthesizeQuestionAudio(questionText, options = {}) {
    if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
      throw { status: 400, message: 'Question text is required for text-to-speech synthesis' };
    }

    const config = this.getProviderConfig();
    const cleanText = questionText.trim();
    const language = options.language || config.language;
    const voice = options.voice || config.voice;

    try {
      // Backend TTS payload formatting for browser player / audio streaming
      return {
        speechSupported: true,
        text: cleanText,
        language,
        voice,
        provider: config.provider,
        audioFormat: 'audio/mp3',
        audioUrl: null, // Client Web Speech API or stream handles direct playback
        metadata: {
          charLength: cleanText.length,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (err) {
      console.warn(`[TTS Service] Speech synthesis error: ${err.message}`);
      return {
        speechSupported: false,
        text: cleanText,
        language,
        voice,
        provider: config.provider,
        audioUrl: null,
        error: 'TTS_SYNTHESIS_UNAVAILABLE',
        message: 'Audio playback unavailable. Please read the question text.'
      };
    }
  }

  static cleanupTemporaryAudio(filePath) {
    if (!filePath || typeof filePath !== 'string') return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn('[TTS Service] Cleanup temp audio error:', e.message);
    }
  }

  static cleanupOldAudioFiles(maxAgeMs = 10 * 60 * 1000) {
    const voiceDir = path.resolve(__dirname, '../../../uploads/voice');
    if (!fs.existsSync(voiceDir)) return;

    const now = Date.now();
    try {
      const files = fs.readdirSync(voiceDir);
      for (const file of files) {
        const filePath = path.join(voiceDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.warn('[TTS Service] Cleanup error:', e.message);
    }
  }
}

module.exports = TextToSpeechService;
