export type LlmMode = 'light' | 'normal' | 'heavy';

const THINKING_LEVEL_BY_MODE: Record<LlmMode, 'low' | 'medium' | 'high'> = {
  light: 'low',
  normal: 'medium',
  heavy: 'high',
};

const THINKING_BUDGET_BY_LEVEL: Record<'low' | 'medium' | 'high', number> = {
  low: 4500,
  medium: 9500,
  high: 16500,
};

export interface AiReasoningOptions {
  provider?: string;
  localLlmMode?: LlmMode;
  thinkingLevel?: 'low' | 'medium' | 'high';
  thinkingBudget?: number;
  [key: string]: any;
}

export function buildFrontendReasoningOptions(
  mode: LlmMode = 'normal',
  provider?: string,
  overrides: Partial<AiReasoningOptions> = {},
): AiReasoningOptions {
  const thinkingLevel = overrides.thinkingLevel ?? THINKING_LEVEL_BY_MODE[mode] ?? 'medium';
  const thinkingBudget = overrides.thinkingBudget ?? THINKING_BUDGET_BY_LEVEL[thinkingLevel] ?? 9500;
  return {
    provider,
    localLlmMode: mode,
    thinkingLevel,
    thinkingBudget,
    ...overrides,
  };
}
