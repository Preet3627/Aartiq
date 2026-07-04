// src/lib/llm/providers/openai-compatible.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './base';

export class OpenAICompatibleProvider implements LLMProvider {
  id: string = 'openai-compatible';
  name: string = 'OpenAI Compatible';
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  private model: string | undefined;

  constructor(options?: LLMProviderOptions) {
    if (options) {
      this.init(options);
    }
  }

  init(options: LLMProviderOptions): void {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1'; // Default to OpenAI API
    this.model = options.model || 'gpt-5.2';
  }

  async generateContent(prompt: string, options?: any): Promise<GenerateContentResult> {
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
    return this.generateChatContent(messages, options);
  }

  async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
    if (!this.apiKey) {
      return { error: 'API key is not configured for OpenAI Compatible provider.' };
    }
    if (!this.baseUrl) {
        return { error: 'Base URL is not configured for OpenAI Compatible provider.' };
    }
    if (!this.model) {
        return { error: 'Model is not configured for OpenAI Compatible provider.' };
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options?.headers,
      };

      const body = JSON.stringify({
        model: this.model,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        ...options?.body,
      });

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { error: `OpenAI Compatible API error: ${response.status} - ${errorData.error?.message || response.statusText}` };
      }

      const data = await response.json();
      return { text: data.choices[0]?.message?.content || '' };
    } catch (error: any) {
      return { error: `Network or other error: ${error.message}` };
    }
  }
}
