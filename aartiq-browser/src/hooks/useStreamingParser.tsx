"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface ParsedMessage {
  rawContent: string;
  displayContent: string;
  reasoning: string[];
  ocrText: string | null;
  ocrLabel: string | null;
  mediaItems: MediaItem[];
  actionLogs: ActionLog[];
  commands: ParsedCommand[];
  isParsed: boolean;
  parseProgress: number;
}

export interface MediaItem {
  id?: string;
  type: string;
  url?: string;
  caption?: string;
  videoUrl?: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  source?: string;
  videoId?: string;
  diagramId?: string;
  code?: string;
  chartId?: string;
  chartDataJSON?: string;
  chartOptionsJSON?: string;
}

export interface ActionLog {
  id: string;
  type: string;
  output: string;
  success: boolean;
  timestamp?: number;
}

export interface ParsedCommand {
  id: string;
  type: string;
  value: string;
  category: string;
  riskLevel: string;
  reason?: string;
}

const INTERNAL_TAG_RE = /\[AI REASONING\]|\[\/AI REASONING\]|\[OCR_RESULT\]|\[\/OCR_RESULT\]|<think|<think>|<thinking>|<thought>|<think>|<thinking>|<\/think>|<\/think>|<\/thinking>|<\/thought>/gi;

const REASONING_PATTERNS: RegExp[] = [
  /\[ AI REASONING \][\s\S]*?\[\/AI REASONING\]/gi,
  /<think>[\s\S]*?<\/think>/gi,
  /<thinking>[\s\S]*?<\/thinking>/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
];

const OCR_PATTERNS: RegExp[] = [
  /\[ OCR_RESULT \][\s\S]*?\[\/OCR_RESULT\]/gi,
  /<ocr>[\s\S]*?<\/ocr>/gi,
];

const COMMAND_TAG_PATTERN = /\[\s*([A-Z_]+)\s*(?::\s*([^\]]+?))?\s*\]/g;

const AI_COMMAND_TYPES = new Set([
  'NAVIGATE', 'SEARCH', 'WEB_SEARCH', 'READ_PAGE_CONTENT', 'LIST_OPEN_TABS',
  'CREATE_PDF_JSON', 'CREATE_FILE_JSON', 'GENERATE_PDF',
  'SHELL_COMMAND', 'SET_THEME', 'SET_VOLUME', 'SET_BRIGHTNESS', 'OPEN_APP',
  'SCREENSHOT_AND_ANALYZE', 'CLICK_ELEMENT', 'CLICK_AT', 'FIND_AND_CLICK', 'FILL_FORM', 'SCROLL_TO',
  'GENERATE_DIAGRAM', 'GENERATE_FLOWCHART', 'GENERATE_CHART', 'OPEN_VIEW', 'RELOAD', 'GO_BACK', 'GO_FORWARD',
  'WAIT', 'THINK', 'PLAN', 'EXPLAIN_CAPABILITIES',
  'SHOW_IMAGE', 'SHOW_VIDEO', 'OCR_COORDINATES', 'OCR_SCREEN', 'EXTRACT_DATA',
  'DOM_SEARCH', 'DOM_READ_FILTERED',
  'OPEN_MCP_SETTINGS', 'OPEN_AUTOMATION_SETTINGS', 'LIST_AUTOMATIONS', 'DELETE_AUTOMATION',
  'OPEN_SCHEDULING_MODAL', 'SCHEDULE_TASK', 'OPEN_PDF', 'PLUGIN_COMMAND',
  'ORGANIZE_TABS', 'CLOSE_TAB', 'GENERATE_IMAGE',
]);

const COMMAND_CATEGORIES: Record<string, string> = {
  NAVIGATE: 'navigation',
  SEARCH: 'navigation',
  WEB_SEARCH: 'navigation',
  READ_PAGE_CONTENT: 'browser',
  LIST_OPEN_TABS: 'browser',
  CLOSE_TAB: 'browser',
  CLICK_ELEMENT: 'automation',
  CLICK_AT: 'automation',
  FIND_AND_CLICK: 'automation',
  FILL_FORM: 'automation',
  SCROLL_TO: 'automation',
  ORGANIZE_TABS: 'automation',
  SHELL_COMMAND: 'system',
  OPEN_APP: 'system',
  SET_VOLUME: 'system',
  SET_BRIGHTNESS: 'system',
  CREATE_PDF_JSON: 'pdf',
  CREATE_FILE_JSON: 'pdf',
  GENERATE_PDF: 'pdf',
  GENERATE_DIAGRAM: 'pdf',
  GENERATE_FLOWCHART: 'pdf',
  GENERATE_CHART: 'pdf',
  OPEN_PDF: 'pdf',
  SHOW_IMAGE: 'media',
  SHOW_VIDEO: 'media',
  SCREENSHOT_AND_ANALYZE: 'media',
  OCR_COORDINATES: 'media',
  OCR_SCREEN: 'media',
  GENERATE_IMAGE: 'media',
  WAIT: 'utility',
  OPEN_VIEW: 'utility',
  RELOAD: 'utility',
  GO_BACK: 'utility',
  GO_FORWARD: 'utility',
  THINK: 'meta',
  PLAN: 'meta',
  EXPLAIN_CAPABILITIES: 'meta',
};

function getCommandCategory(type: string): string {
  return COMMAND_CATEGORIES[type] || 'utility';
}

function getCommandRiskLevel(category: string): string {
  return ['navigation', 'browser', 'meta'].includes(category) ? 'low' : 'medium';
}

export interface UseStreamingParserOptions {
  parseImmediately?: boolean;
  parseDelay?: number;
  skipParsingDuringStream?: boolean;
}

export interface UseStreamingParserResult {
  parsedMessage: ParsedMessage;
  isParsed: boolean;
  parseProgress: number;
  finalContent: string;
}

function parseContentHelper(rawContent: string): ParsedMessage {
  let text = rawContent;
  const reasoning: string[] = [];
  let ocrText: string | null = null;

  for (const pattern of REASONING_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const content = (match[0] || '').trim();
      if (content && !reasoning.includes(content)) {
        reasoning.push(content);
      }
    }
  }

  for (const pattern of OCR_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      ocrText = (match[0] || '').trim();
      text = text.replace(match[0], '');
      break;
    }
  }

  text = text.replace(INTERNAL_TAG_RE, '');

  const commands: ParsedCommand[] = [];
  const commandRegex = new RegExp(COMMAND_TAG_PATTERN.source, 'g');
  let commandMatch;
  while ((commandMatch = commandRegex.exec(text)) !== null) {
    const type = (commandMatch[1] || '').toUpperCase();
    const value = (commandMatch[2] || '').trim();

    if (AI_COMMAND_TYPES.has(type)) {
      const category = getCommandCategory(type);
      commands.push({
        id: `${type}-${commandMatch.index}`,
        type,
        value,
        category,
        riskLevel: getCommandRiskLevel(category),
      });
      text = text.replace(commandMatch[0], '');
    }
  }

  const displayContent = text.trim();

  return {
    rawContent,
    displayContent,
    reasoning,
    ocrText,
    ocrLabel: null,
    mediaItems: [],
    actionLogs: [],
    commands,
    isParsed: true,
    parseProgress: 100,
  };
}

export function useStreamingParser(
  content: string,
  isStreaming: boolean,
  options: UseStreamingParserOptions = {}
): UseStreamingParserResult {
  const { skipParsingDuringStream = true, parseDelay = 100 } = options;

  const [parsedMessage, setParsedMessage] = useState<ParsedMessage>(() => ({
    rawContent: content,
    displayContent: content,
    reasoning: [],
    ocrText: null,
    ocrLabel: null,
    mediaItems: [],
    actionLogs: [],
    commands: [],
    isParsed: false,
    parseProgress: 0,
  }));

  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastParsedContentRef = useRef('');

  useEffect(() => {
    if (isStreaming && skipParsingDuringStream) {
      setParsedMessage(prev => ({
        ...prev,
        rawContent: content,
        displayContent: content,
        isParsed: false,
        parseProgress: 0,
      }));
      return;
    }

    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    if (content === lastParsedContentRef.current) {
      return;
    }

    parseTimeoutRef.current = setTimeout(() => {
      const parsed = parseContentHelper(content);
      lastParsedContentRef.current = content;
      setParsedMessage(parsed);
    }, isStreaming ? parseDelay : 0);

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, [content, isStreaming, skipParsingDuringStream, parseDelay]);

  return {
    parsedMessage,
    isParsed: parsedMessage.isParsed,
    parseProgress: parsedMessage.parseProgress,
    finalContent: parsedMessage.displayContent,
  };
}

export function useFinalParser(content: string): ParsedMessage {
  return useMemo(() => {
    return parseContentHelper(content);
  }, [content]);
}

export default useStreamingParser;
