/**
 * Mobile Notifier
 * 
 * Handles sending notifications and updates to connected mobile devices
 * via WiFi Sync protocol.
 */

const WebSocket = require('ws');
const os = require('os');

class MobileNotifier {
    constructor() {
        this.connections = new Set();
        this.isInitialized = false;
        this.retryInterval = null;
    }

    async initialize() {
        this.isInitialized = true;
        console.log('[MobileNotifier] Initialized');
    }

    // Add a mobile WebSocket connection
    addConnection(ws) {
        this.connections.add(ws);
        console.log(`[MobileNotifier] Added connection. Total: ${this.connections.size}`);

        ws.on('close', () => {
            this.connections.delete(ws);
            console.log(`[MobileNotifier] Connection closed. Total: ${this.connections.size}`);
        });

        ws.on('error', (error) => {
            console.error('[MobileNotifier] Connection error:', error);
            this.connections.delete(ws);
        });
    }

    // Broadcast to all connected mobile devices
    broadcast(message) {
        const payload = JSON.stringify(message);
        
        for (const ws of this.connections) {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(payload);
                } catch (error) {
                    console.error('[MobileNotifier] Send error:', error);
                }
            }
        }
    }

    // Send task notifications
    notifyTaskStarted(task) {
        this.broadcast({
            type: 'task-started',
            taskId: task.id,
            taskName: task.name,
            timestamp: new Date().toISOString()
        });
    }

    notifyTaskCompleted(task, result) {
        this.broadcast({
            type: 'task-completed',
            taskId: task.id,
            taskName: task.name,
            status: 'success',
            result: {
                filepath: result?.filepath,
                preview: result?.response?.substring(0, 200)
            },
            timestamp: new Date().toISOString()
        });
    }

    notifyTaskFailed(task, error) {
        this.broadcast({
            type: 'task-failed',
            taskId: task.id,
            taskName: task.name,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    notifyTaskMissed(task) {
        this.broadcast({
            type: 'task-missed',
            taskId: task.id,
            taskName: task.name,
            message: 'Task was scheduled while system was asleep',
            timestamp: new Date().toISOString()
        });
    }

    notifyTaskScheduled(task) {
        this.broadcast({
            type: 'task-scheduled',
            task: {
                id: task.id,
                name: task.name,
                trigger: task.trigger,
                nextRun: task.nextRun
            },
            timestamp: new Date().toISOString()
        });
    }

    // Sync all tasks to mobile
    syncTasks(tasks) {
        this.broadcast({
            type: 'task-sync-response',
            tasks: tasks.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                taskType: t.taskType,
                trigger: t.trigger,
                enabled: t.enabled,
                nextRun: t.nextRun,
                lastRun: t.lastRun,
                lastStatus: t.lastStatus,
                runCount: t.runCount
            })),
            timestamp: new Date().toISOString()
        });
    }

    // Send PDF file info for mobile to access
    notifyNewFile(fileInfo) {
        this.broadcast({
            type: 'new-file',
            file: {
                name: fileInfo.name,
                path: fileInfo.path,
                url: fileInfo.url,
                size: fileInfo.size,
                type: fileInfo.type
            },
            timestamp: new Date().toISOString()
        });
    }

    // Send service status
    sendStatus() {
        this.broadcast({
            type: 'service-status',
            status: {
                running: true,
                platform: os.platform(),
                hostname: os.hostname(),
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }
        });
    }

    // Close all connections
    closeAll() {
        for (const ws of this.connections) {
            try {
                ws.close();
            } catch (error) {
                // Ignore
            }
        }
        this.connections.clear();
    }

    getConnectionCount() {
        return this.connections.size;
    }
}

module.exports = { MobileNotifier };
