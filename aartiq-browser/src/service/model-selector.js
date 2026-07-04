/**
 * Model Selector
 * 
 * Manages AI model selection and configuration.
 * Supports Ollama (local), Gemini, OpenAI, Anthropic, and more.
 */

const https = require('https');
const http = require('http');

class ModelSelector {
    constructor(storageManager) {
        this.storage = storageManager;
        this.preferences = null;
        this.ollamaStatus = null;
    }

    async initialize() {
        this.preferences = await this.storage.getModelPreferences();
        
        // Check Ollama status
        await this.checkOllama();
    }

    // Available models
    getAvailableProviders() {
        return [
            {
                id: 'ollama',
                name: 'Ollama (Local)',
                description: 'Run models locally on your machine',
                icon: '🖥️',
                requiresApiKey: false,
                models: [
                    { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B', memory: '16GB+', recommended: true },
                    { id: 'deepseek-r1:8b', name: 'DeepSeek R1 8B', memory: '8GB+', recommended: true },
                    { id: 'llama3:8b', name: 'Llama 3 8B', memory: '6GB+' },
                    { id: 'llama3:70b', name: 'Llama 3 70B', memory: '32GB+' },
                    { id: 'mistral:7b', name: 'Mistral 7B', memory: '4GB+' },
                    { id: 'mixtral:8x7b', name: 'Mixtral 8x7B', memory: '12GB+' },
                    { id: 'codellama:13b', name: 'CodeLlama 13B', memory: '8GB+' },
                    { id: 'phi3:14b', name: 'Phi-3 14B', memory: '8GB+' }
                ]
            },
            {
                id: 'gemini',
                name: 'Google Gemini',
                description: 'Free tier available, fast and capable',
                icon: '🔥',
                requiresApiKey: false,
                tier: 'Free',
                models: [
                    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', recommended: true },
                    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
                    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
                    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
                ]
            },
            {
                id: 'openai',
                name: 'OpenAI',
                description: 'GPT-4 and GPT-4o models',
                icon: '☁️',
                requiresApiKey: true,
                models: [
                    { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', fast: true },
                    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', fast: true }
                ]
            },
            {
                id: 'anthropic',
                name: 'Anthropic Claude',
                description: 'Claude 3.5 Sonnet and family',
                icon: '🤖',
                requiresApiKey: true,
                models: [
                    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', recommended: true },
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
                    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', fast: true }
                ]
            },
            {
                id: 'groq',
                name: 'Groq',
                description: 'Fast inference, free tier available',
                icon: '⚡',
                requiresApiKey: false,
                tier: 'Free tier',
                models: [
                    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', recommended: true },
                    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', fast: true },
                    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', fast: true }
                ]
            },
            {
                id: 'auto',
                name: 'Auto (Recommended)',
                description: 'Automatically selects best available model',
                icon: '🎯',
                requiresApiKey: false,
                models: [
                    { id: 'auto', name: 'Auto Select', recommended: true }
                ]
            }
        ];
    }

    async checkOllama() {
        const baseUrl = this.preferences.ollamaUrl || 'http://localhost:11434';
        
        try {
            const response = await this.httpGet(`${baseUrl}/api/tags`);
            const data = JSON.parse(response);
            
            this.ollamaStatus = {
                available: true,
                url: baseUrl,
                models: data.models?.map(m => m.name) || []
            };
            
            console.log(`[ModelSelector] Ollama available with ${this.ollamaStatus.models.length} models`);
            
        } catch (error) {
            this.ollamaStatus = {
                available: false,
                url: baseUrl,
                error: error.message
            };
            
            console.log('[ModelSelector] Ollama not available:', error.message);
        }
    }

    async pullModel(modelName) {
        if (!this.ollamaStatus?.available) {
            throw new Error('Ollama is not available');
        }

        const baseUrl = this.ollamaStatus.url;
        
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ name: modelName });
            
            const options = {
                hostname: new URL(baseUrl).hostname,
                port: new URL(baseUrl).port || 11434,
                path: '/api/pull',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        if (result.status === 'success') {
                            resolve(result);
                        } else {
                            reject(new Error(body));
                        }
                    } catch {
                        resolve({ status: 'success' });
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    selectModel(taskType) {
        // Smart model selection based on task type
        const recommendations = {
            'ai-prompt': { provider: 'gemini', model: 'gemini-2.0-flash' },
            'web-scrape': { provider: 'gemini', model: 'gemini-2.0-flash' },
            'pdf-generate': { provider: 'ollama', model: 'deepseek-r1:8b' },
            'shell': { provider: 'gemini', model: 'gemini-2.0-flash' },
            'workflow': { provider: 'gemini', model: 'gemini-2.0-flash' },
            'daily-brief': { provider: 'gemini', model: 'gemini-2.0-flash' }
        };

        // Check if Ollama is preferred and available
        if (this.preferences?.preferLocal && this.ollamaStatus?.available) {
            return { provider: 'ollama', model: 'deepseek-r1:8b' };
        }

        return recommendations[taskType] || recommendations['ai-prompt'];
    }

    getModelInfo(provider, modelId) {
        const providers = this.getAvailableProviders();
        const p = providers.find(p => p.id === provider);
        if (!p) return null;
        
        const m = p.models.find(m => m.id === modelId);
        if (!m) return null;

        return {
            ...m,
            provider: p
        };
    }

    async setPreference(key, value) {
        this.preferences[key] = value;
        await this.storage.saveModelPreferences(this.preferences);
    }

    getPreferences() {
        return this.preferences;
    }

    // HTTP helper
    httpGet(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            
            client.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    getStatus() {
        return {
            ollama: this.ollamaStatus,
            preferences: this.preferences,
            providers: this.getAvailableProviders()
        };
    }
}

module.exports = { ModelSelector };
