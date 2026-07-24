/**
 * Sleep Handler — handles system sleep/wake events with task-specific
 * catch-up logic, catch-up limits, and notifications.
 *
 * Each task can configure catch-up behavior:
 *   catchUp: true       → always catch up missed executions
 *   catchUp: false      → never catch up
 *   catchUp: 'once'     → catch up at most 1 execution per sleep cycle
 */

const { powerMonitor } = require('electron');

const NOTIFICATION_KEY = 'aartiq_sleep_catchup_events';

class SleepHandler {
    constructor(taskScheduler) {
        this.taskScheduler = taskScheduler;
        this.lastSuspendTime = null;
        this.suspendDuration = 0;
        this.wasRunning = false;
        this.isInitialized = false;
        this.suspendedTasksByDomain = new Map(); // catch-up tracking
        this.catchUpExecuted = new Set(); // tracks 'once' tasks
    }

    initialize() {
        powerMonitor.on('suspend', () => { try { this.handleSuspend(); } catch (e) { console.error('[SleepHandler] suspend error:', e); } });
        powerMonitor.on('resume', () => { this.handleResume().catch(e => console.error('[SleepHandler] resume error:', e)); });
        powerMonitor.on('on-ac', () => this.handlePowerChange(true));
        powerMonitor.on('on-battery', () => this.handlePowerChange(false));
        powerMonitor.on('lock-screen', () => this.handleScreenLock());
        powerMonitor.on('unlock-screen', () => this.handleScreenUnlock());

        this.isInitialized = true;
        console.log('[SleepHandler] Initialized');
    }

    handleSuspend() {
        console.log('[SleepHandler] System suspending...');
        this.lastSuspendTime = Date.now();
        this.wasRunning = this.taskScheduler?.isRunning || false;

        if (this.taskScheduler) {
            this.taskScheduler.onSuspend();
        }
    }

    async handleResume() {
        console.log('[SleepHandler] System resuming...');

        if (this.lastSuspendTime) {
            this.suspendDuration = Date.now() - this.lastSuspendTime;
            console.log(`[SleepHandler] Suspended for ${this.suspendDuration}ms (${Math.round(this.suspendDuration / 60000)} minutes)`);
        }

        await this.delay(2000);

        if (this.taskScheduler) {
            const catchUpResults = await this.taskScheduler.onResume();

            // Check for catch-up results and notify
            if (catchUpResults && catchUpResults.caughtUp > 0) {
                this.notifyCatchUp(catchUpResults);
            }
        }

        this.logWakeEvent();
    }

    /**
     * Notify about tasks that were caught up after sleep.
     */
    notifyCatchUp(results) {
        try {
            const events = [];

            for (const taskName of results.caughtUpTasks || []) {
                events.push({
                    taskName,
                    status: 'missed',
                    timestamp: Date.now(),
                    catchUpType: 'sleep',
                    suspendDurationMinutes: Math.round(this.suspendDuration / 60000),
                });
            }

            if (events.length > 0) {
                // Store for frontend to read
                const existing = this.loadCatchUpEvents();
                const updated = [...events, ...existing].slice(0, 50);
                this.saveCatchUpEvents(updated);

                console.log(`[SleepHandler] ${events.length} task(s) caught up after sleep`);
            }
        } catch (e) {
            console.error('[SleepHandler] notifyCatchUp error:', e);
        }
    }

    loadCatchUpEvents() {
        try {
            const raw = localStorage ? localStorage.getItem(NOTIFICATION_KEY) : null;
            if (raw) return JSON.parse(raw);
            return [];
        } catch {
            return [];
        }
    }

    saveCatchUpEvents(events) {
        try {
            if (localStorage) {
                localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(events));
            }
        } catch {
            // Ignore storage errors
        }
    }

    handlePowerChange(isAC) {
        console.log(`[SleepHandler] Power source changed: ${isAC ? 'AC (plugged in)' : 'Battery'}`);
        if (!isAC) {
            console.log('[SleepHandler] Running on battery — consider pausing heavy tasks');
        }
    }

    handleScreenLock() {
        console.log('[SleepHandler] Screen locked');
    }

    handleScreenUnlock() {
        console.log('[SleepHandler] Screen unlocked');
    }

    logWakeEvent() {
        const event = {
            type: 'wake',
            timestamp: new Date().toISOString(),
            suspendDuration: this.suspendDuration,
            tasksAffected: this.calculateAffectedTasks(),
        };
        console.log('[SleepHandler] Wake event logged:', event);
    }

    calculateAffectedTasks() {
        if (!this.taskScheduler || !this.lastSuspendTime) return 0;
        const tasks = this.taskScheduler.scheduledTasks || new Map();
        return tasks.size;
    }

    getStatus() {
        return {
            lastSuspendTime: this.lastSuspendTime,
            suspendDuration: this.suspendDuration,
            wasRunning: this.wasRunning,
            isInitialized: this.isInitialized,
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { SleepHandler };
