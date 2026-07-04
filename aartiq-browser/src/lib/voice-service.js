const { systemPreferences, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('cross-fetch');

class VoiceService {
  constructor() {
    this.openaiKey = '';
  }

  configure(keys) {
    if (keys.OPENAI_API_KEY) this.openaiKey = keys.OPENAI_API_KEY;
  }

  _getKey() {
    return this.openaiKey || process.env.OPENAI_API_KEY || '';
  }

  async requestMicPermission() {
    if (process.platform !== 'darwin') return true;
    try {
      const status = await systemPreferences.askForMediaAccess('microphone');
      return status;
    } catch (e) {
      console.warn('[Voice] Mic permission request failed:', e.message);
      return false;
    }
  }

  async transcribeFile(audioPath) {
    const apiKey = this._getKey();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured for voice transcription');

    const fileBuffer = fs.readFileSync(audioPath);
    const boundary = `----FormBoundary${Date.now()}`;

    const fileName = path.basename(audioPath);
    const mimeType = fileName.endsWith('.webm') ? 'audio/webm'
      : fileName.endsWith('.mp3') ? 'audio/mpeg'
      : fileName.endsWith('.m4a') ? 'audio/mp4'
      : 'audio/wav';

    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ];
    const bodyEnd = [
      `\r\n--${boundary}\r\n`,
      `Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="language"\r\n\r\nen\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`,
      `--${boundary}--\r\n`,
    ];

    const headerBuf = Buffer.from(bodyParts.join(''));
    const endBuf = Buffer.from(bodyEnd.join(''));
    const body = Buffer.concat([headerBuf, fileBuffer, endBuf]);

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API error ${res.status}: ${err}`);
    }

    return await res.text();
  }

  async transcribeBase64(audioBase64, format = 'wav') {
    const tmpPath = path.join(os.tmpdir(), `comet-voice-${Date.now()}.${format}`);
    try {
      fs.writeFileSync(tmpPath, Buffer.from(audioBase64, 'base64'));
      const text = await this.transcribeFile(tmpPath);
      return text.trim();
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  }
}

module.exports = { VoiceService };
