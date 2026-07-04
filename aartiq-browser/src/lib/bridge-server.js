const { createServer } = require('http');
const { randomBytes, createHmac } = require('crypto');
const WebSocket = require('ws');

class FlutterBridgeServer {
  constructor(aiEngine, tesseractOcr) {
    this.ai = aiEngine;
    this.ocr = tesseractOcr;
    this.secret = randomBytes(24).toString('hex');
    this.connectedDevices = new Map();
    this.server = null;
    this.wss = null;
    this.port = 9876;
  }

  start(port) {
    if (this.server) return;
    this.port = port || 9876;

    this.server = createServer();
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      const token = url.searchParams.get('token');

      if (token !== this.secret) {
        ws.close(4001, 'Unauthorized');
        console.log('[Bridge] Rejected unauthorized connection');
        return;
      }

      const deviceId = url.searchParams.get('deviceId') || `device-${Date.now()}`;
      this.connectedDevices.set(ws, deviceId);
      console.log(`[Bridge] Flutter device connected: ${deviceId}`);

      ws.on('message', async (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
          return;
        }

        try {
          await this._handleMessage(ws, msg);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: e.message, originalType: msg.type }));
        }
      });

      ws.on('close', () => {
        console.log(`[Bridge] Flutter device disconnected: ${deviceId}`);
        this.connectedDevices.delete(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', deviceId }));
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[Bridge] Flutter bridge ready on ws://127.0.0.1:${this.port}`);
    });
  }

  async _handleMessage(ws, msg) {
    switch (msg.type) {
      case 'ai:chat': {
        if (!this.ai) throw new Error('AI engine not available');
        ws.send(JSON.stringify({ type: 'ai:status', status: 'generating' }));
        const response = await this.ai.chat({
          message: msg.message,
          model: msg.model || 'llama-3.3-70b-versatile',
          onChunk: (chunk) => {
            ws.send(JSON.stringify({ type: 'ai:chunk', chunk }));
          },
        });
        ws.send(JSON.stringify({ type: 'ai:done', response }));
        break;
      }

      case 'ocr:click': {
        if (!this.ocr) throw new Error('OCR service not available');
        ws.send(JSON.stringify({ type: 'ocr:status', status: 'scanning' }));
        const recognition = await this.ocr.captureAndOcr();
        ws.send(JSON.stringify({
          type: 'ocr:result',
          provider: recognition.provider,
          words: (recognition.words || []).slice(0, 50),
          lines: (recognition.lines || []).slice(0, 25),
        }));
        break;
      }

      case 'screen:describe': {
        if (!this.ocr || !this.ai) throw new Error('OCR/AI not available');
        const recognition = await this.ocr.captureAndOcr();
        const context = (recognition.lines?.length ? recognition.lines : recognition.words || [])
          .map((item) => item.text)
          .join(' ');
        const description = await this.ai.chat({
          model: 'gemini-2.5-flash-preview',
          message: `Describe what's on this screen briefly in 1-2 sentences: ${context.slice(0, 2000)}`,
        });
        ws.send(JSON.stringify({ type: 'screen:description', description }));
        break;
      }

      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      }

      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
    }
  }

  getPairingCode() {
    return Buffer.from(JSON.stringify({
      host: '127.0.0.1',
      port: this.port,
      secret: this.secret,
      version: '1.0',
      expires: Date.now() + 300000,
    })).toString('base64');
  }

  getConnectedCount() {
    return this.connectedDevices.size;
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const [ws] of this.connectedDevices) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  stop() {
    if (this.wss) {
      for (const [ws] of this.connectedDevices) {
        ws.close(1000, 'Server shutting down');
      }
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.connectedDevices.clear();
    console.log('[Bridge] Flutter bridge stopped');
  }

  rotateSecret() {
    this.secret = randomBytes(24).toString('hex');
    console.log('[Bridge] Secret rotated');
    return this.secret;
  }
}

module.exports = { FlutterBridgeServer };
