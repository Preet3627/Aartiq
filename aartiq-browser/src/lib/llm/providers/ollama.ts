// src/lib/llm/providers/ollama.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './base';

export class OllamaProvider implements LLMProvider {
    id: string = 'ollama';
    name: string = 'Ollama (Local)';
    private baseUrl: string = 'http://localhost:11434';
    private model: string = 'llama3';

    constructor(options?: LLMProviderOptions) {
        if (options) {
            this.init(options);
        }
    }

    init(options: LLMProviderOptions): void {
        this.baseUrl = options.baseUrl || 'http://localhost:11434';
        this.model = options.model || 'llama3';
    }

    async generateContent(prompt: string, options?: any): Promise<GenerateContentResult> {
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
        return this.generateChatContent(messages, options);
    }

    async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
                    stream: false,
                    ...options?.body,
                }),
            });

            if (!response.ok) {
                return { error: `Ollama API error: ${response.status} - ${response.statusText}` };
            }

            const data = await response.json();
            return { text: data.message?.content || '' };
        } catch (error: any) {
            return { error: `Ollama error: ${error.message}` };
        }
    }
}
