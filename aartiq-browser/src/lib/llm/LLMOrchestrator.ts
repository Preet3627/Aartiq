// src/lib/llm/LLMOrchestrator.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './providers/base';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { GeminiProvider } from './providers/gemini';
import { ClaudeProvider } from './providers/claude';
import { OllamaProvider } from './providers/ollama';
import { GroqProvider } from './providers/groq';

export class LLMOrchestrator {
  private providers: Map<string, LLMProvider> = new Map();
  private activeProviderId: string | null = null;
  private configs: Map<string, LLMProviderOptions> = new Map();

  constructor() {
    this.registerProvider(new OpenAICompatibleProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new ClaudeProvider());
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new GroqProvider());
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    this.configs.set(provider.id, {});
  }

  configureProvider(providerId: string, options: LLMProviderOptions): boolean {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.init(options);
      this.configs.set(providerId, options);
      return true;
    }
    return false;
  }

  getProviderConfig(providerId: string): LLMProviderOptions | undefined {
    return this.configs.get(providerId);
  }

  getAvailableProviders(): { id: string; name: string }[] {
    return Array.from(this.providers.values()).map(p => ({ id: p.id, name: p.name }));
  }

  setActiveProvider(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  getActiveProviderId(): string | null {
    return this.activeProviderId;
  }

  async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
    const activeProvider = this.activeProviderId ? this.providers.get(this.activeProviderId) : null;
    if (!activeProvider) {
      return { error: 'No active LLM provider selected.' };
    }
    return activeProvider.generateChatContent(messages, options);
  }
}
