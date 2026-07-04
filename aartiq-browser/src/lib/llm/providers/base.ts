// src/lib/llm/providers/base.ts

export interface LLMProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  type?: string;
  localLlmMode?: string;
  // Add other common options as needed
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface GenerateContentResult {
  text?: string;
  thought?: string;
  error?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  // Initialize the provider with options
  init(options: LLMProviderOptions): void;
  // Generate a text completion
  generateContent(prompt: string, options?: any): Promise<GenerateContentResult>;
  // Generate a chat response
  generateChatContent(messages: ChatMessage[], options?: any): Promise<GenerateContentResult>;
  // Optionally, methods for capabilities like image generation, tool calling, etc.
  // getCapabilities(): LLMCapabilities;
}