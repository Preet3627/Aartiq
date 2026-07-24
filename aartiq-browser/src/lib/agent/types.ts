export type AgentRole = 'planner' | 'navigator';

export interface AgentState {
  role: AgentRole;
  status: 'idle' | 'planning' | 'executing' | 'evaluating' | 'finished' | 'error';
  currentStep: number;
  totalSteps: number;
  lastOutput?: string;
}

export interface PlanStep {
  id: string;
  index: number;
  description: string;
  actionType: string;
  target: string;
  reasoning: string;
  expectedOutcome: string;
  completionCriteria: string[];
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  createdAt: number;
  context: {
    url?: string;
    domain?: string;
    pageContent?: string;
    priorActions?: string[];
  };
}

export interface ActionResult {
  stepId: string;
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface CompletionCheck {
  complete: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  missingSteps?: string[];
}
