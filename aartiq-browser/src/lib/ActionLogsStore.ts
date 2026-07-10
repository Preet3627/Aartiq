/**
 * Action & Export Logs Store
 * Manages separate logs for PDF generation, action tags, and shell commands
 * These logs are shown in export but separated from main chat
 */

import type { PDFCommand } from './PDFCommandParser';
import type { ActionTag } from './ActionTagParser';
import type { ShellCommand } from './ShellCommandParser';

export type ActionLogType = 'pdf' | 'action' | 'shell' | 'ocr' | 'dom';

export interface BaseActionLog {
    id: string;
    type: ActionLogType;
    timestamp: number;
    success: boolean;
    output?: string;
    error?: string;
}

export interface PDFActionLog extends BaseActionLog {
    type: 'pdf';
    command: PDFCommand;
    filePath?: string;
    fileName?: string;
}

export interface ActionTagLog extends BaseActionLog {
    type: 'action';
    command: ActionTag;
    permissionRequired?: 'low' | 'medium' | 'high';
    permissionGranted?: boolean;
}

export interface ShellCommandLog extends BaseActionLog {
    type: 'shell';
    command: ShellCommand;
    permissionRequired: boolean;
    permissionGranted?: boolean;
    executionTime?: number;
}

export interface OCRExtractionLog extends BaseActionLog {
    type: 'ocr';
    label: string;
    textLength: number;
    source: 'screenshot' | 'page' | 'dom';
    imageBase64?: string;
}

export interface DOMExtractionLog extends BaseActionLog {
    type: 'dom';
    query?: string;
    resultsCount: number;
    contentLength: number;
    injectionDetected: boolean;
    filterStats?: {
        piiRemoved: number;
        scriptsRemoved: number;
        stylesRemoved: number;
        navRemoved: number;
        adsRemoved: number;
    };
}

export type ActionLog = PDFActionLog | ActionTagLog | ShellCommandLog | OCRExtractionLog | DOMExtractionLog;

export interface ActionLogsState {
    logs: ActionLog[];
    pdfLogs: PDFActionLog[];
    actionLogs: ActionTagLog[];
    shellLogs: ShellCommandLog[];
    ocrLogs: OCRExtractionLog[];
    domLogs: DOMExtractionLog[];
}

class ActionLogsStore {
    private logs: ActionLog[] = [];
    private maxLogs = 100;

    private generateLogId(): string {
        return `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // PDF Logs
    addPDFLog(
        command: PDFCommand,
        success: boolean,
        output?: string,
        error?: string,
        filePath?: string,
        fileName?: string
    ): PDFActionLog {
        const log: PDFActionLog = {
            id: this.generateLogId(),
            type: 'pdf',
            timestamp: Date.now(),
            success,
            output,
            error,
            command,
            filePath,
            fileName,
        };
        this.logs.push(log);
        this.trimLogs();
        this.persistToStorage();
        return log;
    }

    // Action Tag Logs
    addActionLog(
        command: ActionTag,
        success: boolean,
        output?: string,
        error?: string,
        permissionGranted?: boolean
    ): ActionTagLog {
        const log: ActionTagLog = {
            id: this.generateLogId(),
            type: 'action',
            timestamp: Date.now(),
            success,
            output,
            error,
            command,
            permissionRequired: (command.category === 'system' || command.category === 'automation') ? 'medium' as const : 'low' as const,
            permissionGranted,
        };
        this.logs.push(log);
        this.trimLogs();
        this.persistToStorage();
        return log;
    }

    // Shell Command Logs
    addShellLog(
        command: ShellCommand,
        success: boolean,
        output?: string,
        error?: string,
        permissionGranted?: boolean,
        executionTime?: number
    ): ShellCommandLog {
        const log: ShellCommandLog = {
            id: this.generateLogId(),
            type: 'shell',
            timestamp: Date.now(),
            success,
            output,
            error,
            command,
            permissionRequired: command.requiresPermission,
            permissionGranted,
            executionTime,
        };
        this.logs.push(log);
        this.trimLogs();
        this.persistToStorage();
        return log;
    }

    // OCR Logs
    addOCRFLog(
        label: string,
        success: boolean,
        text: string,
        source: 'screenshot' | 'page' | 'dom',
        error?: string,
        imageBase64?: string
    ): OCRExtractionLog {
        const log: OCRExtractionLog = {
            id: this.generateLogId(),
            type: 'ocr',
            timestamp: Date.now(),
            success,
            output: text.substring(0, 500),
            error,
            label,
            textLength: text.length,
            source,
            imageBase64,
        };
        this.logs.push(log);
        this.trimLogs();
        this.persistToStorage();
        return log;
    }

    // DOM Extraction Logs
    addDOMLog(
        success: boolean,
        query: string | undefined,
        resultsCount: number,
        contentLength: number,
        injectionDetected: boolean,
        error?: string,
        filterStats?: OCRExtractionLog['type'] extends 'dom' ? DOMExtractionLog['filterStats'] : never
    ): DOMExtractionLog {
        const log: DOMExtractionLog = {
            id: this.generateLogId(),
            type: 'dom',
            timestamp: Date.now(),
            success,
            output: `Found ${resultsCount} results, ${contentLength} chars`,
            error,
            query,
            resultsCount,
            contentLength,
            injectionDetected,
            filterStats,
        };
        this.logs.push(log);
        this.trimLogs();
        this.persistToStorage();
        return log;
    }

    // Getters
    getAllLogs(): ActionLog[] {
        return [...this.logs];
    }

    getLogsByType(type: ActionLogType): ActionLog[] {
        return this.logs.filter(log => log.type === type);
    }

    getPDFLogs(): PDFActionLog[] {
        return this.logs.filter((log): log is PDFActionLog => log.type === 'pdf');
    }

    getActionLogs(): ActionTagLog[] {
        return this.logs.filter((log): log is ActionTagLog => log.type === 'action');
    }

    getShellLogs(): ShellCommandLog[] {
        return this.logs.filter((log): log is ShellCommandLog => log.type === 'shell');
    }

    getOCRLogs(): OCRExtractionLog[] {
        return this.logs.filter((log): log is OCRExtractionLog => log.type === 'ocr');
    }

    getDOMLogs(): DOMExtractionLog[] {
        return this.logs.filter((log): log is DOMExtractionLog => log.type === 'dom');
    }

    getRecentLogs(count: number = 10): ActionLog[] {
        return this.logs.slice(-count).reverse();
    }

    getState(): ActionLogsState {
        return {
            logs: this.getAllLogs(),
            pdfLogs: this.getPDFLogs(),
            actionLogs: this.getActionLogs(),
            shellLogs: this.getShellLogs(),
            ocrLogs: this.getOCRLogs(),
            domLogs: this.getDOMLogs(),
        };
    }

    // Clear logs
    clearLogs(): void {
        this.logs = [];
        this.persistToStorage();
    }

    clearLogsByType(type: ActionLogType): void {
        this.logs = this.logs.filter(log => log.type !== type);
        this.persistToStorage();
    }

    // Private helpers
    private trimLogs(): void {
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }

    private persistToStorage(): void {
        try {
            const serialized = JSON.stringify(this.logs);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('aartiq_action_logs', serialized);
            }
        } catch (e) {
            console.warn('[ActionLogsStore] Failed to persist logs:', e);
        }
    }

    loadFromStorage(): void {
        try {
            if (typeof localStorage !== 'undefined') {
                const serialized = localStorage.getItem('aartiq_action_logs');
                if (serialized) {
                    this.logs = JSON.parse(serialized);
                }
            }
        } catch (e) {
            console.warn('[ActionLogsStore] Failed to load logs:', e);
            this.logs = [];
        }
    }

    // Export formatted logs
    exportAsJSON(): string {
        const exportData = {
            type: 'AARTIQ_AI_ACTION_LOGS',
            version: '1.0',
            exportTimestamp: Date.now(),
            exportDate: new Date().toISOString(),
            summary: {
                totalLogs: this.logs.length,
                pdfGenerations: this.getPDFLogs().length,
                actionExecutions: this.getActionLogs().length,
                shellCommands: this.getShellLogs().length,
                ocrExtractions: this.getOCRLogs().length,
                domExtractions: this.getDOMLogs().length,
            },
            logs: this.logs.map(log => {
                switch (log.type) {
                    case 'pdf':
                        return {
                            ...log,
                            command: {
                                type: log.command.type,
                                title: log.command.options.title,
                                subtitle: log.command.options.subtitle,
                                author: log.command.options.author,
                                screenshot: log.command.options.screenshot,
                                timestamp: log.command.timestamp,
                            },
                        };
                    case 'action':
                        return {
                            ...log,
                            command: {
                                type: log.command.type,
                                category: log.command.category,
                                value: log.command.value,
                                permissionRequired: log.permissionRequired,
                            },
                        };
                    case 'shell':
                        return {
                            ...log,
                            command: {
                                command: log.command.command,
                                args: log.command.args,
                                riskLevel: log.command.riskLevel,
                                safe: log.command.safe,
                            },
                            executionTime: log.executionTime,
                        };
                    default:
                        return log;
                }
            }),
        };
        return JSON.stringify(exportData, null, 2);
    }

    exportAsText(): string {
        const lines: string[] = [
            '='.repeat(60),
            'Aartiq Action Logs',
            `Exported: ${new Date().toISOString()}`,
            '='.repeat(60),
            '',
        ];

        const formatLog = (log: ActionLog): string => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const status = log.success ? '[SUCCESS]' : '[FAILED]';

            switch (log.type) {
                case 'pdf':
                    return `[${timestamp}] ${status} PDF: ${log.command.options.title || 'Untitled'}`;
                case 'action':
                    return `[${timestamp}] ${status} ${log.command.type}: ${log.command.value}`;
                case 'shell':
                    return `[${timestamp}] ${status} SHELL: ${log.command.command} ${log.command.args.join(' ')}`;
                case 'ocr':
                    return `[${timestamp}] ${status} OCR (${log.label}): ${log.textLength} chars`;
                case 'dom':
                    return `[${timestamp}] ${status} DOM: ${log.resultsCount} results`;
                default:
                    return `[${timestamp}] ${status} Unknown log type`;
            }
        };

        for (const log of this.logs) {
            lines.push(formatLog(log));
            if (log.output) {
                lines.push(`  Output: ${log.output.substring(0, 200)}${log.output.length > 200 ? '...' : ''}`);
            }
            if (log.error) {
                lines.push(`  Error: ${log.error}`);
            }
        }

        return lines.join('\n');
    }
}

export const actionLogsStore = new ActionLogsStore();
actionLogsStore.loadFromStorage();
