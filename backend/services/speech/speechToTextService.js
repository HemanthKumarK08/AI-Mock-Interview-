const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4'
];

const MAX_AUDIO_SIZE_BYTES = (parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB, 10) || 15) * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = parseInt(process.env.SPEECH_TIMEOUT_MS, 10) || 30000;
const MAX_RETRIES = 2;

class SpeechToTextService {
  static getConfig() {
    const config = this.getProviderConfig();
    return {
      provider: config.provider,
      language: config.language,
      timeoutMs: config.timeoutMs,
      maxSizeBytes: config.maxSizeBytes,
      maxFileSizeBytes: config.maxSizeBytes
    };
  }

  static getProviderConfig() {
    return {
      provider: process.env.SPEECH_PROVIDER || 'assemblyai',
      apiKey: process.env.ASSEMBLYAI_API_KEY || '',
      language: process.env.SPEECH_LANGUAGE || 'en',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxSizeBytes: MAX_AUDIO_SIZE_BYTES
    };
  }

  static isConfigured() {
    const { apiKey } = this.getProviderConfig();
    return Boolean(apiKey && apiKey.trim().length > 0);
  }

  static validateAudioUpload(fileOrBuffer, mimeType, size) {
    if (!fileOrBuffer) {
      throw { status: 400, message: 'No audio file or data provided' };
    }

    const byteLength = size !== undefined ? size : (Buffer.isBuffer(fileOrBuffer) ? fileOrBuffer.length : (fileOrBuffer.size || 0));
    if (byteLength === 0) {
      throw { status: 400, message: 'Audio file is empty (0 bytes)' };
    }

    if (byteLength > MAX_AUDIO_SIZE_BYTES) {
      throw {
        status: 400,
        message: `Audio file size (${(byteLength / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${MAX_AUDIO_SIZE_BYTES / (1024 * 1024)} MB`
      };
    }

    if (mimeType) {
      const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
      const isAllowed = ALLOWED_MIME_TYPES.some(m => m.toLowerCase().startsWith(normalizedMime));
      if (!isAllowed) {
        throw {
          status: 400,
          message: `Unsupported audio format '${mimeType}'. Allowed formats: webm, wav, mp3, ogg, m4a`
        };
      }
    }

    return true;
  }

  static async transcribeAudio(audioBufferOrPath, mimeType = 'audio/webm', attempt = 1) {
    let audioBuffer;
    let tempFilePath = null;

    if (typeof audioBufferOrPath === 'string') {
      // Safe path traversal check
      const normalizedPath = path.resolve(audioBufferOrPath);
      const allowedDir = path.resolve(__dirname, '../../../uploads/voice');
      const projectRoot = path.resolve(__dirname, '../../../');

      if (!normalizedPath.startsWith(projectRoot)) {
        throw { status: 400, message: 'Invalid file path: path traversal detected' };
      }

      if (!fs.existsSync(normalizedPath)) {
        throw { status: 404, message: 'Audio file not found' };
      }

      audioBuffer = fs.readFileSync(normalizedPath);
      tempFilePath = normalizedPath;
    } else if (Buffer.isBuffer(audioBufferOrPath)) {
      audioBuffer = audioBufferOrPath;
    } else {
      throw { status: 400, message: 'Invalid audio input format' };
    }

    this.validateAudioUpload(audioBuffer, mimeType, audioBuffer.length);

    const config = this.getProviderConfig();

    try {
      if (this.isConfigured() && config.provider === 'assemblyai') {
        const result = await this.callWithTimeout(async () => {
          return await this.transcribeWithAssemblyAI(audioBuffer, mimeType, config);
        }, config.timeoutMs);
        return result;
      } else {
        // Fallback / Deterministic local STT handler
        return this.fallbackTranscribe(audioBuffer, mimeType);
      }
    } catch (err) {
      console.warn(`[STT Service] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 1000));
        return this.transcribeAudio(audioBuffer, mimeType, attempt + 1);
      }

      // If all retries fail, activate fallback transcription rather than crashing
      console.warn('[STT Service] External provider exhausted. Providing fallback transcription.');
      return this.fallbackTranscribe(audioBuffer, mimeType, err.message);
    } finally {
      // Cleanup temporary file if it was created in uploads/voice
      if (tempFilePath && tempFilePath.includes('uploads/voice') && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (_) {}
      }
    }
  }

  static async transcribeWithAssemblyAI(audioBuffer, mimeType, config = {}) {
    const apiKey = typeof config === 'string' ? config : (config.apiKey || process.env.ASSEMBLYAI_API_KEY || '');
    if (!apiKey) {
      throw new Error('AssemblyAI API key is missing or not configured');
    }
    const language = (typeof config === 'object' && config.language) || 'en';

    // 1. Upload audio to AssemblyAI
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      throw new Error(`AssemblyAI upload error (${uploadRes.status}): ${errBody}`);
    }

    const { upload_url } = await uploadRes.json();
    if (!upload_url) {
      throw new Error('AssemblyAI did not return an upload URL');
    }

    // 2. Request transcription
    const transcriptReq = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'authorization': config.apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_code: config.language || 'en'
      })
    });

    if (!transcriptReq.ok) {
      const errBody = await transcriptReq.text();
      throw new Error(`AssemblyAI transcript request error (${transcriptReq.status}): ${errBody}`);
    }

    const transcriptInit = await transcriptReq.json();
    const transcriptId = transcriptInit.id;

    // 3. Poll for completion with bounded attempts
    const pollingUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    const maxPolls = 15;
    let pollCount = 0;

    while (pollCount < maxPolls) {
      pollCount++;
      await new Promise(r => setTimeout(r, 2000));

      const pollRes = await fetch(pollingUrl, {
        headers: { 'authorization': config.apiKey }
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (pollData.status === 'completed') {
        const cleanTranscript = (pollData.text || '').trim();
        return {
          transcript: cleanTranscript,
          language: pollData.language_code || config.language,
          durationMs: pollData.audio_duration ? Math.round(pollData.audio_duration * 1000) : null,
          confidence: pollData.confidence || 0.95,
          provider: 'assemblyai',
          isFallback: false
        };
      } else if (pollData.status === 'error') {
        throw new Error(`AssemblyAI transcription failed: ${pollData.error || 'Unknown error'}`);
      }
    }

    throw new Error('STT_TIMEOUT: Transcription polling timed out');
  }

  static fallbackTranscribe(audioBuffer, mimeType, failureReason = null) {
    // Deterministic fallback response when external STT key is unconfigured or unavailable
    const byteLength = audioBuffer.length;
    const durationEstimateSec = Math.max(1, Math.min(120, Math.round(byteLength / 16000)));

    return {
      transcript: '',
      language: 'en',
      durationMs: durationEstimateSec * 1000,
      confidence: 0.0,
      provider: 'fallback_stt',
      isFallback: true,
      metadata: {
        fallbackReason: failureReason || 'UNCONFIGURED_OR_LOCAL_FALLBACK',
        audioSizeBytes: byteLength,
        mimeType
      }
    };
  }

  static async callWithTimeout(asyncFn, timeoutMs) {
    return Promise.race([
      asyncFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`STT_TIMEOUT: Transcription request did not complete within ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
}

module.exports = SpeechToTextService;
