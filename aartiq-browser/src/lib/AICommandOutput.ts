/**
 * AI Command Output System
 * Provides a clean separation between chat and command execution
 * AI outputs commands in special format that are extracted and executed
 */

import type { ParsedCommand } from './AICommandParser';

export interface CommandOutput {
    id: string;
    timestamp: number;
    command: ParsedCommand;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    output?: string;
    error?: string;
}

class AICommandOutput {
    private commands: CommandOutput[] = [];
    private listeners: Set<(commands: CommandOutput[]) => void> = new Set();
    private maxCommands = 50;

    generateId(): string {
        return `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    addCommand(command: ParsedCommand): CommandOutput {
        const cmdOutput: CommandOutput = {
            id: this.generateId(),
            timestamp: Date.now(),
            command,
            status: 'pending',
        };
        
        this.commands.push(cmdOutput);
        
        if (this.commands.length > this.maxCommands) {
            this.commands = this.commands.slice(-this.maxCommands);
        }
        
        this.notifyListeners();
        return cmdOutput;
    }

    addCommands(commands: ParsedCommand[]): CommandOutput[] {
        const outputs = commands.map(c => this.addCommand(c));
        return outputs;
    }

    updateStatus(id: string, status: CommandOutput['status'], output?: string, error?: string): void {
        const cmd = this.commands.find(c => c.id === id);
        if (cmd) {
            cmd.status = status;
            if (output !== undefined) cmd.output = output;
            if (error !== undefined) cmd.error = error;
            this.notifyListeners();
        }
    }

    getCommands(): CommandOutput[] {
        return [...this.commands];
    }

    getPendingCommands(): CommandOutput[] {
        return this.commands.filter(c => c.status === 'pending');
    }

    clearCommands(): void {
        this.commands = [];
        this.notifyListeners();
    }

    clearOldCommands(maxAge: number = 3600000): void {
        const cutoff = Date.now() - maxAge;
        this.commands = this.commands.filter(c => c.timestamp > cutoff);
        this.notifyListeners();
    }

    subscribe(listener: (commands: CommandOutput[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        const commands = this.getCommands();
        this.listeners.forEach(listener => listener(commands));
    }
}

export const aiCommandOutput = new AICommandOutput();

/**
 * Format commands for AI output - uses a special marker format
 */
export function formatCommandsForAIOutput(commands: ParsedCommand[]): string {
    if (commands.length === 0) return '';
    
    const lines: string[] = [];
    lines.push('<!-- AI_COMMANDS_START -->');
    
    for (const cmd of commands) {
        lines.push(`[${cmd.type}]:${cmd.value || ''}`);
    }
    
    lines.push('<!-- AI_COMMANDS_END -->');
    return lines.join('\n');
}

/**
 * Parse commands from AI output
 */
export function parseCommandsFromAIOutput(output: string): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    
    // Find AI_COMMANDS markers
    const startMatch = output.indexOf('<!-- AI_COMMANDS_START -->');
    const endMatch = output.indexOf('<!-- AI_COMMANDS_END -->');
    
    if (startMatch === -1 || endMatch === -1) {
        return commands;
    }
    
    const commandsSection = output.substring(startMatch + 26, endMatch);
    const lines = commandsSection.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Parse [COMMAND]:value format
        const match = trimmed.match(/^\[([A-Z_]+)\]:(.*)$/);
        if (match) {
            commands.push({
                type: match[1],
                value: match[2] || '',
                originalMatch: trimmed,
                index: 0,
                category: getCategoryForCommand(match[1]),
            });
        }
    }
    
    return commands;
}

/**
 * Strip commands from AI output for chat display
 */
export function stripCommandsFromOutput(output: string): string {
    // Remove AI_COMMANDS markers and content
    let result = output.replace(/<!-- AI_COMMANDS_START -->[\s\S]*?<!-- AI_COMMANDS_END -->/g, '');
    
    // Remove JSON blocks that contain commands
    result = result.replace(/```json\s*\n[\s\S]*?"type"\s*:\s*"(PDF|SHELL|ACTION)"[\s\S]*?```/gi, '');
    
    // Remove standalone command JSON blocks
    result = result.replace(/```json\s*\n[\s\S]*?"command"\s*:\s*"[A-Z_]+"[\s\S]*?```/gi, '');
    
    return result.trim();
}

function getCategoryForCommand(type: string): string {
    const categories: Record<string, string> = {
        NAVIGATE: 'navigation',
        SEARCH: 'browser',
        WEB_SEARCH: 'browser',
        READ_PAGE_CONTENT: 'browser',
        LIST_OPEN_TABS: 'browser',
        DOM_SEARCH: 'browser',
        DOM_READ_FILTERED: 'browser',
        EXTRACT_DATA: 'browser',
        CLICK_ELEMENT: 'automation',
        CLICK_AT: 'automation',
        FIND_AND_CLICK: 'automation',
        FILL_FORM: 'automation',
        SCROLL_TO: 'automation',
        SCREENSHOT_AND_ANALYZE: 'media',
        OCR_SCREEN: 'media',
        OCR_COORDINATES: 'media',
        SHOW_IMAGE: 'media',
        SHOW_VIDEO: 'media',
        SHELL_COMMAND: 'system',
        SET_VOLUME: 'system',
        SET_BRIGHTNESS: 'system',
        SET_THEME: 'system',
        OPEN_APP: 'system',

        GENERATE_PDF: 'pdf',
        OPEN_PDF: 'pdf',
        GENERATE_DIAGRAM: 'utility',
        WAIT: 'utility',
        OPEN_MCP_SETTINGS: 'utility',
        THINK: 'meta',
        PLAN: 'meta',
        EXPLAIN_CAPABILITIES: 'meta',
        RELOAD: 'navigation',
        GO_BACK: 'navigation',
        GO_FORWARD: 'navigation',
        OPEN_VIEW: 'navigation',
        GMAIL_AUTHORIZE: 'gmail',
        GMAIL_LIST_MESSAGES: 'gmail',
        GMAIL_GET_MESSAGE: 'gmail',
        GMAIL_SEND_MESSAGE: 'gmail',
        GMAIL_ADD_LABEL: 'gmail',
    };
    
    return categories[type] || 'utility';
}

/**
 * Check if output contains commands
 */
export function hasCommands(output: string): boolean {
    return output.includes('<!-- AI_COMMANDS_START -->') ||
           output.includes('"command"') ||
           output.includes('"type"');
}
