/**
 * Storage Manager
 * 
 * Handles persistent storage for tasks, queue state, and logs.
 * Uses electron-store for data persistence.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class StorageManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.tasksFile = path.join(basePath, 'tasks.json');
        this.queueFile = path.join(basePath, 'queue.json');
        this.logsDir = path.join(basePath, 'logs');
        this.resultsDir = path.join(basePath, 'results');
        this.publicDir = path.join(basePath, 'public');
        
        // In-memory cache
        this.tasksCache = new Map();
        this.queueCache = [];
    }

    async initialize() {
        // Create directories if they don't exist
        const dirs = [this.basePath, this.logsDir, this.resultsDir, this.publicDir];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Load existing tasks
        await this.loadTasks();

        console.log(`[Storage] Initialized at: ${this.basePath}`);
    }

    // Tasks
    async loadTasks() {
        try {
            if (fs.existsSync(this.tasksFile)) {
                const data = JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
                for (const task of data.tasks || []) {
                    this.tasksCache.set(task.id, task);
                }
            }
        } catch (error) {
            console.error('[Storage] Failed to load tasks:', error);
        }
    }

    async getAllTasks() {
        return Array.from(this.tasksCache.values());
    }

    async getTask(taskId) {
        return this.tasksCache.get(taskId);
    }

    async saveTask(task) {
        task.updatedAt = new Date();
        this.tasksCache.set(task.id, task);
        await this.persistTasks();
    }

    async deleteTask(taskId) {
        this.tasksCache.delete(taskId);
        await this.persistTasks();
    }

    async persistTasks() {
        try {
            const tasks = Array.from(this.tasksCache.values());
            fs.writeFileSync(this.tasksFile, JSON.stringify({ tasks }, null, 2));
        } catch (error) {
            console.error('[Storage] Failed to persist tasks:', error);
        }
    }

    // Queue state
    async getPendingTasks() {
        try {
            if (fs.existsSync(this.queueFile)) {
                const data = JSON.parse(fs.readFileSync(this.queueFile, 'utf8'));
                this.queueCache = data.queue || [];
                return this.queueCache;
            }
        } catch (error) {
            console.error('[Storage] Failed to load queue:', error);
        }
        return [];
    }

    async saveQueueState(queue) {
        try {
            this.queueCache = queue;
            fs.writeFileSync(this.queueFile, JSON.stringify({ queue }, null, 2));
        } catch (error) {
            console.error('[Storage] Failed to save queue:', error);
        }
    }

    // Logs
    async appendLog(logEntry) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `execution-${date}.json`);
        
        try {
            let logs = [];
            if (fs.existsSync(logFile)) {
                logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
            
            logs.push({
                timestamp: new Date().toISOString(),
                ...logEntry
            });
            
            // Keep only last 7 days of logs
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            logs = logs.filter(log => new Date(log.timestamp) > sevenDaysAgo);
            
            fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('[Storage] Failed to append log:', error);
        }
    }

    async getLogs(date) {
        const logFile = path.join(this.logsDir, `execution-${date || new Date().toISOString().split('T')[0]}.json`);
        
        if (fs.existsSync(logFile)) {
            return JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
        return [];
    }

    // Results
    async saveResult(taskId, result) {
        const date = new Date().toISOString().split('T')[0];
        const resultFile = path.join(this.resultsDir, `${taskId}-${date}.json`);
        
        try {
            fs.writeFileSync(resultFile, JSON.stringify({
                taskId,
                timestamp: new Date().toISOString(),
                result
            }, null, 2));
        } catch (error) {
            console.error('[Storage] Failed to save result:', error);
        }
    }

    async getResults(taskId) {
        const results = [];
        const files = fs.readdirSync(this.resultsDir);
        
        for (const file of files) {
            if (file.startsWith(taskId)) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(this.resultsDir, file), 'utf8'));
                    results.push(data);
                } catch (e) {
                    // Skip invalid files
                }
            }
        }
        
        return results;
    }

    // Settings
    async getSetting(key, defaultValue = null) {
        const settingsFile = path.join(this.basePath, 'settings.json');
        
        try {
            if (fs.existsSync(settingsFile)) {
                const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                return settings[key] !== undefined ? settings[key] : defaultValue;
            }
        } catch (error) {
            console.error('[Storage] Failed to get setting:', error);
        }
        return defaultValue;
    }

    async setSetting(key, value) {
        const settingsFile = path.join(this.basePath, 'settings.json');
        
        try {
            let settings = {};
            if (fs.existsSync(settingsFile)) {
                settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
            
            settings[key] = value;
            fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        } catch (error) {
            console.error('[Storage] Failed to set setting:', error);
        }
    }

    // Model preferences
    async getModelPreferences() {
        return this.getSetting('modelPreferences', {
            defaultProvider: 'gemini',
            ollamaUrl: 'http://localhost:11434',
            preferredModels: {}
        });
    }

    async saveModelPreferences(preferences) {
        await this.setSetting('modelPreferences', preferences);
    }

    // Cleanup
    async cleanup() {
        // Clean up old logs
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        try {
            const files = fs.readdirSync(this.logsDir);
            for (const file of files) {
                if (file.startsWith('execution-')) {
                    const date = file.replace('execution-', '').replace('.json', '');
                    if (new Date(date) < sevenDaysAgo) {
                        fs.unlinkSync(path.join(this.logsDir, file));
                    }
                }
            }
        } catch (error) {
            console.error('[Storage] Cleanup error:', error);
        }
    }

    // Get storage info
    getInfo() {
        return {
            basePath: this.basePath,
            tasksCount: this.tasksCache.size,
            queueLength: this.queueCache.length,
            logsCount: fs.readdirSync(this.logsDir).length,
            resultsCount: fs.readdirSync(this.resultsDir).length
        };
    }
}

module.exports = { StorageManager };
