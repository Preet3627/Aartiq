/**
 * Task Scheduler
 * 
 * Manages scheduled task execution using cron expressions.
 * Handles task timing, catch-up after sleep, and stagger logic.
 */

const cron = require('node-cron');
const { EventEmitter } = require('events');

class TaskScheduler extends EventEmitter {
    constructor(taskQueue, storageManager) {
        super();
        this.taskQueue = taskQueue;
        this.storage = storageManager;
        this.scheduledTasks = new Map(); // taskId -> cronJob
        this.checkInterval = null;
        this.isRunning = false;
        this.isPaused = false;
        this.lastCheckTime = Date.now();
    }

    async initialize() {
        // Load all tasks from storage
        const tasks = await this.storage.getAllTasks();
        
        for (const task of tasks) {
            if (task.enabled) {
                await this.scheduleTask(task);
            }
        }
        
        // Start periodic check (every minute)
        this.checkInterval = setInterval(() => this.checkMissedTasks(), 60000);
        
        console.log(`[Scheduler] Initialized with ${tasks.filter(t => t.enabled).length} active tasks`);
    }

    async start() {
        this.isRunning = true;
        console.log('[Scheduler] Started');
    }

    stop() {
        this.isRunning = false;
        
        // Cancel all scheduled jobs
        for (const [taskId, job] of this.scheduledTasks) {
            job.stop();
        }
        this.scheduledTasks.clear();
        
        // Clear check interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        console.log('[Scheduler] Stopped');
    }

    async scheduleTask(task) {
        if (!task.enabled) {
            console.log(`[Scheduler] Task ${task.name} is disabled, skipping`);
            return;
        }

        // Validate trigger configuration
        if (!task.trigger || !task.trigger.type) {
            console.error(`[Scheduler] Task ${task.name} has invalid trigger config`);
            return;
        }

        try {
            // Cancel existing schedule if any
            await this.unscheduleTask(task.id);

            let cronExpression;
            
            switch (task.trigger.type) {
                case 'cron':
                    cronExpression = task.trigger.schedule;
                    break;
                case 'once':
                    // Convert single datetime to one-time cron
                    cronExpression = this.datetimeToCron(task.trigger.datetime);
                    break;
                case 'interval':
                    // Convert interval to cron (approximation)
                    cronExpression = this.intervalToCron(task.trigger.intervalMs);
                    break;
                default:
                    console.error(`[Scheduler] Unknown trigger type: ${task.trigger.type}`);
                    return;
            }

            if (!cronExpression) {
                console.error(`[Scheduler] Failed to generate cron expression for task ${task.name}`);
                return;
            }

            // Validate cron expression
            if (!cron.validate(cronExpression)) {
                console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
                return;
            }

            // Create cron job
            const job = cron.schedule(cronExpression, async () => {
                if (!this.isPaused) {
                    await this.executeTask(task);
                }
            }, {
                scheduled: true,
                timezone: task.timezone || 'UTC'
            });

            // Store reference
            this.scheduledTasks.set(task.id, job);

            // Calculate next run time
            task.nextRun = this.getNextRunTime(cronExpression, task.timezone);
            await this.storage.saveTask(task);

            console.log(`[Scheduler] Scheduled task "${task.name}" with cron: ${cronExpression}`);
            
        } catch (error) {
            console.error(`[Scheduler] Failed to schedule task ${task.name}:`, error);
        }
    }

    async unscheduleTask(taskId) {
        const existingJob = this.scheduledTasks.get(taskId);
        if (existingJob) {
            existingJob.stop();
            this.scheduledTasks.delete(taskId);
            console.log(`[Scheduler] Unscheduled task ${taskId}`);
        }
    }

    async executeTask(task, options = {}) {
        console.log(`[Scheduler] Executing task: ${task.name} (${task.id})`);
        
        const startTime = Date.now();
        
        try {
            // Emit task started event
            this.emit('task:due', task);

            // Calculate and apply stagger if configured
            if (task.staggerMinutes && task.staggerMinutes > 0) {
                const staggerMs = task.staggerMinutes * 60 * 1000;
                await this.delay(staggerMs);
            }

            // Add to task queue for execution
            await this.taskQueue.enqueue(task);

            // Update task stats
            task.lastRun = new Date();
            task.lastStatus = 'success';
            task.lastError = null;
            task.runCount = (task.runCount || 0) + 1;
            
            // Recalculate next run
            if (task.trigger.type === 'once') {
                task.enabled = false; // Disable one-time tasks after execution
            } else {
                const cronExpr = task.trigger.type === 'cron' 
                    ? task.trigger.schedule 
                    : this.intervalToCron(task.trigger.intervalMs);
                task.nextRun = this.getNextRunTime(cronExpr, task.timezone);
            }

            await this.storage.saveTask(task);
            
            const duration = Date.now() - startTime;
            console.log(`[Scheduler] Task "${task.name}" completed in ${duration}ms`);

            this.emit('task:completed', task, { success: true, duration });

        } catch (error) {
            console.error(`[Scheduler] Task "${task.name}" failed:`, error);
            
            task.lastStatus = 'failed';
            task.lastError = error.message;
            await this.storage.saveTask(task);

            // Handle retry
            if (task.maxRetries > 0) {
                const retryDelay = this.calculateRetryDelay(task);
                console.log(`[Scheduler] Retrying task "${task.name}" in ${retryDelay}ms`);
                setTimeout(() => this.executeTask(task), retryDelay);
            }

            this.emit('task:failed', task, error);
        }
    }

    calculateRetryDelay(task) {
        const baseDelay = 5000; // 5 seconds
        const multiplier = 1.5;
        const maxDelay = 120000; // 2 minutes
        const attemptCount = task.runCount || 0;
        return Math.min(baseDelay * Math.pow(multiplier, attemptCount), maxDelay);
    }

    checkMissedTasks() {
        try {
            if (this.isPaused || !this.isRunning) return;

            const now = Date.now();
            const tasks = this.storage.getAllTasks();

            for (const task of tasks) {
                if (!task.enabled) continue;

                if (task.nextRun && new Date(task.nextRun).getTime() < now - 60000) {
                    // Task is more than 1 minute overdue
                    console.log(`[Scheduler] Detected missed task: ${task.name}`);
                    this.emit('task:missed', task);
                }
            }

            this.lastCheckTime = now;
        } catch (e) {
            console.error('[Scheduler] checkMissedTasks error:', e);
        }
    }

    async onSuspend() {
        console.log('[Scheduler] System suspending, saving state');
        this.lastCheckTime = Date.now();

        // Reset catch-up tracking for new sleep cycle
        this.catchUpExecuted = new Set();

        const tasks = await this.storage.getAllTasks();
        for (const task of tasks) {
            if (this.scheduledTasks.has(task.id)) {
                task.lastActiveTime = Date.now();
                await this.storage.saveTask(task);
            }
        }
    }

    async onResume() {
        console.log('[Scheduler] System resuming, checking missed tasks');

        await this.delay(2000);

        const tasks = await this.storage.getAllTasks();
        const now = Date.now();
        const caughtUpTasks = [];
        this.catchUpExecuted = this.catchUpExecuted || new Set();

        for (const task of tasks) {
            if (!task.enabled) continue;

            const catchUpPolicy = task.catchUp !== undefined ? task.catchUp : 'once';

            // Skip if catch-up is disabled for this task
            if (catchUpPolicy === false) {
                console.log(`[Scheduler] Skipping catch-up for task "${task.name}": catchUp=false`);
                continue;
            }

            // Skip if already caught up once this cycle (for 'once' policy)
            if (catchUpPolicy === 'once') {
                const taskKey = `catchup_${task.id}`;
                if (this.catchUpExecuted.has(taskKey)) {
                    console.log(`[Scheduler] Skipping catch-up for task "${task.name}": already caught up once`);
                    continue;
                }
            }

            if (task.nextRun) {
                const nextRunTime = new Date(task.nextRun).getTime();

                if (nextRunTime < this.lastCheckTime && nextRunTime > (task.lastActiveTime || 0)) {
                    console.log(`[Scheduler] Catching up missed task: ${task.name} (catchUp=${catchUpPolicy})`);
                    await this.executeTask(task, { catchUp: true });
                    caughtUpTasks.push(task.name);

                    // Track 'once' tasks
                    if (catchUpPolicy === 'once') {
                        this.catchUpExecuted.add(`catchup_${task.id}`);
                    }
                }
            }
        }

        return {
            caughtUp: caughtUpTasks.length,
            caughtUpTasks,
        };
    }

    async toggleTask(taskId) {
        const task = await this.storage.getTask(taskId);
        if (!task) {
            console.error(`[Scheduler] Task not found: ${taskId}`);
            return;
        }

        task.enabled = !task.enabled;
        task.updatedAt = new Date();

        if (task.enabled) {
            await this.scheduleTask(task);
        } else {
            await this.unscheduleTask(taskId);
        }

        await this.storage.saveTask(task);
        console.log(`[Scheduler] Task "${task.name}" ${task.enabled ? 'enabled' : 'disabled'}`);
    }

    pauseAll() {
        this.isPaused = true;
        console.log('[Scheduler] All tasks paused');
    }

    resumeAll() {
        this.isPaused = false;
        console.log('[Scheduler] All tasks resumed');
    }

    async rescheduleAll() {
        const tasks = await this.storage.getAllTasks();
        for (const task of tasks) {
            await this.unscheduleTask(task.id);
            if (task.enabled) {
                await this.scheduleTask(task);
            }
        }
        console.log('[Scheduler] All tasks rescheduled');
    }

    // Utility functions
    datetimeToCron(datetime) {
        const date = new Date(datetime);
        if (isNaN(date.getTime())) return null;

        const minute = date.getMinutes();
        const hour = date.getHours();
        const day = date.getDate();
        const month = date.getMonth() + 1;
        
        return `${minute} ${hour} ${day} ${month} *`;
    }

    intervalToCron(intervalMs) {
        const seconds = Math.floor(intervalMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours >= 1) {
            return `0 */${hours} * * * *`;
        } else if (minutes >= 1) {
            return `*/${minutes} * * * *`;
        } else {
            return `*/${seconds} * * * * *`;
        }
    }

    getNextRunTime(cronExpression, timezone) {
        try {
            // Simple next run calculation (for display purposes)
            // node-cron doesn't expose next run time directly
            const parts = cronExpression.split(' ');
            if (parts.length !== 5) return null;

            const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
            const now = new Date();

            // Create a date for next occurrence
            let next = new Date(now);
            
            if (minute.startsWith('*/')) {
                const interval = parseInt(minute.substring(2));
                next.setMinutes(Math.ceil(next.getMinutes() / interval) * interval);
                next.setSeconds(0);
            } else {
                next.setMinutes(parseInt(minute));
                next.setHours(parseInt(hour));
                next.setSeconds(0);

                if (next <= now) {
                    if (hour !== '*') {
                        next.setDate(next.getDate() + 1);
                    }
                }
            }

            return next;
        } catch {
            return null;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            activeTaskCount: this.scheduledTasks.size,
            scheduledTasks: Array.from(this.scheduledTasks.keys())
        };
    }
}

module.exports = { TaskScheduler };
