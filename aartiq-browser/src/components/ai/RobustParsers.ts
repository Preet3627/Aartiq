// Robust parsing utilities for LLM output and custom tags
// Based on best practices: multi-stage extraction, markdown stripping, validation

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag extraction patterns - matches tags with optional whitespace
// ─────────────────────────────────────────────────────────────────────────────
const TAG_PATTERNS = {
  AI_REASONING: /\[?\s*AI REASONING\s*\]?\s*([\s\S]*?)\[?\s*\/AI REASONING\s*\]?/gi,
  OCR_RESULT: /\[?\s*OCR_RESULT\s*\]?\s*([\s\S]*?)\[?\s*\/OCR_RESULT\s*\]?/gi,
  ACTION_CHAIN_JSON: /\[?\s*ACTION_CHAIN_JSON\s*\]?\s*([\s\S]*?)\[?\s*\/ACTION_CHAIN_JSON\s*\]?/gi,
  MEDIA_ATTACHMENTS_JSON: /\[?\s*MEDIA_ATTACHMENTS_JSON\s*\]?\s*([\s\S]*?)\[?\s*\/MEDIA_ATTACHMENTS_JSON\s*\]?/gi,
  // Action command tags
  ACTION_COMMAND: /\[([A-Z_][A-Z0-9_]*)\](?:\[([^\]]+)\])?/g,
};

// ─────────────────────────────────────────────────────────────────────────────
// JSON extraction strategies (best practices from research)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage 1: Try direct JSON.parse (works if LLM returns clean JSON)
 */
export function tryParseJSON(text: string): ParseResult<any> {
  try {
    const data = JSON.parse(text);
    return { success: true, data };
  } catch {
    return { success: false, error: 'Not valid JSON' };
  }
}

/**
 * Stage 2: Strip markdown code fences and try again
 * Handles: ```json ... ``` or ``` ... ```
 */
export function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/**
 * Stage 3: Strip common LLM prefixes that break JSON
 * Handles: "Here is the JSON:", "Here is your response:", etc.
 */
export function stripLLMPrefixes(text: string): string {
  const prefixes = [
    /^(?:here(?:'s| is) the(?: JSON)?:?\s*)/i,
    /^(?:here(?:'s| is) (?:your |the )?(?:response|result|data):?\s*)/i,
    /^(?:sure[,]?\s*(?:here(?:'s| is))?)\s*/i,
    /^(?:of course[,]?\s*(?:here(?:'s| is))?)\s*/i,
    /^(?:here you go[,]?\s*)/i,
    /^(?:as requested[,]?\s*)/i,
    /^(?:✅\s*)*/,
  ];
  
  let result = text;
  for (const prefix of prefixes) {
    result = result.replace(prefix, '');
  }
  return result.trim();
}

/**
 * Stage 4: Extract JSON from markdown code blocks (fallback)
 */
export function extractJSONFromMarkdown(text: string): ParseResult<any> {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    return tryParseJSON(codeBlockMatch[1]);
  }
  return { success: false, error: 'No code block found' };
}

/**
 * Complete robust JSON parser - tries all strategies in order
 */
export function robustJSONParse(text: string): ParseResult<any> {
  if (!text || typeof text !== 'string') {
    return { success: false, error: 'Invalid input' };
  }

  const strategies = [
    () => tryParseJSON(text),
    () => tryParseJSON(stripMarkdownFences(text)),
    () => tryParseJSON(stripLLMPrefixes(text)),
    () => tryParseJSON(stripLLMPrefixes(stripMarkdownFences(text))),
    () => extractJSONFromMarkdown(text),
    () => extractJSONFromMarkdown(stripLLMPrefixes(text)),
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result.success) {
      return result;
    }
  }

  return { success: false, error: 'All parsing strategies failed' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag extraction utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract content from a tag, handling whitespace variations
 */
export function extractTagContent(text: string, tagName: string): string | null {
  const pattern = new RegExp(`\\[?\\s*${tagName}\\s*\\]?\\s*([\\s\\S]*?)\\[?\\s*/${tagName}\\s*\\]?`, 'gi');
  const match = pattern.exec(text);
  return match ? match[1].trim() : null;
}

/**
 * Extract all occurrences of a tag
 */
export function extractAllTagContents(text: string, tagName: string): string[] {
  const pattern = new RegExp(`\\[?\\s*${tagName}\\s*\\]?\\s*([\\s\\S]*?)\\[?\\s*/${tagName}\\s*\\]?`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Extract all AI REASONING blocks
 */
export function extractAIReasoning(text: string): string[] {
  return extractAllTagContents(text, 'AI REASONING');
}

/**
 * Extract OCR_RESULT and parse as JSON
 */
export function extractOCRResult(text: string): ParseResult<any> {
  const content = extractTagContent(text, 'OCR_RESULT');
  if (!content) {
    return { success: false, error: 'No OCR_RESULT tag found' };
  }
  return robustJSONParse(content);
}

/**
 * Extract ACTION_CHAIN_JSON and parse as JSON
 */
export function extractActionChain(text: string): ParseResult<any> {
  const content = extractTagContent(text, 'ACTION_CHAIN_JSON');
  if (!content) {
    return { success: false, error: 'No ACTION_CHAIN_JSON tag found' };
  }
  return robustJSONParse(content);
}

/**
 * Extract MEDIA_ATTACHMENTS_JSON and parse as JSON
 */
export function extractMediaAttachments(text: string): ParseResult<any> {
  const content = extractTagContent(text, 'MEDIA_ATTACHMENTS_JSON');
  if (!content) {
    return { success: false, error: 'No MEDIA_ATTACHMENTS_JSON tag found' };
  }
  return robustJSONParse(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clean text for display - removes tags but preserves content
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove all custom tags from text while preserving content
 */
export function cleanTagsFromText(text: string): string {
  return text
    .replace(/\[\s*AI REASONING\s*\][\s\S]*?\[\s*\/AI REASONING\s*\]/gi, '')
    .replace(/\[\s*OCR_RESULT\s*\][\s\S]*?\[\s*\/OCR_RESULT\s*\]/gi, '')
    .replace(/\[\s*ACTION_CHAIN_JSON\s*\][\s\S]*?\[\s*\/ACTION_CHAIN_JSON\s*\]/gi, '')
    .replace(/\[\s*MEDIA_ATTACHMENTS_JSON\s*\][\s\S]*?\[\s*\/MEDIA_ATTACHMENTS_JSON\s*\]/gi, '')
    .replace(/\[\s*[A-Z_][A-Z0-9_]*\s*\]/g, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Action command tag parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedActionCommand {
  command: string;
  args?: string;
}

/**
 * Extract action commands from text
 * Matches patterns like [NAVIGATE:url] or [SHELL_COMMAND:command]
 */
export function extractActionCommands(text: string): ParsedActionCommand[] {
  const commands: ParsedActionCommand[] = [];
  const pattern = /\[([A-Z_][A-Z0-9_]*?)(?::([^\]]+))?\]/g;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    commands.push({
      command: match[1].trim(),
      args: match[2]?.trim()
    });
  }
  
  return commands;
}

/**
 * Check if text contains any action commands
 */
export function hasActionCommands(text: string): boolean {
  return /\[([A-Z_][A-Z0-9_]+)\]/.test(text);
}