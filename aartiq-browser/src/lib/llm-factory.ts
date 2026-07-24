// ---------------------------------------------------------------------------
// Multi-Provider LLM Factory — provider-agnostic interface with support
// for non-standard response formats and reasoning effort.
// Wraps existing LLMOrchestrator with additional provider support.
// Inspired by veto-browse's helper.ts.
// ---------------------------------------------------------------------------

export type LLMProviderId =
  | 'openai'
  | 'azure'
  | 'anthropic'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'ollama'
  | 'openrouter'
  | 'cerebras'
  | 'llama';

export interface LLMFactoryConfig {
  provider: LLMProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  reasoning?: string;
}

export interface LLMProviderAdapter {
  generate(messages: LLMMessage[], config: LLMFactoryConfig): Promise<LLMResponse>;
  stream?(messages: LLMMessage[], config: LLMFactoryConfig): AsyncIterable<string>;
}

// ---------------------------------------------------------------------------
// Non-standard response format adapters
// ---------------------------------------------------------------------------

function adaptLlamaResponse(raw: string): string {
  // Llama models sometimes wrap output in [INST] tags or extra formatting
  return raw
    .replace(/\[INST\].*?\[\/INST\]/gs, '')
    .replace(/<s>/g, '')
    .replace(/<\/s>/g, '')
    .replace(RegExp('<<SYS>>.*?<</SYS>>', 'gs'), '')
    .trim();
}

function adaptDeepSeekResponse(raw: string): string {
  // DeepSeek uses <｜end▁of▁thinking｜> format for reasoning
  const thinkMatch = raw.match(/<think>(.*?)<\/think>/s);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
  const content = raw.replace(/<think>.*?<\/think>/gs, '').trim();
  return JSON.stringify({ content, reasoning });
}

// ---------------------------------------------------------------------------
// Provider configurations
// ---------------------------------------------------------------------------

interface ProviderInfo {
  defaultModel: string;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  baseUrl: string;
}

const PROVIDER_INFO: Record<LLMProviderId, ProviderInfo> = {
  openai: { defaultModel: 'gpt-4o', supportsStreaming: true, supportsReasoning: true, baseUrl: 'https://api.openai.com/v1' },
  azure: { defaultModel: 'gpt-4o', supportsStreaming: true, supportsReasoning: true, baseUrl: '' },
  anthropic: { defaultModel: 'claude-sonnet-4-20250514', supportsStreaming: true, supportsReasoning: false, baseUrl: 'https://api.anthropic.com/v1' },
  deepseek: { defaultModel: 'deepseek-chat', supportsStreaming: true, supportsReasoning: true, baseUrl: 'https://api.deepseek.com/v1' },
  gemini: { defaultModel: 'gemini-2.0-flash', supportsStreaming: true, supportsReasoning: false, baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  groq: { defaultModel: 'llama-3.3-70b-versatile', supportsStreaming: true, supportsReasoning: false, baseUrl: 'https://api.groq.com/openai/v1' },
  ollama: { defaultModel: 'llama3.2', supportsStreaming: true, supportsReasoning: false, baseUrl: 'http://localhost:11434/v1' },
  openrouter: { defaultModel: 'openai/gpt-4o', supportsStreaming: true, supportsReasoning: true, baseUrl: 'https://openrouter.ai/api/v1' },
  cerebras: { defaultModel: 'llama3.1-8b', supportsStreaming: true, supportsReasoning: false, baseUrl: 'https://api.cerebras.ai/v1' },
  llama: { defaultModel: 'llama-3.2-3b', supportsStreaming: true, supportsReasoning: false, baseUrl: 'http://localhost:8080/v1' },
};

// ---------------------------------------------------------------------------
// ChatLlama adapter helper
// ---------------------------------------------------------------------------

function buildLlamaPrompt(messages: LLMMessage[]): string {
  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<<SYS>>\n${msg.content}\n<</SYS>>\n`;
    } else if (msg.role === 'user') {
      prompt += `[INST] ${msg.content} [/INST]`;
    } else if (msg.role === 'assistant') {
      prompt += ` ${msg.content} </s><s>`;
    }
  }
  return prompt;
}

// ---------------------------------------------------------------------------
// HTTP-based generation (OpenAI-compatible API)
// ---------------------------------------------------------------------------

async function openaiCompatibleGenerate(
  messages: LLMMessage[],
  config: LLMFactoryConfig,
  providerId: LLMProviderId
): Promise<LLMResponse> {
  const info = PROVIDER_INFO[providerId];
  const baseUrl = config.baseUrl || info.baseUrl;

  const body: Record<string, unknown> = {
    model: config.model || info.defaultModel,
    messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 4096,
  };

  if (config.reasoningEffort && info.supportsReasoning) {
    body.reasoning_effort = config.reasoningEffort;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  if (providerId === 'anthropic') {
    headers['x-api-key'] = config.apiKey || '';
    headers['anthropic-version'] = '2023-06-01';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  let content = data.choices?.[0]?.message?.content || '';
  if (providerId === 'llama') {
    content = adaptLlamaResponse(content);
  }
  if (providerId === 'deepseek') {
    const adapted = adaptDeepSeekResponse(content);
    const parsed = JSON.parse(adapted);
    return {
      content: parsed.content,
      model: data.model || config.model || info.defaultModel,
      usage: data.usage,
      reasoning: parsed.reasoning,
    };
  }

  const reasoning = data.choices?.[0]?.message?.reasoning || data.choices?.[0]?.message?.reasoning_content;

  return {
    content,
    model: data.model || config.model || info.defaultModel,
    usage: data.usage,
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Factory class
// ---------------------------------------------------------------------------

export class LLMFactory {
  private adapters: Map<LLMProviderId, () => Promise<LLMResponse>>;

  constructor() {
    this.adapters = new Map();
  }

  async generate(
    messages: LLMMessage[],
    config: LLMFactoryConfig
  ): Promise<LLMResponse> {
    const info = PROVIDER_INFO[config.provider];
    if (!info) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }

    const providerId = config.provider;

    // Llama models often use non-OpenAI-compatible chat format
    if (providerId === 'llama' && !config.baseUrl?.includes('/v1')) {
      return this.generateLlamaNative(messages, config);
    }

    // Anthropic uses a different API format
    if (providerId === 'anthropic') {
      return this.generateAnthropic(messages, config);
    }

    // Default: OpenAI-compatible API
    return openaiCompatibleGenerate(messages, config, providerId);
  }

  private async generateLlamaNative(
    messages: LLMMessage[],
    config: LLMFactoryConfig
  ): Promise<LLMResponse> {
    const prompt = buildLlamaPrompt(messages);
    const baseUrl = config.baseUrl || PROVIDER_INFO.llama.baseUrl;

    const response = await fetch(`${baseUrl}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: config.model || PROVIDER_INFO.llama.defaultModel,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Llama API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: adaptLlamaResponse(data.choices?.[0]?.text || ''),
      model: data.model || config.model || PROVIDER_INFO.llama.defaultModel,
    };
  }

  private async generateAnthropic(
    messages: LLMMessage[],
    config: LLMFactoryConfig
  ): Promise<LLMResponse> {
    const baseUrl = config.baseUrl || PROVIDER_INFO.anthropic.baseUrl;
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'model' ? 'assistant' as const : m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model: config.model || PROVIDER_INFO.anthropic.defaultModel,
      max_tokens: config.maxTokens ?? 4096,
      messages: chatMessages,
    };
    if (systemMsg) {
      body.system = systemMsg.content;
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || '',
      model: data.model || config.model || PROVIDER_INFO.anthropic.defaultModel,
      usage: data.usage,
    };
  }

  getProviderInfo(providerId: LLMProviderId): ProviderInfo | undefined {
    return PROVIDER_INFO[providerId];
  }

  getAvailableProviders(): { id: LLMProviderId; name: string }[] {
    return (Object.keys(PROVIDER_INFO) as LLMProviderId[]).map((id) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
    }));
  }
}
