/**
 * Robust AI Command Parser
 * Handles extraction and validation of AI commands from LLM responses
 */

import { robustJSONParse } from '../components/ai/RobustParsers';

export interface ParsedCommand {
    type: string;
    value: string;
    originalMatch: string;
    index: number;
    category?: string;
    reason?: string;
    risk?: 'low' | 'medium' | 'high';
}

export interface CommandParseResult {
    commands: ParsedCommand[];
    textWithoutCommands: string;
    hasCommands: boolean;
    parseIssues: Array<{
        type: string;
        value: string;
        error: string;
        originalMatch: string;
        index: number;
    }>;
}

// Strict Command Registry with descriptions and examples
export const COMMAND_REGISTRY = {
    NAVIGATE: { desc: 'Go to a specific URL', example: '[NAVIGATE: https://google.com]' },
    SEARCH: { desc: 'Search using default engine', example: '[SEARCH: AI news]' },
    WEB_SEARCH: { desc: 'Real-time web search with RAG', example: '[WEB_SEARCH: today stock prices]' },
    READ_PAGE_CONTENT: { desc: 'Read DOM text from active tab (FAST)', example: '[READ_PAGE_CONTENT]' },
    OCR_SCREEN: { desc: 'OCR screen/visual content (SLOW)', example: '[OCR_SCREEN]' },
    LIST_OPEN_TABS: { desc: 'List all open browser tabs', example: '[LIST_OPEN_TABS]' },
    CREATE_PDF_JSON: { desc: 'Create PDF using structured JSON (PREFERRED)', example: '[CREATE_PDF_JSON: {"title":"Report", "pages":[...]}]' },
    CREATE_FILE_JSON: { desc: 'Create PDF/PPTX/DOCX using structured JSON', example: '[CREATE_FILE_JSON: {"format":"pptx","title":"Report","slides":[...]}]' },
    GENERATE_PDF: { desc: 'Create PDF from markdown (FALLBACK)', example: '[GENERATE_PDF: Report | Content...]' },
    SHELL_COMMAND: { desc: 'Execute terminal commands (Safe)', example: '[SHELL_COMMAND: ls -la]' },
    SET_THEME: { desc: 'Switch between dark/light mode', example: '[SET_THEME: dark]' },
    SET_VOLUME: { desc: 'Set system audio volume', example: '[SET_VOLUME: 50]' },
    SET_BRIGHTNESS: { desc: 'Set screen brightness level', example: '[SET_BRIGHTNESS: 80]' },
    OPEN_APP: { desc: 'Launch a desktop application', example: '[OPEN_APP: Chrome]' },
    SCREENSHOT_AND_ANALYZE: { desc: 'See the page using Vision/OCR', example: '[SCREENSHOT_AND_ANALYZE]' },
    CLICK_ELEMENT: { desc: 'Click a web element by selector', example: '[CLICK_ELEMENT: #submit-btn | click submit]' },
    FIND_AND_CLICK: { desc: 'Find text on screen and click it', example: '[FIND_AND_CLICK: Login | auth task]' },
    GENERATE_DIAGRAM: { desc: 'Create charts using Mermaid.js', example: '[GENERATE_DIAGRAM: graph TD...]' },
    OPEN_VIEW: { desc: 'Switch browser workspace views', example: '[OPEN_VIEW: coding]' },
    RELOAD: { desc: 'Refresh the active browser tab', example: '[RELOAD]' },
    GO_BACK: { desc: 'Go back in browser history', example: '[GO_BACK]' },
    GO_FORWARD: { desc: 'Go forward in browser history', example: '[GO_FORWARD]' },
    WAIT: { desc: 'Pause execution for duration (ms)', example: '[WAIT: 2000]' },
    THINK: { desc: 'Show AI reasoning steps', example: '[THINK: "Calculating optimal path..."]' },
    PLAN: { desc: 'Show AI future plans', example: '[PLAN: "Step 1: Search, Step 2: Read"]' },
    EXPLAIN_CAPABILITIES: { desc: 'List all available AI features', example: '[EXPLAIN_CAPABILITIES]' },
    DOM_SEARCH: { desc: 'Search within current page DOM', example: '[DOM_SEARCH: search term]' },
    DOM_READ_FILTERED: { desc: 'Read DOM with filtering & injection check', example: '[DOM_READ_FILTERED: optional search term]' },
    OPEN_MCP_SETTINGS: { desc: 'Open MCP servers settings', example: '[OPEN_MCP_SETTINGS]' },
    OPEN_AUTOMATION_SETTINGS: { desc: 'Open automation settings', example: '[OPEN_AUTOMATION_SETTINGS]' },
    LIST_AUTOMATIONS: { desc: 'List scheduled automation tasks', example: '[LIST_AUTOMATIONS]' },
    DELETE_AUTOMATION: { desc: 'Delete an automation using its ID', example: '[DELETE_AUTOMATION: task-123]' },
    OPEN_SCHEDULING_MODAL: { desc: 'Open scheduling modal with optional data (JSON or pipe-separated)', example: '[OPEN_SCHEDULING_MODAL: 0 8 * * *|pdf-generate|Daily Report|Generate PDF]' },
    SCHEDULE_TASK: { desc: 'Schedule a recurring automation task (JSON format)', example: '[SCHEDULE_TASK: {"schedule": "0 8 * * *", "type": "pdf-generate", "name": "Daily Report"}]' },
    ORGANIZE_TABS: { desc: 'Use AI to intelligently group all open tabs', example: '[ORGANIZE_TABS]' },
    CLOSE_TAB: { desc: 'Close a specific tab by ID', example: '[CLOSE_TAB: tab-123]' },
    PLUGIN_COMMAND: { desc: 'Execute a plugin-defined command', example: '[PLUGIN_COMMAND: my-plugin.my-command | {"param": "value"}]' },
    GENERATE_IMAGE: { desc: 'Generate an AI image with a detailed prompt', example: '[GENERATE_IMAGE: a futuristic city at sunset]' },
    APPLE_INTELLIGENCE_IMAGE: { desc: 'Generate an image using Apple Intelligence with local models', example: '[APPLE_INTELLIGENCE_IMAGE: a beautiful sunset over mountains]' },
    APPLE_INTELLIGENCE_SUMMARY: { desc: 'Summarize text using Apple Intelligence local models', example: '[APPLE_INTELLIGENCE_SUMMARY: The text to summarize]' },
    ENABLE_CLI: { desc: 'Automatically enable the Comet-AI CLI terminal tool', example: '[ENABLE_CLI]' },
} as const;

export const SUPPORTED_COMMANDS = Object.keys(COMMAND_REGISTRY) as Array<keyof typeof COMMAND_REGISTRY>;
export type CommandType = keyof typeof COMMAND_REGISTRY;

// Non-executable commands (handled by LLM only or displayed in text)
export const META_COMMANDS = [
    'PLACEHOLDER_META',
] as const;

/**
 * Get category for command type
 */
function getCategoryForType(type: string): string {
    const catMap: Record<string, string> = {
        NAVIGATE: 'navigation', SEARCH: 'navigation', WEB_SEARCH: 'navigation',
        READ_PAGE_CONTENT: 'browser', SCREENSHOT_ANALYZE: 'browser', EXTRACT_DATA: 'browser',
        CLICK_ELEMENT: 'automation', FIND_AND_CLICK: 'automation', FILL_FORM: 'automation',
        SHELL_COMMAND: 'system', OPEN_APP: 'system', SET_VOLUME: 'system', SET_BRIGHTNESS: 'system',
        GENERATE_PDF: 'pdf', CREATE_PDF_JSON: 'pdf', CREATE_FILE_JSON: 'pdf', GENERATE_DIAGRAM: 'pdf', OPEN_PDF: 'pdf',
        SHOW_IMAGE: 'media', SHOW_VIDEO: 'media', GENERATE_IMAGE: 'media', APPLE_INTELLIGENCE_IMAGE: 'media', APPLE_INTELLIGENCE_SUMMARY: 'utility',
        WAIT: 'utility', OPEN_VIEW: 'utility', OPEN_MCP_SETTINGS: 'utility', OPEN_AUTOMATION_SETTINGS: 'utility', LIST_AUTOMATIONS: 'automation', DELETE_AUTOMATION: 'automation', OPEN_SCHEDULING_MODAL: 'utility', SCHEDULE_TASK: 'utility',
        GMAIL_AUTHORIZE: 'gmail', GMAIL_LIST_MESSAGES: 'gmail', GMAIL_GET_MESSAGE: 'gmail',
        GMAIL_SEND_MESSAGE: 'gmail', GMAIL_ADD_LABEL: 'gmail',
        THINK: 'meta', PLAN: 'meta', EXPLAIN_CAPABILITIES: 'meta',
        ORGANIZE_TABS: 'automation', CLOSE_TAB: 'browser', ENABLE_CLI: 'automation',
    };
    return catMap[type] || 'utility';
}

/**
 * Extract commands from JSON format
 * Supports: {"commands": [{"type": "...", "value": "..."}]}
 */
function normalizeCommandValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function extractCommandsFromStructuredPayload(payload: any, originalMatch: string, index: number): ParsedCommand[] {
    const commands: ParsedCommand[] = [];

    const appendCommand = (cmd: any) => {
        const cmdType = (cmd?.type || cmd?.command || '').toUpperCase();
        const cmdValue = cmd?.value ?? cmd?.url ?? cmd?.query ?? cmd?.args ?? '';

        if (!cmdType || !SUPPORTED_COMMANDS.includes(cmdType as any)) {
            return;
        }

        commands.push({
            type: cmdType,
            value: normalizeCommandValue(cmdValue),
            reason: typeof cmd?.reason === 'string' ? cmd.reason : '',
            risk: (['low', 'medium', 'high'].includes(cmd?.risk) ? cmd.risk : 'medium') as any,
            originalMatch,
            index,
        });
    };

    if (Array.isArray(payload)) {
        payload.forEach(appendCommand);
        return commands;
    }

    if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.commands)) {
            payload.commands.forEach(appendCommand);
            return commands;
        }

        if (payload.type || payload.command) {
            appendCommand(payload);
        }
    }

    return commands;
}

/** Scan `src` starting at `startAt` for the outermost balanced { } or [ ] block. */
function scanBalanced(src: string, startAt: number): { start: number; end: number } | null {
    const open = src[startAt];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = startAt; i < src.length; i++) {
        const ch = src[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inStr) { escape = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === open) depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0) return { start: startAt, end: i };
        }
    }
    return null;
}

function extractJSONCommands(content: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    const seenTypes = new Set<string>();
    const matchedRanges: Array<[number, number]> = [];

    const SINGLE_RUN_COMMANDS = new Set(['CREATE_PDF_JSON', 'CREATE_FILE_JSON', 'GENERATE_PDF', 'CREATE_PDF']);
    const takeCommand = (cmd: ParsedCommand) => {
        if (SINGLE_RUN_COMMANDS.has(cmd.type)) {
            if (seenTypes.has(cmd.type)) return false;
            seenTypes.add(cmd.type);
        }
        return true;
    };

    // Helper: try to parse and register commands from a raw JSON candidate string.
    const tryParse = (rawCandidate: string, originalMatch: string, index: number) => {
        if (!/"(?:commands|type|command)"/.test(rawCandidate)) return;
        const robustResult = robustJSONParse(rawCandidate);
        if (robustResult.success) {
            const extracted = extractCommandsFromStructuredPayload(robustResult.data, originalMatch, index);
            extracted.forEach(cmd => { if (takeCommand(cmd)) commands.push(cmd); });
        } else {
            // Fallback: handle string-only "value" fields
            const fbRegex = /"type"\s*:\s*"([^"]+)"[\s\S]*?"(?:value|url|query|args)"\s*:\s*"([\s\S]*?)"(?=\s*[},])/g;
            let fbMatch;
            while ((fbMatch = fbRegex.exec(rawCandidate)) !== null) {
                const cmdType = fbMatch[1].toUpperCase();
                const cmdValue = fbMatch[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                if (cmdType && SUPPORTED_COMMANDS.includes(cmdType as any)) {
                    const cmd = { type: cmdType, value: cmdValue, originalMatch, index };
                    if (takeCommand(cmd)) commands.push(cmd);
                }
            }
        }
    };

    // Pass 1: Extract from fenced code blocks (```json ... ```) — balanced-brace aware
    const codeBlockRe = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
    let cbMatch: RegExpExecArray | null;
    while ((cbMatch = codeBlockRe.exec(content)) !== null) {
        const inner = (cbMatch[1] || '').trim();
        const firstBrace = inner.search(/[{[]/);
        if (firstBrace === -1) continue;
        const balanced = scanBalanced(inner, firstBrace);
        if (!balanced) continue;
        const candidate = inner.substring(balanced.start, balanced.end + 1);
        tryParse(candidate, cbMatch[0], cbMatch.index);
        // Record this range so bracket scanner won't re-parse it
        matchedRanges.push([cbMatch.index, cbMatch.index + cbMatch[0].length]);
    }

    // Pass 2: Find bare { "commands": ... } blocks in the text using balanced-brace scanner
    let searchFrom = 0;
    while (searchFrom < content.length) {
        const braceIdx = content.indexOf('{', searchFrom);
        if (braceIdx === -1) break;
        // Skip if already inside a matched code-block range
        const alreadyCovered = matchedRanges.some(([s, e]) => braceIdx >= s && braceIdx < e);
        if (alreadyCovered) { searchFrom = braceIdx + 1; continue; }
        const balanced = scanBalanced(content, braceIdx);
        if (!balanced) { searchFrom = braceIdx + 1; continue; }
        const candidate = content.substring(balanced.start, balanced.end + 1);
        if (/"(?:commands|type|command)"/.test(candidate)) {
            tryParse(candidate, candidate, balanced.start);
            matchedRanges.push([balanced.start, balanced.end + 1]);
        }
        searchFrom = balanced.end + 1;
    }

    // Attach matched ranges to commands so the bracket scanner can mask them
    (commands as any).__matchedRanges = matchedRanges;
    return commands;
}

/**
 * Parse AI response and extract commands
 * Skips commands inside markdown code blocks or tables
 * Also supports JSON format: {"commands": [{"type": "...", "value": "..."}]}
 */
export function parseAICommands(content: string): CommandParseResult {
    const commands: ParsedCommand[] = [];
    const commandsSet = new Set(SUPPORTED_COMMANDS);
    const metaCommandsSet = new Set(META_COMMANDS);
    const parseIssues: CommandParseResult['parseIssues'] = [];
    
    // Deduplication set - tracks "type:value" to avoid duplicates
    const seenCommands = new Set<string>();

    // Helper to add unique commands only
    const addUniqueCommand = (cmd: ParsedCommand) => {
        const key = `${cmd.type}:${cmd.value}`;
        if (!seenCommands.has(key)) {
            seenCommands.add(key);
            commands.push(cmd);
        }
    };

    // 0. FIRST: Check for JSON format
    const jsonCommands = extractJSONCommands(content);
    if (jsonCommands.length > 0) {
        jsonCommands.forEach(addUniqueCommand);
    }

    // 0b. Also extract from HTML comment format <!-- AI_COMMANDS_START -->...<!-- AI_COMMANDS_END -->
    const htmlCommentPattern = /<!--\s*AI_COMMANDS_START\s*-->[\s\S]*?<!--\s*AI_COMMANDS_END\s*-->/gi;
    let htmlMatch;
    while ((htmlMatch = htmlCommentPattern.exec(content)) !== null) {
        const commandsSection = htmlMatch[0].replace(/<!--\s*AI_COMMANDS_START\s*-->/gi, '').replace(/<!--\s*AI_COMMANDS_END\s*-->/gi, '');
        const lines = commandsSection.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Parse [COMMAND]:value format from HTML comments
            const match = trimmed.match(/^\[([A-Z_]+)\]\s*:(.*)$/);
            if (match) {
                const cmdType = match[1].toUpperCase();
                const cmdValue = match[2] || '';
                if (cmdType && commandsSet.has(cmdType as CommandType) && !metaCommandsSet.has(cmdType as any)) {
                    addUniqueCommand({
                        type: cmdType,
                        value: cmdValue,
                        originalMatch: trimmed,
                        index: htmlMatch.index + htmlMatch[0].indexOf(trimmed),
                    });
                }
            }
        }
    }

    // 1. Create a mask of the content to skip parsing inside sensitive blocks
    // Replace content inside ```...``` and `...` with spaces to preserve indices
    let mask = content;
    
    // Mask code blocks (including their full content so mermaid letters aren't parsed as commands)
    mask = mask.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
    
    // Mask JSON command blocks already extracted (so their string contents aren't re-parsed)
    const extractedRanges: Array<[number, number]> = (jsonCommands as any).__matchedRanges || [];
    for (const [s, e] of extractedRanges) {
        if (s >= 0 && e > s && e <= mask.length) {
            mask = mask.substring(0, s) + ' '.repeat(e - s) + mask.substring(e);
        }
    }

    // Mask inline code
    mask = mask.replace(/`.*?`/g, (m) => ' '.repeat(m.length));
    
    // Mask thinking blocks (<think>, <thinking>, <thought>)
    mask = mask.replace(/<(think|thinking|thought)>[\s\S]*?<\/\1>/gi, (m) => ' '.repeat(m.length));
    
    // Mask markdown tables (lines with at least 3 '|' characters)
    const lines = mask.split('\n');
    mask = lines.map(line => {
        if ((line.match(/\|/g) || []).length >= 3) {
            return ' '.repeat(line.length);
        }
        return line;
    }).join('\n');

    // 2. Scan string for commands using a balanced bracket parser (handles nested JSON)
    let searchIdx = 0;
    while (true) {
        const startIdx = mask.indexOf('[', searchIdx);
        if (startIdx === -1) break;
        
        const colonIdx = mask.indexOf(':', startIdx);
        const closeIdx = mask.indexOf(']', startIdx);
        
        if (closeIdx === -1) break;
        
        let typeEnd = (colonIdx !== -1 && colonIdx < closeIdx) ? colonIdx : closeIdx;
        let possibleType = mask.substring(startIdx + 1, typeEnd).trim().toUpperCase();
        
        if (!commandsSet.has(possibleType as CommandType) || metaCommandsSet.has(possibleType as any)) {
            searchIdx = startIdx + 1;
            continue;
        }

        let bracketCount = 0;
        let actualCloseIdx = -1;
        for (let i = startIdx; i < mask.length; i++) {
            if (mask[i] === '[') bracketCount++;
            else if (mask[i] === ']') {
                bracketCount--;
                if (bracketCount === 0) {
                    actualCloseIdx = i;
                    break;
                }
            }
        }
        
        if (actualCloseIdx !== -1) {
            const fullMatch = mask.substring(startIdx, actualCloseIdx + 1);
            let commandValue = '';
            if (colonIdx !== -1 && colonIdx < actualCloseIdx) {
                commandValue = mask.substring(colonIdx + 1, actualCloseIdx).trim();
            }
            
            let rawValue = commandValue;
            if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
                rawValue = rawValue.substring(1, rawValue.length - 1).trim();
            }

            const type = possibleType;
            const shouldStoreRawValue = ['GENERATE_PDF', 'CREATE_PDF_JSON', 'CREATE_FILE_JSON', 'SCHEDULE_TASK', 'OPEN_SCHEDULING_MODAL'].includes(type);

            let nextCharIdx = actualCloseIdx + 1;
            while (nextCharIdx < mask.length && /\\s/.test(mask[nextCharIdx])) nextCharIdx++;
            
            let finalMatch = fullMatch;
            if (!commandValue && nextCharIdx < mask.length && mask[nextCharIdx] === ':') {
                 let endOfLine = mask.indexOf('\\n', nextCharIdx);
                 if (endOfLine === -1) endOfLine = mask.length;
                 rawValue = mask.substring(nextCharIdx + 1, endOfLine).trim();
                 finalMatch = mask.substring(startIdx, endOfLine);
                 actualCloseIdx = endOfLine - 1;
                 if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
                     rawValue = rawValue.substring(1, rawValue.length - 1).trim();
                 }
            }

            addUniqueCommand({
                type,
                value: shouldStoreRawValue ? rawValue : rawValue.split('|')[0].trim(),
                reason: rawValue.split('|').find(p => p.trim().toLowerCase().startsWith('reason:'))?.split(':').slice(1).join(':').trim() || (rawValue.split('|')[1] || '').trim(),
                risk: (rawValue.split('|').find((p: string) => p.trim().toLowerCase().startsWith('risk:'))?.split(':').slice(1).join(':').trim().toLowerCase() as any) || 'medium',
                originalMatch: content.substring(startIdx, startIdx + finalMatch.length),
                index: startIdx,
            });
            
            searchIdx = actualCloseIdx + 1;
        } else {
            searchIdx = startIdx + 1;
        }
    }

    // Only flag tokens that look like real command attempts:
    // must contain underscore OR be >= 5 chars long.
    // This prevents Mermaid node names (A, B, FIN, etc.) from being logged as issues.
    const potentialCommandRegex = /\[\s*([A-Z_][A-Z0-9_]*)[^\]]*\](?:\s*:\s*[^\n\r]+)?/g;
    potentialCommandRegex.lastIndex = 0;

    let match;
    while ((match = potentialCommandRegex.exec(mask)) !== null) {
        const type = (match[1] || '').toUpperCase();
        if (!type || commandsSet.has(type as CommandType) || metaCommandsSet.has(type as any)) {
            continue;
        }
        // Skip short identifiers that are clearly not commands (Mermaid nodes, etc.)
        const looksLikeCommand = type.includes('_') || type.length >= 5;
        if (!looksLikeCommand) continue;

        parseIssues.push({
            type,
            value: '',
            error: `Unsupported command "${type}" was ignored.`,
            originalMatch: content.substring(match.index, match.index + match[0].length),
            index: match.index,
        });
    }

    // 3. Prepare response text by removing EXECUTED commands (keep meta commands)
    let textWithoutCommands = content;
    // Remove from bottom to top to preserve string indices
    const sortedCmds = [...commands].sort((a, b) => b.index - a.index);
    for (const cmd of sortedCmds) {
        textWithoutCommands = textWithoutCommands.substring(0, cmd.index) + 
                            textWithoutCommands.substring(cmd.index + cmd.originalMatch.length);
    }

    const sortedIssues = [...parseIssues].sort((a, b) => b.index - a.index);
    for (const issue of sortedIssues) {
        textWithoutCommands = textWithoutCommands.substring(0, issue.index) +
                            textWithoutCommands.substring(issue.index + issue.originalMatch.length);
    }

    textWithoutCommands = textWithoutCommands
        .replace(htmlCommentPattern, '')
        .replace(/```(?:json)?\s*```/gi, '')
        .trim();

    return {
        commands,
        textWithoutCommands: textWithoutCommands.trim(),
        hasCommands: commands.length > 0,
        parseIssues,
    };
}

/**
 * Validate command value based on command type
 */
export function validateCommand(command: ParsedCommand): { valid: boolean; error?: string } {
    const { type, value } = command;

    switch (type) {
        case 'NAVIGATE':
        case 'SEARCH':
        case 'WEB_SEARCH':
            if (!value) {
                return { valid: false, error: `${type} requires a value` };
            }
            break;

        case 'SET_VOLUME':
        case 'SET_BRIGHTNESS':
            const percentage = parseInt(value, 10);
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                return { valid: false, error: `${type} requires a percentage between 0-100` };
            }
            break;

        case 'WAIT':
            const duration = parseInt(value, 10);
            if (isNaN(duration) || duration < 0) {
                return { valid: false, error: 'WAIT requires a positive duration in milliseconds' };
            }
            break;

        case 'FILL_FORM':
            if (!value.includes('|')) {
                return { valid: false, error: 'FILL_FORM requires format: selector | value' };
            }
            break;

        case 'GENERATE_PDF':
            if (!value.includes('|')) {
                return { valid: false, error: 'GENERATE_PDF requires format: title | content' };
            }
            break;

        case 'CREATE_PDF_JSON':
            // JSON commands should have valid JSON structure
            // Validation is done at execution time
            break;

        // Commands that don't require values
        case 'RELOAD':
        case 'GO_BACK':
        case 'GO_FORWARD':
        case 'SCREENSHOT_AND_ANALYZE':
        case 'READ_PAGE_CONTENT':
        case 'LIST_OPEN_TABS':
        case 'GMAIL_AUTHORIZE':
        case 'EXPLAIN_CAPABILITIES':
        case 'OPEN_MCP_SETTINGS':
        case 'OPEN_AUTOMATION_SETTINGS':
        case 'OPEN_SCHEDULING_MODAL':
            // These are valid without values
            break;

        default:
            // For other commands, just check if value exists when needed
            if (!value && type !== 'OCR_SCREEN') {
                return { valid: false, error: `${type} requires a value` };
            }
    }

    return { valid: true };
}

/**
 * Extract commands and prepare for execution
 */
export function prepareCommandsForExecution(content: string): {
    commands: ParsedCommand[];
    responseText: string;
    invalidCommands: Array<{ command: ParsedCommand; error: string }>;
} {
    const parseResult = parseAICommands(content);
    const invalidCommands: Array<{ command: ParsedCommand; error: string }> = [];
    const validCommands: ParsedCommand[] = [];

    parseResult.parseIssues.forEach((issue) => {
        invalidCommands.push({
            command: {
                type: issue.type,
                value: issue.value,
                originalMatch: issue.originalMatch,
                index: issue.index,
            },
            error: issue.error,
        });
    });

    for (const command of parseResult.commands) {
        const validation = validateCommand(command);
        if (validation.valid) {
            validCommands.push(command);
        } else {
            invalidCommands.push({ command, error: validation.error || 'Unknown error' });
        }
    }

    return {
        commands: validCommands,
        responseText: parseResult.textWithoutCommands,
        invalidCommands,
    };
}

/**
 * Generate user-friendly command description
 */
export function getCommandDescription(command: ParsedCommand): string {
    const { type, value } = command;

    const descriptions: Record<string, (v: string) => string> = {
        NAVIGATE: (v) => `Navigate to ${v}`,
        SEARCH: (v) => `Search for "${v}"`,
        SET_THEME: (v) => `Change theme to ${v}`,
        OPEN_VIEW: (v) => `Open ${v} view`,
        RELOAD: () => 'Reload page',
        GO_BACK: () => 'Go back',
        GO_FORWARD: () => 'Go forward',
        SCREENSHOT_AND_ANALYZE: () => 'Capture and analyze screenshot',
        WEB_SEARCH: (v) => `Search web for "${v}"`,
        READ_PAGE_CONTENT: () => 'Read current page content',
        LIST_OPEN_TABS: () => 'List all open tabs',
        GENERATE_PDF: (v) => `Generate PDF (markdown): ${v.split('|')[0]}`,
        CREATE_PDF_JSON: (v) => 'Generate PDF (JSON structured)',
        GENERATE_DIAGRAM: (v) => 'Generate diagram',
        SHELL_COMMAND: (v) => `Execute: ${v.substring(0, 40)}...`,
        SET_BRIGHTNESS: (v) => `Set brightness to ${v}%`,
        SET_VOLUME: (v) => `Set volume to ${v}%`,
        OPEN_APP: (v) => `Open ${v}`,
        FILL_FORM: (v) => `Fill form field: ${v.split('|')[0]}`,
        SCROLL_TO: (v) => `Scroll to ${v}`,
        EXTRACT_DATA: (v) => `Extract data from ${v}`,
        CREATE_NEW_TAB_GROUP: (v) => `Create tab group: ${v.split('|')[0]}`,
        OCR_COORDINATES: (v) => `OCR region: ${v}`,
        OCR_SCREEN: (v) => v ? `OCR screen region: ${v}` : 'OCR full screen',
        CLICK_ELEMENT: (v) => `Click element: ${v}`,
        FIND_AND_CLICK: (v) => `Find and click "${v}"`,
        GMAIL_AUTHORIZE: () => 'Authorize Gmail',
        GMAIL_LIST_MESSAGES: (v) => `List Gmail messages: ${v.split('|')[0]}`,
        GMAIL_GET_MESSAGE: (v) => `Get Gmail message: ${v}`,
        GMAIL_SEND_MESSAGE: (v) => `Send email to ${v.split('|')[0]}`,
        GMAIL_ADD_LABEL: (v) => `Add Gmail label: ${v.split('|')[1]}`,
        WAIT: (v) => `Wait ${parseInt(v) / 1000} seconds`,
        GUIDE_CLICK: (v) => `Guide click: ${v.split('|')[0]}`,
        EXPLAIN_CAPABILITIES: () => 'Explain AI capabilities',
        DOM_SEARCH: (v) => `Search DOM for: ${v}`,
        DOM_READ_FILTERED: (v) => v ? `Read filtered DOM matching: ${v}` : 'Read filtered DOM (full)',
    };

    const descFn = descriptions[type];
    return descFn ? descFn(value) : `${type}: ${value}`;
}

/**
 * Format commands for export (legacy compatibility)
 */
export function formatCommandsForExport(commands: ParsedCommand[]): string {
    return commands.map(c => `[${c.type}]:${c.value}`).join('\n');
}

/**
 * Parse unified commands (legacy compatibility)
 */
export function parseUnifiedCommands(content: string): any {
    const result = parseAICommands(content);
    return {
        actionTags: result.commands,
        textWithoutCommands: result.textWithoutCommands,
        hasCommands: result.hasCommands,
    };
}

/**
 * Strip all command tags from text for display
 */
export function stripAllCommands(content: string): string {
    const result = parseAICommands(content);
    return result.textWithoutCommands;
}
