/**
 * Ollama Manager
 * 
 * Handles communication with local Ollama server for AI inference.
 */

const http = require('http');

class OllamaManager {
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.isAvailable = null;
    }

    async checkHealth() {
        try {
            const response = await this.request('/api/tags');
            this.isAvailable = true;
            return true;
        } catch (error) {
            this.isAvailable = false;
            return false;
        }
    }

    async listModels() {
        const response = await this.request('/api/tags');
        return response.models?.map(m => m.name) || [];
    }

    async generate(options) {
        const { model = 'llama3', prompt, system, options: modelOptions = {} } = options;

        const payload = {
            model,
            prompt,
            stream: false,
            options: {
                temperature: modelOptions.temperature || 0.7,
                num_predict: modelOptions.maxTokens || 4096,
                ...modelOptions
            }
        };

        if (system) {
            payload.system = system;
        }

        const response = await this.request('/api/generate', payload);
        
        return {
            response: response.response,
            model: response.model,
            done: response.done,
            context: response.context
        };
    }

    async chat(options) {
        const { model = 'llama3', messages, options: modelOptions = {} } = options;

        const payload = {
            model,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: false,
            options: {
                temperature: modelOptions.temperature || 0.7,
                num_predict: modelOptions.maxTokens || 4096,
                ...modelOptions
            }
        };

        const response = await this.request('/api/chat', payload);
        
        return {
            message: response.message,
            model: response.model,
            done: response.done
        };
    }

    async pull(modelName, onProgress) {
        const payload = { name: modelName };

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(payload);
            
            const options = {
                hostname: new URL(this.baseUrl).hostname,
                port: new URL(this.baseUrl).port || 11434,
                path: '/api/pull',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        // Streaming response, last line is final status
                        const lines = data.split('\n').filter(l => l.trim());
                        const lastLine = lines[lines.length - 1];
                        const result = JSON.parse(lastLine);
                        
                        if (result.error) {
                            reject(new Error(result.error));
                        } else {
                            resolve({ status: 'success', model: modelName });
                        }
                    } catch (e) {
                        resolve({ status: 'success' });
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();

            // Handle progress callback if provided
            if (onProgress) {
                req.on('data', (chunk) => {
                    try {
                        const lines = chunk.toString().split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            const data = JSON.parse(line);
                            onProgress(data);
                        }
                    } catch {
                        // Ignore parse errors during streaming
                    }
                });
            }
        });
    }

    async delete(modelName) {
        const payload = { name: modelName };
        return await this.request('/api/delete', payload);
    }

    async showModelInfo(modelName) {
        const payload = { name: modelName };
        return await this.request('/api/show', payload);
    }

    async request(endpoint, payload = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 11434,
                path: endpoint,
                method: payload ? 'POST' : 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            reject(new Error(parsed.error));
                        } else {
                            resolve(parsed);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            
            if (payload) {
                req.write(JSON.stringify(payload));
            }
            
            req.end();
        });
    }

    setBaseUrl(url) {
        this.baseUrl = url;
        this.isAvailable = null; // Reset availability check
    }

    getBaseUrl() {
        return this.baseUrl;
    }

    getStatus() {
        return {
            available: this.isAvailable,
            baseUrl: this.baseUrl
        };
    }
}

module.exports = { OllamaManager };
