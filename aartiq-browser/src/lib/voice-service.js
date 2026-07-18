const { systemPreferences, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('cross-fetch');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class VoiceService {
  constructor() {
    this.openaiKey = '';
    this.whisperCppBinary = process.env.WHISPER_CPP_BINARY || '';
    this.whisperCppModel = process.env.WHISPER_CPP_MODEL || '';
  }

  configure(keys) {
    if (keys.OPENAI_API_KEY) this.openaiKey = keys.OPENAI_API_KEY;
    if (keys.WHISPER_CPP_BINARY) this.whisperCppBinary = keys.WHISPER_CPP_BINARY;
    if (keys.WHISPER_CPP_MODEL) this.whisperCppModel = keys.WHISPER_CPP_MODEL;
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

  _findWhisperCppBinary() {
    const candidates = [
      this.whisperCppBinary,
      process.env.WHISPER_CPP_BINARY,
      path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(process.cwd(), 'bin', process.platform === 'win32' ? 'main.exe' : 'main'),
      'whisper-cli',
      'main',
    ].filter(Boolean);

    return candidates.find((candidate) => {
      if (candidate === 'whisper-cli' || candidate === 'main') return true;
      try {
        return fs.existsSync(candidate);
      } catch {
        return false;
      }
    }) || '';
  }

  _findWhisperCppModel() {
    const candidates = [
      this.whisperCppModel,
      process.env.WHISPER_CPP_MODEL,
      path.join(process.cwd(), 'models', 'ggml-base.en.bin'),
      path.join(process.cwd(), 'models', 'ggml-small.en.bin'),
      path.join(process.cwd(), 'bin', 'ggml-base.en.bin'),
    ].filter(Boolean);

    return candidates.find((candidate) => {
      try {
        return fs.existsSync(candidate);
      } catch {
        return false;
      }
    }) || '';
  }

  async transcribeFileWithWhisperCpp(audioPath) {
    const binary = this._findWhisperCppBinary();
    const model = this._findWhisperCppModel();
    if (!binary || !model) {
      throw new Error('whisper.cpp is not configured. Set WHISPER_CPP_BINARY and WHISPER_CPP_MODEL, or place whisper-cli and ggml-base.en.bin in the app bin/models folder.');
    }

    const args = ['-m', model, '-f', audioPath, '-nt', '-l', 'en'];
    const { stdout, stderr } = await execFileAsync(binary, args, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    const combined = `${stdout || ''}\n${stderr || ''}`.trim();
    return combined
      .split('\n')
      .map((line) => line.replace(/^\[[^\]]+\]\s*/, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  async transcribeFile(audioPath) {
    try {
      return await this.transcribeFileWithWhisperCpp(audioPath);
    } catch (localError) {
      if (!this._getKey()) throw localError;
      console.warn('[Voice] whisper.cpp unavailable, falling back to OpenAI Whisper:', localError.message);
    }

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
