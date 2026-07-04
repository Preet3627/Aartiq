const { desktopCapturer } = require('electron');
const fetch = require('cross-fetch');

class ScreenVisionService {
  constructor(aiEngine) {
    this.aiEngine = aiEngine;
  }

  async captureBase64(quality = 85) {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (!sources[0] || !sources[0].thumbnail) {
      throw new Error('Could not capture screen');
    }

    return sources[0].thumbnail.toJPEG(quality).toString('base64');
  }

  async describe(question) {
    const apiKey = this.aiEngine._getKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return this._describeWithGemini(question);
    }

    try {
      const imageData = await this.captureBase64();
      if (!imageData) {
        throw new Error('Failed to capture screen');
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageData },
              },
              {
                type: 'text',
                text: question || 'Describe what is currently displayed on this screen in 2-3 sentences.',
              },
            ],
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        // Fallback to Gemini if Anthropic fails
        console.warn('[Vision] Anthropic failed, trying Gemini:', err);
        return this._describeWithGemini(question);
      }

      const data = await res.json();
      return data.content?.[0]?.text || '';
    } catch (err) {
      console.error('[Vision] Describe failed:', err.message);
      // Try fallback
      try {
        return await this._describeWithGemini(question);
      } catch (fallbackErr) {
        throw new Error(`Vision failed: ${err.message}. Fallback also failed: ${fallbackErr.message}`);
      }
    }
  }

  async _describeWithGemini(question) {
    const apiKey = this.aiEngine._getKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error('No vision-capable API key configured (need ANTHROPIC_API_KEY or GEMINI_API_KEY)');

    try {
      const imageData = await this.captureBase64();
      if (!imageData) {
        throw new Error('Failed to capture screen for Gemini');
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: imageData } },
                { text: question || 'Describe what is currently displayed on this screen in 2-3 sentences.' },
              ],
            }],
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini Vision API error ${res.status}: ${err}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      console.error('[Vision] Gemini failed:', err.message);
      throw err;
    }
  }

  async analyzeAndAct(question, tesseractService, robotService, permissionStore) {
    const [visionDesc, recognition] = await Promise.all([
      this.describe(question).catch(e => `Vision failed: ${e.message}`),
      tesseractService.captureAndOcr().catch(() => ({ words: [], lines: [] })),
    ]);

    const ocrWords = recognition.words || [];
    const ocrContext = ocrWords.slice(0, 50).map(w => `"${w.text}" at (${w.centerX},${w.centerY})`).join(', ');

    const analysis = await this.aiEngine.chat({
      model: 'gemini-2.5-flash-preview',
      systemPrompt: 'You are a desktop automation assistant. Given a screen description and OCR data, answer the user\'s question. If the user wants to click something, respond with JSON: {"action":"click","target":"button text"}. Otherwise respond normally.',
      message: `Screen description: ${visionDesc}\n\nOCR elements: ${ocrContext}\n\nUser question: ${question}`,
    });

    return {
      description: visionDesc,
      ocrWordCount: ocrWords.length,
      analysis,
    };
  }
}

module.exports = { ScreenVisionService };
