const fetch = require('cross-fetch');

// ---------------------------------------------------------------------------
// Universal stream reader: works for both WHATWG ReadableStream (Node 18+ native
// fetch) and Node.js Readable (node-fetch / older cross-fetch).
// ---------------------------------------------------------------------------
async function* streamToLines(body) {
  let buffer = '';

  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    // Node.js Readable OR WHATWG ReadableStream (both support async iteration)
    for await (const chunk of body) {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) yield line;
    }
  } else if (body && typeof body.getReader === 'function') {
    // WHATWG ReadableStream without async iteration support (rare)
    const reader = body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) yield line;
    }
  } else {
    throw new Error('[AiEngine] Response body is not a readable stream');
  }

  // Flush any remaining buffer content
  if (buffer.trim()) yield buffer;
}

// ---------------------------------------------------------------------------
// AartiqAiEngine — multi-provider AI chat engine
// ---------------------------------------------------------------------------
class AartiqAiEngine {
  constructor() {
    this.keys = {};
    this.ollamaBaseUrl = 'http://127.0.0.1:11434';
    this.azureOpenaiBaseUrl = '';
  }

  configure(keys) {
    this.keys = { ...this.keys, ...keys };
    if (keys.OLLAMA_BASE_URL) this.ollamaBaseUrl = keys.OLLAMA_BASE_URL;
    if (keys.AZURE_OPENAI_BASE_URL) this.azureOpenaiBaseUrl = keys.AZURE_OPENAI_BASE_URL;
  }

  _getKey(name) {
    return this.keys[name] || process.env[name] || '';
  }

  _inferProvider(model) {
    if (!model) return 'ollama';
    const m = model.toLowerCase();

    // Explicit provider prefixes
    // Local model heuristics — treat all common local models as Ollama
    if (
      m.includes('llama') || m.includes('mistral') || m.includes('deepseek') ||
      m.includes('phi') || m.includes('qwen') || m.includes('gemma') ||
      m.includes(':') || m.includes('local') || m.includes('orca') ||
      m.includes('codellama') || m.includes('solar') || m.includes('vicuna') ||
      m.includes('wizard') || m.includes('neural') || m.includes('openchat') ||
      m.includes('gpt-oss') // Explicitly handle the user's favorite local model
    ) {
      return 'ollama';
    }

    if (m.startsWith('openai/') || m.includes('gpt-')) return 'openai';
    if (m.startsWith('google/') || m.includes('gemini-')) return 'gemini';
    if (m.startsWith('anthropic/') || m.includes('claude-')) return 'anthropic';
    if (m.startsWith('xai/') || m.includes('grok-')) return 'xai';
    if (m.startsWith('groq/') || m.includes('llama-3.3')) return 'groq';

    if (m.includes('gemini') || m.includes('google')) return 'gemini';
    if (m.includes('gpt') || m.includes('openai')) return 'openai';
    if (m.includes('claude') || m.includes('anthropic')) return 'anthropic';
    if (m.includes('grok') || m.includes('xai')) return 'xai';
    if (m.includes('groq')) return 'groq';

    // Default: try Ollama (local first policy)
    return 'ollama';
  }

  async chat({ message, model, systemPrompt, history, onChunk, provider }) {
    const resolvedProvider = provider || this._inferProvider(model);
    console.log(`[AiEngine] Chat → model="${model || 'default'}" → provider="${resolvedProvider}"`);

    switch (resolvedProvider) {
      case 'ollama':    return this._chatOllama({ message, model, systemPrompt, history, onChunk });
      case 'gemini':
      case 'google':
      case 'google-flash':
        return this._chatGemini({ message, model, systemPrompt, history, onChunk });
      case 'groq':      return this._chatGroq({ message, model, systemPrompt, history, onChunk });
      case 'openai':    return this._chatOpenAI({ message, model, systemPrompt, history, onChunk });
      case 'xai':       return this._chatXai({ message, model, systemPrompt, history, onChunk });
      case 'azure-openai': return this._chatAzureOpenAI({ message, model, systemPrompt, history, onChunk });
      case 'anthropic': return this._chatAnthropic({ message, model, systemPrompt, history, onChunk });
      default:
        throw new Error(`Unsupported provider: ${resolvedProvider}`);
    }
  }

  // -------------------------------------------------------------------------
  // Ollama
  // -------------------------------------------------------------------------
  async _chatOllama({ message, model, systemPrompt, history, onChunk }) {
    const targetModel = model || 'llama3';
    console.log(`[AiEngine] Ollama → model="${targetModel}" streaming=${!!onChunk}`);

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const res = await fetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: !!onChunk,
        options: { num_ctx: 32768, temperature: 0.7 }
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama error ${res.status}: ${err}`);
    }

    if (onChunk) {
      // Streaming — use universal async-iterable reader
      for await (const line of streamToLines(res.body)) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          // Use !== undefined so empty string '' is also emitted
          if (json.message?.content !== undefined && json.message.content !== '') {
            onChunk(json.message.content);
          }
        } catch (e) {
          console.warn('[AiEngine] Ollama chunk parse error:', e.message);
        }
      }
      return '';
    } else {
      const data = await res.json();
      return data.message?.content || '';
    }
  }

  // -------------------------------------------------------------------------
  // Groq (OpenAI-compatible SSE)
  // -------------------------------------------------------------------------
  async _chatGroq({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 8192,
        stream: !!onChunk,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    if (onChunk) {
      for await (const line of streamToLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {}
      }
      return '';
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // -------------------------------------------------------------------------
  // Gemini — fixed per official docs: ai.google.dev/api/generate-content
  // Streaming: use ?alt=sse so response is SSE (data: {...} lines)
  // System prompt: use top-level "systemInstruction" field (not user/model hack)
  // -------------------------------------------------------------------------
  async _chatGemini({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    // Build contents array — only user/model turns (NO system role)
    const contents = [];
    for (const h of (history || [])) {
      // Normalize role names: 'assistant' -> 'model', system messages skipped
      if (h.role === 'system') continue;
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content || '' }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const targetModel = model || 'gemini-2.0-flash';

    // Build request body per official spec
    const requestBody = { contents };

    // Use the official "systemInstruction" field for system prompts
    // NOT a fake user/model pair at the start of contents
    if (systemPrompt && systemPrompt.trim()) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    if (onChunk) {
      // Official docs: append ?alt=sse to get Server-Sent Events format
      // Each line will be: "data: {json}" — NOT a raw JSON array
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err}`);
      }

      // Per official docs each SSE chunk is: "data: {GenerateContentResponse JSON}"
      for await (const line of streamToLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.substring(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const json = JSON.parse(jsonStr);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);
        } catch (e) {
          // Silently skip malformed chunks
        }
      }
      return '';
    } else {
      // Non-streaming: standard generateContent
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

  // -------------------------------------------------------------------------
  // OpenAI (SSE)
  // -------------------------------------------------------------------------
  async _chatOpenAI({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages,
        max_tokens: 8192,
        stream: !!onChunk,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    if (onChunk) {
      for await (const line of streamToLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {}
      }
      return '';
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // -------------------------------------------------------------------------
  // xAI (OpenAI-compatible REST API)
  // -------------------------------------------------------------------------
  async _chatXai({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('XAI_API_KEY');
    if (!apiKey) throw new Error('XAI_API_KEY not configured');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'grok-4-fast-reasoning',
        messages,
        max_tokens: 8192,
        stream: !!onChunk,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`xAI API error ${res.status}: ${err}`);
    }

    if (onChunk) {
      for await (const line of streamToLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {}
      }
      return '';
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // -------------------------------------------------------------------------
  // Azure OpenAI (OpenAI-compatible v1 endpoint)
  // -------------------------------------------------------------------------
  async _chatAzureOpenAI({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('AZURE_OPENAI_API_KEY');
    const baseUrl = this.azureOpenaiBaseUrl || this._getKey('AZURE_OPENAI_BASE_URL');
    if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY not configured');
    if (!baseUrl) throw new Error('AZURE_OPENAI_BASE_URL not configured');

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        model: model || 'gpt-4.1-mini',
        messages,
        max_tokens: 8192,
        stream: !!onChunk,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Azure OpenAI API error ${res.status}: ${err}`);
    }

    if (onChunk) {
      for await (const line of streamToLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch (e) {}
      }
      return '';
    } else {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // -------------------------------------------------------------------------
  // Anthropic (non-streaming only for now)
  // -------------------------------------------------------------------------
  async _chatAnthropic({ message, model, systemPrompt, history, onChunk }) {
    const apiKey = this._getKey('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const messages = [];
    for (const h of (history || [])) messages.push(h);
    messages.push({ role: 'user', content: message });

    const body = {
      model: model || 'claude-3-5-sonnet-latest',
      max_tokens: 8192,
      messages,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    if (onChunk) onChunk(text);
    return text;
  }
}

module.exports = { AartiqAiEngine };
