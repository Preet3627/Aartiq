import type { AICommand } from '../components/AICommandQueue';

// ---------------------------------------------------------------------------
// Formal task lifecycle state machine
// Inspired by comet-t's task-runner.ts
// ---------------------------------------------------------------------------

export const TaskStatus = {
  PENDING: 'pending',
  AWAITING_APPROVAL: 'awaiting_approval',
  APPROVED: 'approved',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export type ExtendedCommandStatus =
  | 'idle'
  | 'pending'
  | 'awaiting_permission'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

// ---------------------------------------------------------------------------
// State transition map
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.AWAITING_APPROVAL, TaskStatus.BLOCKED, TaskStatus.CANCELLED],
  [TaskStatus.AWAITING_APPROVAL]: [TaskStatus.APPROVED, TaskStatus.BLOCKED, TaskStatus.CANCELLED, TaskStatus.PENDING],
  [TaskStatus.APPROVED]: [TaskStatus.EXECUTING, TaskStatus.CANCELLED],
  [TaskStatus.EXECUTING]: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.FAILED]: [TaskStatus.PENDING],
  [TaskStatus.BLOCKED]: [TaskStatus.PENDING, TaskStatus.CANCELLED],
  [TaskStatus.CANCELLED]: [],
};

export type TransitionError = {
  from: TaskStatus;
  to: TaskStatus;
  message: string;
};

// ---------------------------------------------------------------------------
// State machine class
// ---------------------------------------------------------------------------

export class TaskLifecycle {
  private currentState: TaskStatus;

  constructor(initialState: TaskStatus = TaskStatus.PENDING) {
    this.currentState = initialState;
  }

  get state(): TaskStatus {
    return this.currentState;
  }

  canTransitionTo(target: TaskStatus): boolean {
    const allowed = TRANSITIONS[this.currentState];
    return allowed?.includes(target) ?? false;
  }

  transitionTo(target: TaskStatus): TransitionError | null {
    if (!this.canTransitionTo(target)) {
      return {
        from: this.currentState,
        to: target,
        message: `Cannot transition from "${this.currentState}" to "${target}". Allowed: [${(TRANSITIONS[this.currentState] || []).join(', ')}]`,
      };
    }
    this.currentState = target;
    return null;
  }

  reset(): void {
    this.currentState = TaskStatus.PENDING;
  }

  isTerminal(): boolean {
    return this.currentState === TaskStatus.COMPLETED
      || this.currentState === TaskStatus.FAILED
      || this.currentState === TaskStatus.CANCELLED;
  }

  isExecuting(): boolean {
    return this.currentState === TaskStatus.EXECUTING;
  }

  isBlocked(): boolean {
    return this.currentState === TaskStatus.BLOCKED;
  }

  needsApproval(): boolean {
    return this.currentState === TaskStatus.AWAITING_APPROVAL;
  }
}

// ---------------------------------------------------------------------------
// Helper: check if an AICommand status is a valid lifecycle state
// ---------------------------------------------------------------------------

export function isValidTaskStatus(status: string): status is TaskStatus {
  return Object.values(TaskStatus).includes(status as TaskStatus);
}

export function canTransition(from: string, to: string): boolean {
  if (!isValidTaskStatus(from) || !isValidTaskStatus(to)) return false;
  return TRANSITIONS[from as TaskStatus]?.includes(to as TaskStatus) ?? false;
}

// ---------------------------------------------------------------------------
// Merge into AICommand status type
// ---------------------------------------------------------------------------

export function extendCommandWithLifecycle(
  command: AICommand & { lifecycle?: TaskLifecycle }
): AICommand & { lifecycle: TaskLifecycle } {
  return {
    ...command,
    lifecycle: command.lifecycle || new TaskLifecycle(
      mapStatusToLifecycle(command.status)
    ),
  };
}

function mapStatusToLifecycle(status: string): TaskStatus {
  switch (status) {
    case 'pending': return TaskStatus.PENDING;
    case 'awaiting_permission':
    case 'awaiting_approval': return TaskStatus.AWAITING_APPROVAL;
    case 'approved': return TaskStatus.APPROVED;
    case 'executing': return TaskStatus.EXECUTING;
    case 'completed': return TaskStatus.COMPLETED;
    case 'failed': return TaskStatus.FAILED;
    case 'blocked': return TaskStatus.BLOCKED;
    case 'cancelled': return TaskStatus.CANCELLED;
    default: return TaskStatus.PENDING;
  }
}
