/**
 * Task Queue
 * 
 * Manages the execution queue for tasks.
 * Handles priority, retries, and concurrent execution limits.
 */

const { EventEmitter } = require('events');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

function applyComparison(a, op, b) {
    switch (op) {
        case '==': return a == b;
        case '!=': return a != b;
        case '>': return a > b;
        case '>=': return a >= b;
        case '<': return a < b;
        case '<=': return a <= b;
        default: return false;
    }
}

function parseValue(str) {
    str = str.trim();
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null') return null;
    if (str === 'undefined') return undefined;
    const num = Number(str);
    if (!isNaN(num) && str !== '') return num;
    if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
        return str.slice(1, -1);
    }
    return str;
}

class TaskQueue extends EventEmitter {
    constructor(storageManager) {
        super();
        this.storage = storageManager;
        this.queue = [];
        this.runningTasks = new Map();
        this.maxConcurrent = 2;
        this.isProcessing = false;
    }

    async initialize() {
        // Load any pending tasks from storage
        const pending = await this.storage.getPendingTasks();
        this.queue.push(...pending);
        
        console.log(`[TaskQueue] Initialized with ${this.queue.length} pending tasks`);
        
        // Start processing loop
        this.startProcessing();
    }

    async enqueue(task, options = {}) {
        const queueItem = {
            id: `${task.id}_${Date.now()}`,
            task: task,
            priority: options.priority || task.priority || 'normal',
            enqueuedAt: new Date(),
            retryCount: 0,
            options: options
        };

        // Insert based on priority
        if (queueItem.priority === 'high') {
            this.queue.unshift(queueItem);
        } else if (queueItem.priority === 'low') {
            this.queue.push(queueItem);
        } else {
            // Find middle position
            const insertIndex = this.queue.findIndex(item => item.priority === 'low');
            if (insertIndex === -1) {
                this.queue.push(queueItem);
            } else {
                this.queue.splice(insertIndex, 0, queueItem);
            }
        }

        // Save to storage
        await this.storage.saveQueueState(this.queue);

        console.log(`[TaskQueue] Enqueued task: ${task.name} (Priority: ${queueItem.priority})`);

        // Trigger processing
        this.emit('task:enqueued', queueItem);
        
        return queueItem.id;
    }

    startProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.processLoop();
    }

    async processLoop() {
        while (this.isProcessing) {
            await this.delay(100);
            
            // Check if we can start more tasks
            while (
                this.queue.length > 0 && 
                this.runningTasks.size < this.maxConcurrent
            ) {
                const item = this.queue.shift();
                await this.executeQueueItem(item);
            }
        }
    }

    async executeQueueItem(item) {
        const { task, options } = item;
        
        this.runningTasks.set(item.id, item);
        console.log(`[TaskQueue] Executing: ${task.name} (${item.id})`);

        try {
            // Execute based on task type
            let result;
            
            switch (task.taskType) {
                case 'ai-prompt':
                    result = await this.executeAIPrompt(task);
                    break;
                case 'web-scrape':
                    result = await this.executeWebScrape(task);
                    break;
                case 'pdf-generate':
                    result = await this.executePDFGenerate(task);
                    break;
                case 'shell':
                    result = await this.executeShell(task);
                    break;
                case 'workflow':
                    result = await this.executeWorkflow(task);
                    break;
                case 'daily-brief':
                    result = await this.executeDailyBrief(task);
                    break;
                case 'open-url':
                    result = await this.executeOpenURL(task);
                    break;
                default:
                    throw new Error(`Unknown task type: ${task.taskType}`);
            }

            // Success
            console.log(`[TaskQueue] Task completed: ${task.name}`);
            this.emit('task:completed', task, result);
            
            // Clean up
            this.runningTasks.delete(item.id);
            await this.storage.saveQueueState(this.queue);

            return result;

        } catch (error) {
            console.error(`[TaskQueue] Task failed: ${task.name}`, error);

            // Handle retry
            if (item.retryCount < (task.maxRetries || 3)) {
                item.retryCount++;
                const delay = this.calculateRetryDelay(item.retryCount);
                
                console.log(`[TaskQueue] Scheduling retry ${item.retryCount} in ${delay}ms`);
                
                setTimeout(() => {
                    this.queue.unshift(item);
                }, delay);
            } else {
                this.emit('task:failed', task, error);
            }

            this.runningTasks.delete(item.id);
            await this.storage.saveQueueState(this.queue);
        }
    }

    async executeAIPrompt(task) {
        const { config } = task;
        const { OllamaManager } = require('./ollama-manager');
        const ollama = new OllamaManager();

        // Determine provider and call appropriate AI
        const model = config.model || { provider: 'gemini', model: 'gemini-2.0-flash' };

        let response;
        if (model.provider === 'ollama' || model.provider === 'auto') {
            const isOllamaAvailable = await ollama.checkHealth();
            if (isOllamaAvailable) {
                response = await ollama.generate({
                    model: model.model || '',
                    prompt: config.prompt,
                    options: {
                        temperature: model.temperature,
                        num_predict: model.maxTokens
                    }
                });
            } else {
                // Fallback to Gemini
                response = await this.callGemini(config.prompt, model);
            }
        } else {
            response = await this.callGemini(config.prompt, model);
        }

        // Save result if output path specified
        if (task.output) {
            await this.saveOutput(task, response);
        }

        return { response };
    }

    async executeWebScrape(task) {
        const { config } = task;
        const results = [];

        for (const url of config.urls || []) {
            try {
                const content = await this.fetchURL(url);
                results.push({ url, content, success: true });
            } catch (error) {
                results.push({ url, error: error.message, success: false });
            }
        }

        // Process with AI if configured
        if (config.aiProcess) {
            const processed = await this.executeAIPrompt({
                taskType: 'ai-prompt',
                config: {
                    prompt: `${config.aiProcess.prompt}\n\nContent to process:\n${results.map(r => r.content).join('\n\n')}`,
                    model: config.aiProcess.model
                }
            });
            return { scraped: results, processed: processed.response };
        }

        return { scraped: results };
    }

    async executePDFGenerate(task) {
        const { config } = task;
        
        // Generate PDF using the main process PDF generator
        // This would communicate with the browser process
        const { ipcRenderer } = require('electron');
        
        // For now, create a simple text file as placeholder
        const content = config.content || 'Generated content';
        
        if (task.output) {
            const filename = this.resolveFilename(task.output.filename, 'pdf');
            const filepath = `${task.output.path}/${filename}`;
            
            // Save as markdown/text for now (PDF generation would be done via browser)
            const textPath = filepath.replace('.pdf', '.txt');
            require('fs').writeFileSync(textPath, content);
            
            return { filepath: textPath };
        }

        return { content };
    }

    async executeShell(task) {
        const { config } = task;
        
        return new Promise((resolve, reject) => {
            exec(config.command, {
                timeout: config.timeout || 30000,
                maxBuffer: 10 * 1024 * 1024
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async executeOpenURL(task) {
        const { url, config } = task;
        const targetUrl = url || (config && config.url) || 'https://youtube.com';
        const platform = process.platform;
        let command;
        if (platform === 'darwin') {
            command = `open "${targetUrl}"`;
        } else if (platform === 'win32') {
            command = `start "" "${targetUrl}"`;
        } else {
            command = `xdg-open "${targetUrl}"`;
        }
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, url: targetUrl });
            });
        });
    }

    async executeWorkflow(task) {
        const { config } = task;
        const results = [];

        for (const step of config.steps || []) {
            try {
                let stepResult;

                switch (step.type) {
                    case 'scrape':
                        stepResult = await this.executeWebScrape({ config: step.config });
                        break;
                    case 'ai-process':
                        stepResult = await this.executeAIPrompt({ config: step.config });
                        break;
                    case 'generate-pdf':
                        stepResult = await this.executePDFGenerate({ config: step.config });
                        break;
                    case 'save-file':
                        await this.saveOutput({ output: step.config }, stepResult);
                        break;
                    case 'notify':
                        // Notification would be handled separately
                        break;
                    case 'condition':
                        // Evaluate condition
                        const shouldContinue = this.evaluateCondition(step.config, results);
                        if (!shouldContinue) {
                            console.log('[TaskQueue] Condition not met, stopping workflow');
                            return { results, stopped: true };
                        }
                        break;
                }

                results.push({ step: step.type, result: stepResult });

            } catch (error) {
                console.error(`[TaskQueue] Workflow step failed: ${step.type}`, error);
                
                if (step.onError === 'abort') {
                    throw error;
                }
                // continue for 'continue' or 'retry'
            }
        }

        return { results };
    }

    async executeDailyBrief(task) {
        const { config } = task;
        const sections = [];

        // Weather
        if (config.include?.includes('weather')) {
            try {
                const weather = await this.fetchURL('https://wttr.in/?format=j1');
                sections.push({ type: 'weather', data: weather });
            } catch (e) {
                console.log('[TaskQueue] Weather fetch failed:', e.message);
            }
        }

        // News
        if (config.include?.includes('news')) {
            try {
                const hnNews = await this.fetchURL('https://news.ycombinator.com');
                sections.push({ type: 'news', data: hnNews });
            } catch (e) {
                console.log('[TaskQueue] News fetch failed:', e.message);
            }
        }

        // Generate summary
        const summary = await this.executeAIPrompt({
            taskType: 'ai-prompt',
            config: {
                prompt: `Summarize the following information into a concise daily briefing:\n\n${JSON.stringify(sections)}`,
                model: config.model || { provider: 'gemini' }
            }
        });

        return { sections, summary: summary.response };
    }

    // Utility functions
    async fetchURL(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const timeout = setTimeout(() => reject(new Error('Request timeout')), 30000);

            client.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeout);
                    resolve(data);
                });
            }).on('error', err => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async callGemini(prompt, model) {
        // Placeholder - actual implementation would use Gemini API
        console.log('[TaskQueue] Calling Gemini API...');
        return { response: `Processed: ${prompt.substring(0, 100)}...` };
    }

    async saveOutput(task, content) {
        const fs = require('fs');
        const path = require('path');

        const filename = this.resolveFilename(task.output.filename, 'txt');
        const filepath = path.join(task.output.path, filename);

        // Ensure directory exists
        fs.mkdirSync(task.output.path, { recursive: true });

        // Write file
        if (typeof content === 'string') {
            fs.writeFileSync(filepath, content);
        } else {
            fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
        }

        console.log(`[TaskQueue] Saved output to: ${filepath}`);
        return filepath;
    }

    resolveFilename(template, defaultExt) {
        if (!template) {
            return `output_${Date.now()}.${defaultExt}`;
        }

        return template
            .replace('{date}', new Date().toISOString().split('T')[0])
            .replace('{time}', new Date().toTimeString().split(' ')[0].replace(/:/g, '-'))
            .replace('{timestamp}', Date.now().toString());
    }

    evaluateCondition(config, results) {
        if (!config.expression) return true;

        try {
            const lastResult = results[results.length - 1];
            const expr = config.expression.trim();

            const safeOperators = [
                { re: /^results\.length\s*(>=?|<=?|==|!=)\s*(\d+)$/, fn: (m) => {
                    const op = m[1]; const val = parseInt(m[2]);
                    return applyComparison(results.length, op, val);
                }},
                { re: /^lastResult\.(\w+)\s*(>=?|<=?|==|!=)\s*(.+)$/, fn: (m) => {
                    const prop = m[1]; const op = m[2]; const val = parseValue(m[3]);
                    return applyComparison(lastResult?.[prop], op, val);
                }},
                { re: /^results\.length\s*(>=?|<=?|==|!=)\s*(\d+)\s*(&&|\|\|)\s*results\.length\s*(>=?|<=?|==|!=)\s*(\d+)$/, fn: (m) => {
                    const left = applyComparison(results.length, m[1], parseInt(m[2]));
                    const right = applyComparison(results.length, m[4], parseInt(m[5]));
                    return m[3] === '&&' ? (left && right) : (left || right);
                }},
            ];

            for (const { re, fn } of safeOperators) {
                const match = expr.match(re);
                if (match) return fn(match);
            }

            console.warn(`[TaskQueue] Unsafe condition expression blocked: "${expr}"`);
            return true;
        } catch {
            return true;
        }
    }

    calculateRetryDelay(attempt) {
        const baseDelay = 5000;
        const multiplier = 2;
        return Math.min(baseDelay * Math.pow(multiplier, attempt - 1), 60000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            queueLength: this.queue.length,
            runningTasks: this.runningTasks.size,
            maxConcurrent: this.maxConcurrent,
            running: Array.from(this.runningTasks.keys())
        };
    }
}

module.exports = { TaskQueue };
