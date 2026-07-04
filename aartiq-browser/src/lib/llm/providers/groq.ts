// src/lib/llm/providers/groq.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './base';

export class GroqProvider implements LLMProvider {
    id: string = 'groq';
    name: string = 'Groq';
    private apiKey: string | undefined;
    private model: string = 'llama-3.3-70b-versatile';
    private baseUrl: string = 'https://api.groq.com/openai/v1';

    constructor(options?: LLMProviderOptions) {
        if (options) {
            this.init(options);
        }
    }

    init(options: LLMProviderOptions): void {
        this.apiKey = options.apiKey;
        this.model = options.model || 'llama-3.3-70b-versatile';
    }

    async generateContent(prompt: string, options?: any): Promise<GenerateContentResult> {
        const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
        return this.generateChatContent(messages, options);
    }

    async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
        if (!this.apiKey) {
            return { error: 'Groq API key is not configured.' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
                    ...options?.body,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return { error: `Groq error: ${response.status} - ${errorData.error?.message || response.statusText}` };
            }

            const data = await response.json();
            return { text: data.choices[0]?.message?.content || '' };
        } catch (error: any) {
            return { error: `Groq error: ${error.message}` };
        }
    }
}
