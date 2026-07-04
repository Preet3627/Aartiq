/**
 * IPC Service
 * 
 * Handles communication between the background service and the main browser app.
 * Also handles communication with mobile devices via WiFi Sync.
 */

const { ipcMain } = require('electron');
const { EventEmitter } = require('events');

class IPCHandler extends EventEmitter {
    constructor(taskScheduler, taskQueue, storageManager, mobileNotifier) {
        super();
        this.taskScheduler = taskScheduler;
        this.taskQueue = taskQueue;
        this.storage = storageManager;
        this.mobileNotifier = mobileNotifier;
    }

    initialize() {
        this.setupTaskHandlers();
        this.setupSyncHandlers();
        this.setupServiceHandlers();
        
        console.log('[IPC] Service handlers initialized');
    }

    // Task management handlers
    setupTaskHandlers() {
        // Get all tasks
        ipcMain.handle('automation:get-tasks', async () => {
            return await this.storage.getAllTasks();
        });

        // Get single task
        ipcMain.handle('automation:get-task', async (event, taskId) => {
            return await this.storage.getTask(taskId);
        });

        // Create new task
        ipcMain.handle('automation:create-task', async (event, taskData) => {
            const task = {
                id: this.generateId(),
                ...taskData,
                enabled: true,
                runCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.storage.saveTask(task);
            await this.taskScheduler.scheduleTask(task);

            // Notify mobile
            this.mobileNotifier.notifyTaskScheduled(task);

            return task;
        });

        // Update task
        ipcMain.handle('automation:update-task', async (event, taskId, updates) => {
            const task = await this.storage.getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }

            const updatedTask = {
                ...task,
                ...updates,
                updatedAt: new Date()
            };

            await this.storage.saveTask(updatedTask);

            // Reschedule if trigger changed
            if (updates.trigger || updates.enabled !== undefined) {
                if (updatedTask.enabled) {
                    await this.taskScheduler.scheduleTask(updatedTask);
                } else {
                    await this.taskScheduler.unscheduleTask(taskId);
                }
            }

            return updatedTask;
        });

        // Delete task
        ipcMain.handle('automation:delete-task', async (event, taskId) => {
            await this.taskScheduler.unscheduleTask(taskId);
            await this.storage.deleteTask(taskId);
            return { success: true };
        });

        // Toggle task enabled/disabled
        ipcMain.handle('automation:toggle-task', async (event, taskId) => {
            await this.taskScheduler.toggleTask(taskId);
            const task = await this.storage.getTask(taskId);
            return task;
        });

        // Force run task immediately
        ipcMain.handle('automation:run-task', async (event, taskId) => {
            const task = await this.storage.getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }

            await this.taskScheduler.executeTask(task, { force: true });
            return { success: true, taskId };
        });

        // Get task logs
        ipcMain.handle('automation:get-logs', async (event, date) => {
            return await this.storage.getLogs(date);
        });

        // Get task results
        ipcMain.handle('automation:get-results', async (event, taskId) => {
            return await this.storage.getResults(taskId);
        });
    }

    // Sync handlers for mobile
    setupSyncHandlers() {
        // Task sync request from mobile
        ipcMain.handle('sync:request-tasks', async () => {
            const tasks = await this.storage.getAllTasks();
            this.mobileNotifier.syncTasks(tasks);
            return tasks;
        });

        // Mobile requests task force run
        ipcMain.on('sync:run-task', async (event, taskId) => {
            try {
                const task = await this.storage.getTask(taskId);
                if (task) {
                    await this.taskScheduler.executeTask(task, { force: true });
                    event.reply('sync:task-run-started', { taskId, success: true });
                } else {
                    event.reply('sync:task-run-started', { taskId, success: false, error: 'Task not found' });
                }
            } catch (error) {
                event.reply('sync:task-run-started', { taskId, success: false, error: error.message });
            }
        });

        // Mobile creates task
        ipcMain.handle('sync:create-task', async (event, taskData) => {
            const task = {
                id: this.generateId(),
                ...taskData,
                enabled: true,
                runCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.storage.saveTask(task);
            await this.taskScheduler.scheduleTask(task);

            // Broadcast to all mobile devices
            this.mobileNotifier.broadcast({
                type: 'task-created',
                task
            });

            return task;
        });

        // Mobile updates task
        ipcMain.handle('sync:update-task', async (event, taskId, updates) => {
            const task = await this.storage.getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }

            const updatedTask = {
                ...task,
                ...updates,
                updatedAt: new Date()
            };

            await this.storage.saveTask(updatedTask);

            if (updatedTask.enabled) {
                await this.taskScheduler.scheduleTask(updatedTask);
            } else {
                await this.taskScheduler.unscheduleTask(taskId);
            }

            this.mobileNotifier.broadcast({
                type: 'task-updated',
                task: updatedTask
            });

            return updatedTask;
        });

        // Mobile deletes task
        ipcMain.handle('sync:delete-task', async (event, taskId) => {
            await this.taskScheduler.unscheduleTask(taskId);
            await this.storage.deleteTask(taskId);
            
            this.mobileNotifier.broadcast({
                type: 'task-deleted',
                taskId
            });

            return { success: true };
        });
    }

    // Service-level handlers
    setupServiceHandlers() {
        // Get service status
        ipcMain.handle('service:status', () => {
            return {
                running: true,
                uptime: process.uptime(),
                scheduler: this.taskScheduler?.getStatus() || {},
                queue: this.taskQueue?.getStatus() || {},
                storage: this.storage?.getInfo() || {},
                mobileConnections: this.mobileNotifier?.getConnectionCount() || 0,
                sleepHandler: this.sleepHandler?.getStatus() || {}
            };
        });

        // Pause all tasks
        ipcMain.handle('service:pause', () => {
            this.taskScheduler?.pauseAll();
            return { success: true };
        });

        // Resume all tasks
        ipcMain.handle('service:resume', () => {
            this.taskScheduler?.resumeAll();
            return { success: true };
        });

        // Restart service
        ipcMain.handle('service:restart', async () => {
            this.taskScheduler?.stop();
            await this.taskScheduler?.initialize();
            await this.taskScheduler?.start();
            return { success: true };
        });

        // Get storage info
        ipcMain.handle('service:storage-info', () => {
            return this.storage?.getInfo() || {};
        });

        // Clear logs
        ipcMain.handle('service:clear-logs', async () => {
            await this.storage.cleanup();
            return { success: true };
        });
    }

    // Utility
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    // Cleanup
    cleanup() {
        ipcMain.removeHandler('automation:get-tasks');
        ipcMain.removeHandler('automation:get-task');
        ipcMain.removeHandler('automation:create-task');
        ipcMain.removeHandler('automation:update-task');
        ipcMain.removeHandler('automation:delete-task');
        ipcMain.removeHandler('automation:toggle-task');
        ipcMain.removeHandler('automation:run-task');
        ipcMain.removeHandler('automation:get-logs');
        ipcMain.removeHandler('automation:get-results');
        ipcMain.removeHandler('sync:request-tasks');
        ipcMain.removeHandler('sync:create-task');
        ipcMain.removeHandler('sync:update-task');
        ipcMain.removeHandler('sync:delete-task');
        ipcMain.removeHandler('service:status');
        ipcMain.removeHandler('service:pause');
        ipcMain.removeHandler('service:resume');
        ipcMain.removeHandler('service:restart');
        ipcMain.removeHandler('service:storage-info');
        ipcMain.removeHandler('service:clear-logs');
    }
}

module.exports = { IPCHandler };
