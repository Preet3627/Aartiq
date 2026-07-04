// src/lib/llm/providers/gemini.ts
import { LLMProvider, LLMProviderOptions, ChatMessage, GenerateContentResult } from './base';
import { getRecommendedGeminiModel } from '@/lib/modelRegistry';

export class GeminiProvider implements LLMProvider {
    id: string = 'gemini';
    name: string = 'Google Gemini';
    private apiKey: string | undefined;
    private model: string | undefined;

    init(options: LLMProviderOptions): void {
        this.apiKey = options.apiKey;
        this.model = options.model || getRecommendedGeminiModel('google');
    }

    async generateContent(prompt: string, options?: any): Promise<GenerateContentResult> {
        return this.generateChatContent([{ role: 'user', content: prompt }], options);
    }

    async generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult> {
        if (!this.apiKey) return { error: 'Gemini API key missing' };

        try {
            const contents = messages.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            if (!response.ok) {
                const err = await response.json();
                return { error: `Gemini Error: ${err.error?.message || response.statusText}` };
            }

            const data = await response.json();
            return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
        } catch (err: any) {
            return { error: err.message };
        }
    }
}
