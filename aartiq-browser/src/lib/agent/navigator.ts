import type { PlanStep, ActionResult, AgentState } from './types';

// ---------------------------------------------------------------------------
// Navigator — executes individual plan steps (DOM actions, shell, etc.)
// ---------------------------------------------------------------------------

export type ActionExecutor = (
  actionType: string,
  target: string,
  params?: Record<string, unknown>
) => Promise<ActionResult>;

export interface NavigatorOptions {
  maxRetriesPerStep: number;
  retryDelayMs: number;
}

const DEFAULT_OPTIONS: NavigatorOptions = {
  maxRetriesPerStep: 2,
  retryDelayMs: 1000,
};

export class Navigator {
  private options: NavigatorOptions;
  private executor: ActionExecutor;
  private state: AgentState;
  private actionHistory: ActionResult[];

  constructor(
    executor: ActionExecutor,
    options: Partial<NavigatorOptions> = {}
  ) {
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

  getState(): AgentState {
    return { ...this.state };
  }

  getHistory(): ActionResult[] {
    return [...this.actionHistory];
  }

  async executeStep(step: PlanStep): Promise<ActionResult> {
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
      } catch (err) {
        const errorResult: ActionResult = {
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

    const failedResult: ActionResult = {
      stepId: step.id,
      success: false,
      error: `Failed after ${this.options.maxRetriesPerStep + 1} attempts`,
      durationMs: 0,
    };
    this.actionHistory.push(failedResult);
    this.state.status = 'error';
    return failedResult;
  }

  async executeSteps(steps: PlanStep[]): Promise<ActionResult[]> {
    this.state.totalSteps = steps.length;
    this.state.currentStep = 0;
    this.actionHistory = [];

    const results: ActionResult[] = [];
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

  reset(): void {
    this.state = {
      role: 'navigator',
      status: 'idle',
      currentStep: 0,
      totalSteps: 0,
    };
    this.actionHistory = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
