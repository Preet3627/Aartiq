import type { Plan, PlanStep, CompletionCheck } from './types';

// ---------------------------------------------------------------------------
// Planner — breaks down tasks into structured plans
// Runs every N steps (configurable via planningInterval).
// Validates completion using browser state, domain match, and answer length.
// ---------------------------------------------------------------------------

export interface PlannerOptions {
  planningInterval: number;
  maxStepsPerPlan: number;
}

const DEFAULT_OPTIONS: PlannerOptions = {
  planningInterval: 3,
  maxStepsPerPlan: 10,
};

export type PlanParseFn = (goal: string, context: string) => Promise<Plan>;

export class Planner {
  private options: PlannerOptions;
  private currentPlan: Plan | null = null;
  private stepCounter: number = 0;
  private planCount: number = 0;
  private parsePlan: PlanParseFn;

  constructor(
    parsePlan: PlanParseFn,
    options: Partial<PlannerOptions> = {}
  ) {
    this.parsePlan = parsePlan;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  getStepCount(): number {
    return this.stepCounter;
  }

  getPlanCount(): number {
    return this.planCount;
  }

  shouldReplan(): boolean {
    if (!this.currentPlan) return true;
    if (this.stepCounter >= this.currentPlan.steps.length) return true;
    return this.stepCounter > 0
      && this.stepCounter % this.options.planningInterval === 0;
  }

  async createPlan(goal: string, context: string): Promise<Plan> {
    const plan = await this.parsePlan(goal, context);
    this.currentPlan = plan;
    this.stepCounter = 0;
    this.planCount++;
    return plan;
  }

  currentStep(): PlanStep | null {
    if (!this.currentPlan) return null;
    if (this.stepCounter >= this.currentPlan.steps.length) return null;
    return this.currentPlan.steps[this.stepCounter];
  }

  advanceStep(): void {
    this.stepCounter++;
  }

  checkCompletion(
    finalAnswerLength: number,
    browserState?: { url?: string; domain?: string }
  ): CompletionCheck {
    const plan = this.currentPlan;
    if (!plan) {
      return {
        complete: false,
        confidence: 'low',
        reason: 'No plan exists',
      };
    }

    const reasons: string[] = [];
    let score = 0;

    // Check if all steps were executed
    if (this.stepCounter >= plan.steps.length) {
      score += 3;
    } else {
      reasons.push(`${plan.steps.length - this.stepCounter} steps not yet executed`);
    }

    // Check if there's meaningful output
    if (finalAnswerLength > 100) {
      score += 2;
    } else if (finalAnswerLength > 20) {
      score += 1;
    } else {
      reasons.push('Final answer is too short');
    }

    // Check domain match — did we end up on a relevant domain?
    if (browserState?.domain && plan.context.domain) {
      const planDomain = plan.context.domain.toLowerCase();
      const currDomain = browserState.domain.toLowerCase();
      if (currDomain.includes(planDomain) || planDomain.includes(currDomain)) {
        score += 2;
      } else {
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

  reset(): void {
    this.currentPlan = null;
    this.stepCounter = 0;
  }
}
