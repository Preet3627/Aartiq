"use client";

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Code2,
    FileText,
    Globe,
    Loader2,
    MousePointer2,
    PauseCircle,
    Shield,
    Sparkles,
    Square,
    Terminal,
    X,
    Zap,
} from 'lucide-react';

export interface AICommand {
    id: string;
    type: string;
    value: string;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'awaiting_permission' | 'idle';
    output?: string;
    error?: string;
    context?: string;
    timestamp: number;
    startTime?: number;
    endTime?: number;
    category?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    reason?: string;
    jsonFormat?: object;
    params?: Record<string, any>;
}

interface AICommandQueueProps {
    commands: AICommand[];
    currentCommandIndex: number;
    onCancel?: () => void;
    onStopCurrent?: () => void;
    cancelImmediately?: () => void;
}

type CommandGroup = 'filesystem' | 'browser' | 'automation' | 'system' | 'document' | 'intelligence';

const isDeveloperMode = process.env.NODE_ENV !== 'production';

const commandGroup = (type: string): CommandGroup => {
    if (type === 'SHELL_COMMAND' || type.includes('FILE') || type.includes('PDF')) return 'filesystem';
    if (type.includes('SEARCH') || type.includes('NAVIGATE') || type.includes('READ') || type.includes('DOM')) return 'browser';
    if (type.includes('CLICK') || type.includes('FORM') || type.includes('SCROLL')) return 'automation';
    if (type.includes('VOLUME') || type.includes('BRIGHTNESS') || type.includes('APP') || type.includes('THEME')) return 'system';
    if (type.includes('PDF') || type.includes('DIAGRAM') || type.includes('OCR') || type.includes('SCREENSHOT')) return 'document';
    return 'intelligence';
};

const groupLabel: Record<CommandGroup, string> = {
    filesystem: 'Filesystem',
    browser: 'Browser',
    automation: 'Automation',
    system: 'System',
    document: 'Document',
    intelligence: 'Intelligence',
};

const groupIcon: Record<CommandGroup, React.ReactNode> = {
    filesystem: <FileText size={14} />,
    browser: <Globe size={14} />,
    automation: <MousePointer2 size={14} />,
    system: <Zap size={14} />,
    document: <Code2 size={14} />,
    intelligence: <Sparkles size={14} />,
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const formatTimestamp = (ms: number): string => {
    const date = new Date(ms);
    const h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m}:${s} ${ampm}`;
};

const elapsedForCommand = (command: AICommand): string | null => {
    if (command.startTime && command.endTime) return formatDuration(command.endTime - command.startTime);
    if (command.startTime && command.status === 'executing') return formatDuration(Date.now() - command.startTime);
    return null;
};

const shellSummary = (command: string): string => {
    const lower = command.toLowerCase().trim();
    if (/find\b/.test(lower) && /(md5|sha|hash)/.test(lower)) return 'Calculating file hashes';
    if (/find\b/.test(lower) && /(duplicate|uniq|sort)/.test(lower)) return 'Finding duplicate files';
    if (/find\b/.test(lower)) return 'Scanning files';
    if (/ls\b/.test(lower)) return 'Reading folder contents';
    if (/du\b/.test(lower)) return 'Measuring disk usage';
    if (/grep|rg\b/.test(lower)) return 'Searching file contents';
    if (/mkdir\b/.test(lower)) return 'Creating folder';
    if (/mv\b/.test(lower)) return 'Moving files';
    if (/cp\b/.test(lower)) return 'Copying files';
    if (/rm\b/.test(lower)) return 'Removing files';
    if (/curl|wget/.test(lower)) return 'Fetching network data';
    if (/python|node|osascript|powershell/.test(lower)) return 'Running script';
    return 'Running command';
};

const commandLabel = (command: AICommand): string => {
    const value = command.value || '';
    switch (command.type) {
        case 'SHELL_COMMAND':
            return shellSummary(value);
        case 'WEB_SEARCH':
        case 'SEARCH':
            return `Searching ${value.replace(/^["']|["']$/g, '').slice(0, 80)}`;
        case 'NAVIGATE':
            return `Opening ${value.slice(0, 80)}`;
        case 'READ_PAGE_CONTENT':
            return 'Reading current page';
        case 'CLICK_ELEMENT':
            return 'Clicking page element';
        case 'CLICK_AT':
            return 'Clicking screen point';
        case 'FIND_AND_CLICK':
            return `Finding ${value.split('|')[0].slice(0, 80)}`;
        case 'FILL_FORM':
            return 'Filling form field';
        case 'SCROLL_TO':
            return 'Scrolling page';
        case 'OCR_SCREEN':
        case 'OCR_COORDINATES':
            return 'Reading screen text';
        case 'SCREENSHOT_AND_ANALYZE':
            return 'Analyzing screenshot';
        case 'GENERATE_PDF':
            return 'Creating PDF';
        case 'WAIT':
            return 'Waiting';
        case 'THINK':
        case 'PLAN':
            return 'Planning actions';
        default:
            return command.type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
    }
};

const outputSummary = (command: AICommand): string | null => {
    if (command.error) return command.error;
    if (!command.output) return null;
    const output = command.output.trim();
    if (!output || output === 'completed') return 'Completed successfully';
    if (command.type === 'SHELL_COMMAND') {
        if (/no such file|not found|permission denied/i.test(output)) return output.split('\n')[0];
        if (output.length === 0) return 'Completed with no output';
        const lineCount = output.split('\n').filter(Boolean).length;
        if (lineCount > 1) return `${lineCount} result lines`;
    }
    return output.length > 120 ? `${output.slice(0, 120)}...` : output;
};

function StatusMark({ status }: { status: AICommand['status'] }) {
    if (status === 'completed') return <CheckCircle2 size={15} className="text-emerald-500" />;
    if (status === 'failed') return <AlertCircle size={15} className="text-red-500" />;
    if (status === 'awaiting_permission') return <Shield size={15} className="text-amber-500" />;
    if (status === 'executing') return <Loader2 size={15} className="animate-spin text-[var(--accent)]" />;
    return <span className="h-2 w-2 rounded-full bg-current text-secondary-text/40" />;
}

function Timeline({ commands, currentCommandIndex }: { commands: AICommand[]; currentCommandIndex: number }) {
    return (
        <div className="relative ml-1" role="list" aria-label="Execution timeline">
            {commands.map((command, index) => {
                const isActive = index === currentCommandIndex && ['executing', 'awaiting_permission'].includes(command.status);
                const isLast = index === commands.length - 1;
                const elapsed = elapsedForCommand(command);
                const timestamp = command.startTime || command.timestamp;
                return (
                    <motion.div
                        key={command.id}
                        layout
                        role="listitem"
                        className="relative flex items-start gap-3 pb-3"
                    >
                        {/* Connector line */}
                        {!isLast && (
                            <div className="absolute left-[7px] top-5 h-full w-px bg-[color-mix(in_srgb,var(--border-color)_50%,transparent)]" />
                        )}

                        {/* Status dot */}
                        <div className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                            <StatusMark status={command.status} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                                <span className={`truncate text-[13px] font-medium ${isActive ? 'text-primary-text' : command.status === 'completed' ? 'text-secondary-text' : 'text-primary-text'}`}>
                                    {commandLabel(command)}
                                </span>
                                {elapsed && (
                                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--primary-text)_6%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-secondary-text/80">
                                        {elapsed}
                                    </span>
                                )}
                            </div>
                            {timestamp && (
                                <div className="mt-0.5 text-[11px] text-secondary-text/60">
                                    {formatTimestamp(timestamp)}
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

function CommandCard({ command, onToggle, isOpen }: { command: AICommand; onToggle: () => void; isOpen: boolean }) {
    const group = commandGroup(command.type);
    const summary = outputSummary(command);
    const risk = command.riskLevel || 'low';
    const permissionLabel = risk === 'high' ? 'Touch ID + approval' : risk === 'medium' ? 'Approval required' : 'Automatic';
    const riskColor = risk === 'high' ? 'text-red-500 bg-red-500/10 border-red-500/20'
        : risk === 'medium' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';

    const isFileOp = command.type.includes('FILE') || command.type === 'SHELL_COMMAND';
    const isNetworkOp = command.type.includes('SEARCH') || command.type.includes('NAVIGATE') || command.type.includes('READ');
    const dataAccessed = isFileOp ? 'Local filesystem' : isNetworkOp ? 'Web / network' : 'Browser state';
    const undoable = command.type === 'NAVIGATE' || command.type === 'READ_PAGE_CONTENT' || command.type === 'OPEN_VIEW'
        ? 'Yes (navigation only)'
        : command.type === 'SHELL_COMMAND' ? 'Depends on command'
        : 'No (review before approving)';

    return (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--border-color)_45%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_82%,transparent)]">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
                aria-expanded={isOpen}
            >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--primary-text)_7%,transparent)] text-secondary-text">
                    {groupIcon[group]}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-secondary-text">{groupLabel[group]}</span>
                    <span className="block truncate text-[13px] text-primary-text">{commandLabel(command)}</span>
                </span>
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${riskColor}`}>
                    {risk}
                </span>
                <span className="shrink-0"><StatusMark status={command.status} /></span>
                {(command.output || command.error || command.reason || isDeveloperMode) && (
                    <ChevronDown size={15} className={`shrink-0 text-secondary-text transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-2 px-3 pb-3">
                            {summary && (
                                <div className="rounded-md bg-[color-mix(in_srgb,var(--primary-text)_5%,transparent)] px-3 py-2 text-[12px] leading-relaxed text-secondary-text">
                                    {summary}
                                </div>
                            )}
                            {command.reason && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-secondary-text/60 mb-0.5">Why</div>
                                    <p className="text-[12px] leading-relaxed text-secondary-text">{command.reason}</p>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-secondary-text">
                                <div><span className="font-medium text-secondary-text/70">Data: </span>{dataAccessed}</div>
                                <div><span className="font-medium text-secondary-text/70">Undoable: </span>{undoable}</div>
                                <div><span className="font-medium text-secondary-text/70">Risk: </span><span className={risk === 'high' ? 'text-red-500' : risk === 'medium' ? 'text-amber-500' : 'text-emerald-500'}>{risk}</span></div>
                                <div><span className="font-medium text-secondary-text/70">Permission: </span>{permissionLabel}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExpandableTechnicalDetails({ commands }: { commands: AICommand[] }) {
    const [open, setOpen] = useState(false);
    if (!isDeveloperMode) return null;

    return (
        <div className="border-t border-[color-mix(in_srgb,var(--border-color)_45%,transparent)]">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between px-4 py-3 text-[12px] text-secondary-text hover:text-primary-text"
                aria-expanded={open}
            >
                <span className="flex items-center gap-2"><Terminal size={13} /> Developer details</span>
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="max-h-72 space-y-3 overflow-y-auto px-4 pb-4 font-mono text-[11px] text-secondary-text">
                            {commands.map((command) => (
                                <div key={command.id} className="rounded-md bg-black/30 p-3">
                                    <div className="mb-2 grid grid-cols-[80px_1fr] gap-2">
                                        <span>Type</span><span>{command.type}</span>
                                        <span>Status</span><span>{command.status}</span>
                                        <span>Duration</span><span>{elapsedForCommand(command) || 'n/a'}</span>
                                        <span>Command</span><span className="break-all">{command.value || 'n/a'}</span>
                                    </div>
                                    {(command.output || command.error) && (
                                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2">
                                            {command.error || command.output}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ResultCard({ commands }: { commands: AICommand[] }) {
    const completed = commands.filter((command) => command.status === 'completed').length;
    const failed = commands.filter((command) => command.status === 'failed').length;
    if (completed === 0 && failed === 0) return null;

    return (
        <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-[color-mix(in_srgb,var(--primary-text)_5%,transparent)] px-3 py-2">
                <div className="text-[11px] text-secondary-text">Completed</div>
                <div className="text-sm font-semibold text-primary-text">{completed}</div>
            </div>
            <div className="rounded-md bg-[color-mix(in_srgb,var(--primary-text)_5%,transparent)] px-3 py-2">
                <div className="text-[11px] text-secondary-text">Failed</div>
                <div className="text-sm font-semibold text-primary-text">{failed}</div>
            </div>
            <div className="rounded-md bg-[color-mix(in_srgb,var(--primary-text)_5%,transparent)] px-3 py-2">
                <div className="text-[11px] text-secondary-text">Total</div>
                <div className="text-sm font-semibold text-primary-text">{commands.length}</div>
            </div>
        </div>
    );
}

function ExecutionCard({ commands, currentCommandIndex, onStopCurrent, cancelImmediately, onCancel }: AICommandQueueProps) {
    const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
    const completedCount = commands.filter((command) => command.status === 'completed').length;
    const failedCount = commands.filter((command) => command.status === 'failed').length;
    const awaitingPermission = commands.some((command) => command.status === 'awaiting_permission');
    const running = commands.some((command) => command.status === 'executing' || command.status === 'awaiting_permission');
    const progress = commands.length ? ((completedCount + failedCount) / commands.length) * 100 : 0;
    const title = useMemo(() => {
        const active = commands[currentCommandIndex] || commands[0];
        if (!active) return 'Working';
        return commandLabel(active);
    }, [commands, currentCommandIndex]);

    const toggleCommand = (id: string) => {
        setExpandedCommands((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute bottom-24 left-4 right-4 z-[100] overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_94%,transparent)] shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
            role="status"
            aria-live="polite"
        >
            <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2 text-[12px] text-secondary-text">
                            {running ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            <span>{awaitingPermission ? 'Waiting for approval' : running ? 'Executing' : 'Completed'}</span>
                        </div>
                        <h3 className="truncate text-[14px] font-semibold text-primary-text">{title}</h3>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {onStopCurrent && running && (
                            <button
                                type="button"
                                onClick={onStopCurrent}
                                className="rounded-md p-2 text-secondary-text hover:bg-[color-mix(in_srgb,var(--primary-text)_8%,transparent)] hover:text-primary-text"
                                title="Stop after current step"
                            >
                                <PauseCircle size={15} />
                            </button>
                        )}
                        {cancelImmediately && running && (
                            <button
                                type="button"
                                onClick={cancelImmediately}
                                className="rounded-md p-2 text-red-500 hover:bg-red-500/10"
                                title="Cancel now"
                            >
                                <Square size={14} />
                            </button>
                        )}
                        {onCancel && !onStopCurrent && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="rounded-md p-2 text-red-500 hover:bg-red-500/10"
                                title="Cancel automation"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-4 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary-text)_8%,transparent)]">
                    <motion.div
                        className="h-full rounded-full bg-[var(--accent)]"
                        animate={{ width: `${Math.max(progress, running ? 8 : 0)}%` }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    />
                </div>

                <div className="space-y-4">
                    <Timeline commands={commands} currentCommandIndex={currentCommandIndex} />
                    <ResultCard commands={commands} />
                    <div className="space-y-2">
                        {commands.map((command) => (
                            <CommandCard
                                key={command.id}
                                command={command}
                                isOpen={expandedCommands.has(command.id)}
                                onToggle={() => toggleCommand(command.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <ExpandableTechnicalDetails commands={commands} />
        </motion.div>
    );
}

export const AICommandQueue: React.FC<AICommandQueueProps> = (props) => {
    if (props.commands.length === 0) return null;
    return <ExecutionCard {...props} />;
};
