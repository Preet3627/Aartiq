/**
 * Comet AI Sidebar Commands
 * Adapted from Thuki by Logan Nguyen (Apache 2.0)
 */

export interface Command {
  readonly trigger: string;
  readonly label: string;
  readonly description: string;
}

export const COMMANDS: readonly Command[] = [
  {
    trigger: '/screen',
    label: '/screen',
    description: 'Capture your screen and include it as context',
  },
  {
    trigger: '/think',
    label: '/think',
    description: 'Think deeply before answering',
  },
  {
    trigger: '/summarize',
    label: '/summarize',
    description: 'Summarize selected content',
  },
  {
    trigger: '/search',
    label: '/search',
    description: 'Search the web for information',
  },
  {
    trigger: '/rewrite',
    label: '/rewrite',
    description: 'Rewrite selected text',
  },
  {
    trigger: '/translate',
    label: '/translate',
    description: 'Translate text to another language',
  },
  {
    trigger: '/explain',
    label: '/explain',
    description: 'Explain code or concept',
  },
  {
    trigger: '/pdf',
    label: '/pdf',
    description: 'Generate a PDF document',
  },
] as const;

export const SCREEN_CAPTURE_PLACEHOLDER = 'blob:screen-capture-loading';
