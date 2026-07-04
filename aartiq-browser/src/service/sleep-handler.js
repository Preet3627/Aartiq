/**
 * Sleep Handler
 * 
 * Handles system sleep/wake events and ensures tasks don't get missed.
 */

const { powerMonitor, app } = require('electron');

class SleepHandler {
    constructor(taskScheduler) {
        this.taskScheduler = taskScheduler;
        this.lastSuspendTime = null;
        this.suspendDuration = 0;
        this.wasRunning = false;
        this.isInitialized = false;
    }

    initialize() {
        // System power events
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
        
        // Save state
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

        // Wait for system to stabilize
        await this.delay(2000);

        // Notify task scheduler of wake
        if (this.taskScheduler) {
            await this.taskScheduler.onResume();
        }

        // Log wake event
        this.logWakeEvent();
    }

    handlePowerChange(isAC) {
        console.log(`[SleepHandler] Power source changed: ${isAC ? 'AC (plugged in)' : 'Battery'}`);
        
        // Could implement battery-saving logic here
        // e.g., pause heavy tasks when on battery
        if (!isAC) {
            console.log('[SleepHandler] Running on battery - consider pausing heavy tasks');
        }
    }

    handleScreenLock() {
        console.log('[SleepHandler] Screen locked');
        // Tasks continue to run, but might want to pause non-critical ones
    }

    handleScreenUnlock() {
        console.log('[SleepHandler] Screen unlocked');
        // Resume any paused tasks
    }

    logWakeEvent() {
        const event = {
            type: 'wake',
            timestamp: new Date().toISOString(),
            suspendDuration: this.suspendDuration,
            tasksAffected: this.calculateAffectedTasks()
        };

        console.log('[SleepHandler] Wake event logged:', event);
    }

    calculateAffectedTasks() {
        // Calculate how many tasks might have been missed
        if (!this.taskScheduler || !this.lastSuspendTime) {
            return 0;
        }

        const now = Date.now();
        const tasks = this.taskScheduler.scheduledTasks || new Map();
        let affected = 0;

        for (const [taskId, job] of tasks) {
            // This is simplified - real implementation would check task schedules
            affected++;
        }

        return affected;
    }

    // Get current status
    getStatus() {
        return {
            lastSuspendTime: this.lastSuspendTime,
            suspendDuration: this.suspendDuration,
            wasRunning: this.wasRunning,
            isInitialized: this.isInitialized
        };
    }

    // Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { SleepHandler };
