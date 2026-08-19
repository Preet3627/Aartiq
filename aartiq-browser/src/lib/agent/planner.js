"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Planner = void 0;
const DEFAULT_OPTIONS = {
    planningInterval: 3,
    maxStepsPerPlan: 10,
};
class Planner {
    constructor(parsePlan, options = {}) {
        this.currentPlan = null;
        this.stepCounter = 0;
        this.planCount = 0;
        this.parsePlan = parsePlan;
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    getCurrentPlan() {
        return this.currentPlan;
    }
    getStepCount() {
        return this.stepCounter;
    }
    getPlanCount() {
        return this.planCount;
    }
    shouldReplan() {
        if (!this.currentPlan)
            return true;
        if (this.stepCounter >= this.currentPlan.steps.length)
            return true;
        return this.stepCounter > 0
            && this.stepCounter % this.options.planningInterval === 0;
    }
    async createPlan(goal, context) {
        const plan = await this.parsePlan(goal, context);
        this.currentPlan = plan;
        this.stepCounter = 0;
        this.planCount++;
        return plan;
    }
    currentStep() {
        if (!this.currentPlan)
            return null;
        if (this.stepCounter >= this.currentPlan.steps.length)
            return null;
        return this.currentPlan.steps[this.stepCounter];
    }
    advanceStep() {
        this.stepCounter++;
    }
    checkCompletion(finalAnswerLength, browserState) {
        const plan = this.currentPlan;
        if (!plan) {
            return {
                complete: false,
                confidence: 'low',
                reason: 'No plan exists',
            };
        }
        const reasons = [];
        let score = 0;
        // Check if all steps were executed
        if (this.stepCounter >= plan.steps.length) {
            score += 3;
        }
        else {
            reasons.push(`${plan.steps.length - this.stepCounter} steps not yet executed`);
        }
        // Check if there's meaningful output
        if (finalAnswerLength > 100) {
            score += 2;
        }
        else if (finalAnswerLength > 20) {
            score += 1;
        }
        else {
            reasons.push('Final answer is too short');
        }
        // Check domain match — did we end up on a relevant domain?
        if (browserState?.domain && plan.context.domain) {
            const planDomain = plan.context.domain.toLowerCase();
            const currDomain = browserState.domain.toLowerCase();
            if (currDomain.includes(planDomain) || planDomain.includes(currDomain)) {
                score += 2;
            }
            else {
                reasons.push(`Browser is on "${currDomain}", expected "${planDomain}"`);
            }
        }
        const maxScore = 7;
        const ratio = score / maxScore;
        if (ratio >= 0.8) {
            return {
                complete: true,
                confidence: 'high',
                reason: `Plan completed successfully (score ${score}/${maxScore})`,
            };
        }
        if (ratio >= 0.5) {
            return {
                complete: true,
                confidence: 'medium',
                reason: `Plan partially completed (score ${score}/${maxScore})`,
                missingSteps: reasons,
            };
        }
        return {
            complete: false,
            confidence: 'low',
            reason: `Plan incomplete (score ${score}/${maxScore}): ${reasons.join('; ')}`,
            missingSteps: reasons,
        };
    }
    reset() {
        this.currentPlan = null;
        this.stepCounter = 0;
    }
}
exports.Planner = Planner;
