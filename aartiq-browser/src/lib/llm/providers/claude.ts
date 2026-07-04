// src/lib/llm/providers/claude.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './base';

export class ClaudeProvider implements LLMProvider {
    id: string = 'claude';
    name: string = 'Anthropic Claude';
    private apiKey: string | undefined;
    private model: string | undefined;

    init(options: LLMProviderOptions): void {
        this.apiKey = options.apiKey;
        this.model = options.model || 'claude-sonnet-4-6';
    }

    async generateContent(prompt: string, options?: any): Promise<GenerateContentResult> {
        return this.generateChatContent([{ role: 'user', content: prompt }], options);
    }

    async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
        if (!this.apiKey) return { error: 'Claude API key missing' };

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'dangerously-allow-browser': 'true'
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
                })
            });

            if (!response.ok) {
                const err = await response.json();
                return { error: `Claude Error: ${err.error?.message || response.statusText}` };
            }

            const data = await response.json();
            return { text: data.content?.[0]?.text || '' };
        } catch (err: any) {
            return { error: err.message };
        }
    }
}
