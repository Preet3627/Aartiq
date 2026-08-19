/**
 * Aartiq clarifying-question protocol.
 *
 * When the AI needs more information before it can act or answer well, it MAY
 * emit a fenced `aartiq-question` JSON block. The UI parses it into an
 * interactive card: the user can pick a preset option, type their own answer,
 * or skip. Only the explanatory prose is shown as a normal message; the JSON
 * block becomes the card.
 */

export interface AartiqQuestion {
  /** A single clear question sentence. */
  question: string;
  /** 2–5 short, distinct preset choices. */
  options: string[];
  /** When true the user may select more than one option. */
  multi?: boolean;
}

const FENCE_RE = /```aartiq-question\s*\n([\s\S]*?)```/i;

export interface ParsedQuestion {
  question: AartiqQuestion | null;
  /** Original content with the question fence removed (commands/JSON kept). */
  text: string;
}

export function parseAartiqQuestion(content: string): ParsedQuestion {
  if (!content) return { question: null, text: content };
  const match = content.match(FENCE_RE);
  if (!match) return { question: null, text: content };
  try {
    const data = JSON.parse(match[1].trim());
    const q = typeof data.question === "string" ? data.question.trim() : "";
    const opts = Array.isArray(data.options)
      ? data.options.map((o: unknown) => String(o).trim()).filter(Boolean)
      : [];
    if (!q || opts.length === 0) return { question: null, text: content };
    const question: AartiqQuestion = {
      question: q,
      options: opts.slice(0, 8),
      multi: Boolean(data.multi),
    };
    const text = content.replace(FENCE_RE, "").trim();
    return { question, text };
  } catch {
    return { question: null, text: content };
  }
}

/** Re-emit a question as a fenced block (used when persisting to model history). */
export function serializeAartiqQuestion(q: AartiqQuestion): string {
  return "```aartiq-question\n" + JSON.stringify(q) + "\n```";
}
