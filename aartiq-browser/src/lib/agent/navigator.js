"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Navigator = void 0;
const DEFAULT_OPTIONS = {
    maxRetriesPerStep: 2,
    retryDelayMs: 1000,
};
class Navigator {
    constructor(executor, options = {}) {
        this.executor = executor;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.actionHistory = [];
        this.state = {
            role: 'navigator',
            status: 'idle',
            currentStep: 0,
            totalSteps: 0,
        };
    }
    getState() {
        return { ...this.state };
    }
    getHistory() {
        return [...this.actionHistory];
    }
    async executeStep(step) {
        this.state.currentStep++;
        this.state.status = 'executing';
        for (let attempt = 0; attempt <= this.options.maxRetriesPerStep; attempt++) {
            if (attempt > 0) {
                await this.delay(this.options.retryDelayMs * attempt);
            }
            try {
                const result = await this.executor(step.actionType, step.target, {
                    planStepId: step.id,
                    description: step.description,
                    reasoning: step.reasoning,
                    attempt,
                });
                this.actionHistory.push(result);
                this.state.lastOutput = result.output;
                if (result.success) {
                    this.state.status = 'idle';
                    return result;
                }
            }
            catch (err) {
                const errorResult = {
                    stepId: step.id,
                    success: false,
                    error: err instanceof Error ? err.message : String(err),
                    durationMs: 0,
                };
                if (attempt >= this.options.maxRetriesPerStep) {
                    this.actionHistory.push(errorResult);
                    this.state.status = 'error';
                    return errorResult;
                }
            }
        }
        const failedResult = {
            stepId: step.id,
            success: false,
            error: `Failed after ${this.options.maxRetriesPerStep + 1} attempts`,
            durationMs: 0,
        };
        this.actionHistory.push(failedResult);
        this.state.status = 'error';
        return failedResult;
    }
    async executeSteps(steps) {
        this.state.totalSteps = steps.length;
        this.state.currentStep = 0;
        this.actionHistory = [];
        const results = [];
        for (const step of steps) {
            const result = await this.executeStep(step);
            results.push(result);
            if (!result.success) {
                this.state.status = 'error';
                break;
            }
        }
        if (results.every(r => r.success)) {
            this.state.status = 'finished';
        }
        return results;
    }
    reset() {
        this.state = {
            role: 'navigator',
            status: 'idle',
            currentStep: 0,
            totalSteps: 0,
        };
        this.actionHistory = [];
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.Navigator = Navigator;
