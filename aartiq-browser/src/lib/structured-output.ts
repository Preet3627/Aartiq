// ---------------------------------------------------------------------------
// Structured Output + Manual JSON Fallback
// Dual-path output parser: try structured output (tool calls) first,
// fall back to manual JSON extraction from raw text.
// Handles Llama/DeepSeek specific formats.
// Inspired by veto-browse's agents/base.ts.
// ---------------------------------------------------------------------------

export interface StructuredParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'structured' | 'json_fallback' | 'think_tag' | 'failed';
}

export type SchemaValidator<T> = (raw: unknown) => T | { error: string };

// ---------------------------------------------------------------------------
// JSON extraction from raw text
// ---------------------------------------------------------------------------

function extractJSON(text: string): string | null {
  // Try to find JSON in code blocks first
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/;
  const codeMatch = text.match(codeBlockRegex);
  if (codeMatch) {
    const candidate = codeMatch[1].trim();
    if (isValidJSON(candidate)) return candidate;
  }

  // Try to find a top-level JSON object
  const objectRegex = RegExp('\\{(?:[^{}]|(?:\\{(?:[^{}]|(?:\\{[^{}]*\\}))*\\}))*\\}', 'g');
  const objects = text.match(objectRegex);
  if (objects) {
    for (const obj of objects) {
      if (isValidJSON(obj)) return obj;
    }
  }

  // Try to find a top-level JSON array
  const arrayRegex = RegExp('\\[(?:[^\\[\\]]|(?:\\[(?:[^\\[\\]]|(?:\\[[^\\[\\]]*\\]))*\\]))*\\]', 'g');
  const arrays = text.match(arrayRegex);
  if (arrays) {
    for (const arr of arrays) {
      if (isValidJSON(arr)) return arr;
    }
  }

  return null;
}

function isValidJSON(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Think tag extraction (DeepSeek, Qwen style)
// ---------------------------------------------------------------------------

function extractThinkTagContent(text: string): { reasoning?: string; content: string } {
  const thinkMatch = text.match(/<think>(.*?)<\/think>/s);
  const reasoning = thinkMatch ? thinkMatch[1].trim() : undefined;
  const content = text.replace(/<think>.*?<\/think>/gs, '').trim();
  return { reasoning, content };
}

// ---------------------------------------------------------------------------
// JSON repair helpers for common LLM output issues
// ---------------------------------------------------------------------------

function repairJSON(raw: string): string {
  let repaired = raw.trim();

  // Remove trailing commas
  repaired = repaired.replace(/,\s*}/g, '}');
  repaired = repaired.replace(/,\s*\]/g, ']');

  // Unquoted keys
  repaired = repaired.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Single quotes to double quotes
  repaired = repaired.replace(/'/g, '"');

  // Trailing garbage after closing brace
  const braceEnd = repaired.lastIndexOf('}');
  if (braceEnd !== -1 && braceEnd < repaired.length - 1) {
    repaired = repaired.slice(0, braceEnd + 1);
  }

  // Trailing garbage after closing bracket
  const bracketEnd = repaired.lastIndexOf(']');
  if (bracketEnd !== -1 && bracketEnd < repaired.length - 1) {
    repaired = repaired.slice(0, bracketEnd + 1);
  }

  return repaired;
}

// ---------------------------------------------------------------------------
// Provider-specific format detection
// ---------------------------------------------------------------------------

function detectProviderFormat(text: string): 'json' | 'think_tag' | 'code_block' | 'unknown' {
  if (text.includes('<think>') && text.includes('</think>')) {
    return 'think_tag';
  }
  if (/```(?:json)?\s*[\s\S]*```/.test(text)) {
    return 'code_block';
  }
  if (/^\s*[{[]/.test(text) && /[}\]]\s*$/.test(text)) {
    return 'json';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseStructuredOutput<T>(
  rawText: string,
  validator: SchemaValidator<T>,
  options?: { tryRepair?: boolean }
): StructuredParseResult<T> {
  const opts = { tryRepair: true, ...options };

  if (!rawText) {
    return { success: false, error: 'Empty response', source: 'failed' };
  }

  const format = detectProviderFormat(rawText);

  // Step 1: Try direct JSON parse
  if (format === 'json' || format === 'unknown') {
    const directResult = tryParseWithValidator(rawText, validator);
    if (directResult.success) return directResult;

    // Step 2: Try with repair
    if (opts.tryRepair) {
      const repaired = repairJSON(rawText);
      const repairResult = tryParseWithValidator(repaired, validator);
      if (repairResult.success) {
        return { ...repairResult, source: 'json_fallback' };
      }
    }
  }

  // Step 3: Extract JSON from code blocks
  if (format === 'code_block' || format === 'unknown') {
    const extracted = extractJSON(rawText);
    if (extracted) {
      const extractResult = tryParseWithValidator(extracted, validator);
      if (extractResult.success) {
        return { ...extractResult, source: 'json_fallback' };
      }

      if (opts.tryRepair) {
        const repaired = repairJSON(extracted);
        const repairResult = tryParseWithValidator(repaired, validator);
        if (repairResult.success) {
          return { ...repairResult, source: 'json_fallback' };
        }
      }
    }
  }

  // Step 4: Handle think tag format (DeepSeek)
  if (format === 'think_tag') {
    const { content } = extractThinkTagContent(rawText);
    const contentResult = parseStructuredOutput(content, validator, opts);
    if (contentResult.success) {
      return {
        ...contentResult,
        data: contentResult.data,
        source: 'think_tag',
      };
    }
  }

  return {
    success: false,
    error: 'Could not extract valid structured data from response',
    source: 'failed',
  };
}

function tryParseWithValidator<T>(
  text: string,
  validator: SchemaValidator<T>
): StructuredParseResult<T> {
  try {
    const parsed = JSON.parse(text);
    const validated = validator(parsed);
    if (validated && typeof validated === 'object' && 'error' in validated) {
      return {
        success: false,
        error: (validated as { error: string }).error,
        source: 'failed',
      };
    }
    return {
      success: true,
      data: validated as T,
      source: 'structured',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      source: 'failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Schema builder helpers (lightweight — no Zod dependency needed)
// ---------------------------------------------------------------------------

export function object<T extends Record<string, unknown>>(
  shape: { [K in keyof T]: (value: unknown) => T[K] | { error: string } }
): SchemaValidator<T> {
  return (raw: unknown) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { error: 'Expected an object' };
    }
    const result: Record<string, unknown> = {};
    for (const [key, validate] of Object.entries(shape)) {
      const value = validate((raw as Record<string, unknown>)[key]);
      if (value && typeof value === 'object' && 'error' in value) {
        return value as { error: string };
      }
      result[key] = value;
    }
    return result as T;
  };
}

export function string(): SchemaValidator<string> {
  return (value: unknown) => {
    if (typeof value !== 'string') return { error: 'Expected a string' };
    return value;
  };
}

export function number(): SchemaValidator<number> {
  return (value: unknown) => {
    if (typeof value !== 'number' || isNaN(value)) return { error: 'Expected a number' };
    return value;
  };
}

export function boolean(): SchemaValidator<boolean> {
  return (value: unknown) => {
    if (typeof value !== 'boolean') return { error: 'Expected a boolean' };
    return value;
  };
}

export function array<T>(itemValidator: SchemaValidator<T>): SchemaValidator<T[]> {
  return (value: unknown) => {
    if (!Array.isArray(value)) return { error: 'Expected an array' };
    const result: T[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = itemValidator(value[i]);
      if (item && typeof item === 'object' && 'error' in item) {
        return item as { error: string };
      }
      result.push(item as T);
    }
    return result;
  };
}
