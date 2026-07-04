/**
 * Notification Manager
 * 
 * Handles desktop notifications for task events.
 */

const { Notification, nativeImage, app } = require('electron');

class NotificationManager {
    constructor() {
        this.isInitialized = false;
        this.notificationsEnabled = true;
        this.defaults = {
            silent: false,
            timeout: 5000
        };
    }

    initialize() {
        this.isInitialized = true;
        console.log('[Notifications] Manager initialized');
    }

    show(options) {
        if (!this.isInitialized || !this.notificationsEnabled) {
            return;
        }

        // Check if notifications are supported
        if (!Notification.isSupported()) {
            console.warn('[Notifications] Notifications not supported on this system');
            return;
        }

        const notification = new Notification({
            title: options.title || 'Aartiq',
            body: options.body || '',
            silent: options.silent ?? this.defaults.silent,
            urgency: options.urgency || 'normal',
            timeoutType: options.timeoutType || 'default',
            actions: options.actions || [],
            data: options.data
        });

        // Handle click
        if (options.onClick) {
            notification.on('click', () => options.onClick());
        }

        // Handle action
        if (options.onAction) {
            notification.on('action', (event, index) => {
                options.onAction(index);
            });
        }

        // Handle close
        notification.on('close', () => {
            if (options.onClose) {
                options.onClose();
            }
        });

        notification.show();

        return notification;
    }

    // Task-specific notifications
    taskStarted(task) {
        return this.show({
            title: '⏰ Task Starting',
            body: task.name,
            silent: true,
            data: { type: 'task-started', taskId: task.id }
        });
    }

    taskCompleted(task, result) {
        return this.show({
            title: '✅ Task Complete',
            body: `${task.name} completed successfully`,
            silent: false,
            urgency: 'low',
            data: { type: 'task-completed', taskId: task.id, result },
            actions: [
                { type: 'button', text: 'Open' },
                { type: 'button', text: 'Dismiss' }
            ],
            onAction: (index) => {
                if (index === 0) {
                    // Open file
                    const { shell } = require('electron');
                    if (result?.filepath) {
                        shell.showItemInFolder(result.filepath);
                    }
                }
            }
        });
    }

    taskFailed(task, error) {
        return this.show({
            title: '❌ Task Failed',
            body: `${task.name} failed: ${error.message}`,
            silent: false,
            urgency: 'critical',
            data: { type: 'task-failed', taskId: task.id, error: error.message }
        });
    }

    taskScheduled(task) {
        return this.show({
            title: '📅 Task Scheduled',
            body: `${task.name} scheduled for ${this.formatSchedule(task)}`,
            silent: true,
            data: { type: 'task-scheduled', taskId: task.id }
        });
    }

    taskMissed(task) {
        return this.show({
            title: '⏰ Missed Task',
            body: `${task.name} was scheduled while system was asleep. Running now...`,
            silent: false,
            data: { type: 'task-missed', taskId: task.id }
        });
    }

    // General notifications
    serviceStarted() {
        return this.show({
            title: '🚀 Aartiq Service',
            body: 'Background automation is running',
            silent: true,
            data: { type: 'service-started' }
        });
    }

    serviceError(error) {
        return this.show({
            title: '⚠️ Service Error',
            body: `Automation service encountered an error: ${error.message}`,
            silent: false,
            urgency: 'critical',
            data: { type: 'service-error', error: error.message }
        });
    }

    lowBattery() {
        return this.show({
            title: '🔋 Low Battery',
            body: 'Consider connecting to power for uninterrupted automation',
            silent: true,
            urgency: 'low',
            data: { type: 'low-battery' }
        });
    }

    // Utility functions
    formatSchedule(task) {
        if (!task.trigger) return 'Unknown';

        switch (task.trigger.type) {
            case 'cron':
                return this.formatCron(task.trigger.schedule);
            case 'once':
                return new Date(task.trigger.datetime).toLocaleString();
            case 'interval':
                return `Every ${this.formatInterval(task.trigger.intervalMs)}`;
            default:
                return 'Unknown';
        }
    }

    formatCron(cronExpression) {
        // Simple cron formatting
        const parts = cronExpression.split(' ');
        if (parts.length !== 5) return cronExpression;

        const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

        // Daily at time
        if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
            return `Daily at ${hour}:${minute.padStart(2, '0')}`;
        }

        // Weekdays at time
        if (dayOfWeek === '1-5') {
            return `Weekdays at ${hour}:${minute.padStart(2, '0')}`;
        }

        // Weekly
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayIndex = parseInt(dayOfWeek);
        if (!isNaN(dayIndex) && dayIndex >= 0 && dayIndex <= 6) {
            return `Every ${days[dayIndex]} at ${hour}:${minute.padStart(2, '0')}`;
        }

        return cronExpression;
    }

    formatInterval(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else {
            return `${seconds} second${seconds > 1 ? 's' : ''}`;
        }
    }

    // Settings
    enable() {
        this.notificationsEnabled = true;
    }

    disable() {
        this.notificationsEnabled = false;
    }

    isEnabled() {
        return this.notificationsEnabled;
    }
}

module.exports = { NotificationManager };
