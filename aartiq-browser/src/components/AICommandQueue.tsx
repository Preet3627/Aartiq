"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Circle, Loader2, AlertCircle, ChevronRight, ChevronDown, ChevronUp, Zap, Target, Search, Globe, 
  FileText, Camera, ScanLine, MousePointer2, Volume2, Sun, Terminal, Rocket, Languages, 
  Hourglass, Shield, Brain, Download, Code2, Database, Mail, Settings, Monitor,
  Clock, AlertTriangle, Info
} from 'lucide-react';
import { useAppVersion } from '@/lib/useAppVersion';

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
}

interface AICommandQueueProps {
    commands: AICommand[];
    currentCommandIndex: number;
    onCancel?: () => void;
    onStopCurrent?: () => void;
    cancelImmediately?: () => void;
}

const getCategoryIcon = (type: string): React.ReactNode => {
    const categoryIcons: Record<string, React.ReactNode> = {
        navigation: <Globe size={14} />,
        browser: <Monitor size={14} />,
        system: <Settings size={14} />,
        media: <Camera size={14} />,
        automation: <MousePointer2 size={14} />,
        utility: <Zap size={14} />,
        gmail: <Mail size={14} />,
        meta: <Brain size={14} />,
        pdf: <Download size={14} />,
        shell: <Terminal size={14} />,
    };
    return categoryIcons[type] || <Zap size={14} />;
};

const getCategoryColor = (type: string): string => {
    const colors: Record<string, string> = {
        navigation: 'text-blue-400',
        browser: 'text-cyan-400',
        system: 'text-purple-400',
        media: 'text-violet-400',
        automation: 'text-amber-400',
        utility: 'text-green-400',
        gmail: 'text-red-400',
        meta: 'text-indigo-400',
        pdf: 'text-orange-400',
        shell: 'text-red-400',
    };
    return colors[type] || 'text-white/60';
};

const getCategoryBg = (type: string): string => {
    const colors: Record<string, string> = {
        navigation: 'bg-blue-500/20 border-blue-500/30',
        browser: 'bg-cyan-500/20 border-cyan-500/30',
        system: 'bg-purple-500/20 border-purple-500/30',
        media: 'bg-violet-500/20 border-violet-500/30',
        automation: 'bg-amber-500/20 border-amber-500/30',
        utility: 'bg-green-500/20 border-green-500/30',
        gmail: 'bg-red-500/20 border-red-500/30',
        meta: 'bg-indigo-500/20 border-indigo-500/30',
        pdf: 'bg-orange-500/20 border-orange-500/30',
        shell: 'bg-red-500/20 border-red-500/30',
    };
    return colors[type] || 'bg-white/5 border-white/10';
};

const getRiskBadge = (risk?: string) => {
    if (!risk || risk === 'low') return null;
    const badges: Record<string, { color: string; label: string }> = {
        medium: { color: 'bg-yellow-500/30 text-yellow-300 border-yellow-500/20', label: 'MEDIUM' },
        high: { color: 'bg-orange-500/30 text-orange-300 border-orange-500/20', label: 'HIGH' },
        critical: { color: 'bg-red-500/30 text-red-300 border-red-500/20', label: 'CRITICAL' },
    };
    const badge = badges[risk];
    if (!badge) return null;
    return (
        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border ${badge.color}`}>
            {badge.label}
        </span>
    );
};

const getCommandIcon = (type: string) => {
    switch (type) {
        case 'NAVIGATE': return <Globe size={14} />;
        case 'SEARCH': return <Search size={14} />;
        case 'READ_PAGE_CONTENT': return <FileText size={14} />;
        case 'SCREENSHOT_AND_ANALYZE': return <Camera size={14} />;
        case 'OCR_SCREEN':
        case 'OCR_COORDINATES': return <ScanLine size={14} />;
        case 'FIND_AND_CLICK':
        case 'CLICK_ELEMENT':
        case 'CLICK_AT': return <MousePointer2 size={14} />;
        case 'SET_VOLUME': return <Volume2 size={14} />;
        case 'SET_BRIGHTNESS': return <Sun size={14} />;
        case 'SHELL_COMMAND': return <Terminal size={14} />;
        case 'OPEN_APP': return <Rocket size={14} />;
        case 'TRANSLATE': return <Languages size={14} />;
        case 'WEB_SEARCH': return <Globe size={14} />;
        case 'EXPLAIN_CAPABILITIES': return <Zap size={14} />;
        case 'WAIT': return <Hourglass size={14} />;
        case 'THINK': return <Brain size={14} />;
        case 'PLAN': return <Target size={14} />;
        case 'GENERATE_PDF': return <Download size={14} />;
        case 'DOM_SEARCH':
        case 'DOM_READ_FILTERED': return <Database size={14} />;
        case 'GMAIL_*':
        case 'GMAIL_AUTHORIZE':
        case 'GMAIL_LIST_MESSAGES':
        case 'GMAIL_GET_MESSAGE':
        case 'GMAIL_SEND_MESSAGE': return <Mail size={14} />;
        case 'GENERATE_DIAGRAM': return <Code2 size={14} />;
        default: return <Zap size={14} />;
    }
};

const getCommandCategory = (type: string): string => {
    const categories: Record<string, string> = {
        NAVIGATE: 'navigation',
        OPEN_VIEW: 'navigation',
        GO_BACK: 'navigation',
        GO_FORWARD: 'navigation',
        RELOAD: 'browser',
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
        SHELL_COMMAND: 'shell',
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
        GMAIL_AUTHORIZE: 'gmail',
        GMAIL_LIST_MESSAGES: 'gmail',
        GMAIL_GET_MESSAGE: 'gmail',
        GMAIL_SEND_MESSAGE: 'gmail',
        GMAIL_ADD_LABEL: 'gmail',
    };
    return categories[type] || 'utility';
};

const getCommandLabel = (type: string, value: string) => {
    const labels: Record<string, (v: string) => string> = {
        NAVIGATE: (v) => `Navigate to ${v.startsWith('http') ? new URL(v).hostname : v}`,
        SEARCH: (v) => `Search "${v}"`,
        WEB_SEARCH: (v) => `Web Search: "${v}"`,
        READ_PAGE_CONTENT: () => 'Read page content',
        SCREENSHOT_AND_ANALYZE: () => 'Capture & analyze',
        OCR_SCREEN: (v) => v ? `OCR region: ${v}` : 'OCR screen',
        OCR_COORDINATES: (v) => `OCR: ${v}`,
        FIND_AND_CLICK: (v) => `Find & click "${v.split('|')[0]}"`,
        CLICK_ELEMENT: (v) => `Click: ${v.split('|')[0]}`,
        CLICK_AT: (v) => `Click at: ${v}`,
        SET_VOLUME: (v) => `Volume: ${v}%`,
        SET_BRIGHTNESS: (v) => `Brightness: ${v}%`,
        SHELL_COMMAND: (v) => `Terminal: ${v.substring(0, 30)}${v.length > 30 ? '...' : ''}`,
        OPEN_APP: (v) => `Open: ${v}`,
        TRANSLATE: (v) => `Translate: ${v}`,
        GENERATE_PDF: (v) => `PDF: ${v.split('|')[0] || 'Document'}`,
        EXPLAIN_CAPABILITIES: () => 'Capabilities',
        WAIT: (v) => `Wait ${parseInt(v) / 1000}s`,
        THINK: (v) => `Think: ${v.substring(0, 40)}...`,
        PLAN: (v) => `Plan: ${v.substring(0, 40)}...`,
        DOM_SEARCH: (v) => `DOM Search: ${v}`,
        DOM_READ_FILTERED: (v) => v ? `DOM Read: ${v}` : 'DOM Read (full)',
        RELOAD: () => 'Reload',
        GO_BACK: () => 'Go back',
        GO_FORWARD: () => 'Go forward',
        FILL_FORM: (v) => `Fill: ${v.split('|')[0]}`,
        SCROLL_TO: (v) => `Scroll: ${v}`,
        SET_THEME: (v) => `Theme: ${v}`,
        GENERATE_DIAGRAM: () => 'Diagram',
        SHOW_IMAGE: (v) => `Image: ${v}`,
        SHOW_VIDEO: (v) => `Video: ${v}`,
        OPEN_PDF: (v) => `Open PDF: ${v}`,
        OPEN_MCP_SETTINGS: () => 'MCP Settings',
        OPEN_VIEW: (v) => `View: ${v}`,
        LIST_OPEN_TABS: () => 'List tabs',
        EXTRACT_DATA: (v) => `Extract: ${v}`,
        GMAIL_AUTHORIZE: () => 'Gmail Auth',
        GMAIL_LIST_MESSAGES: (v) => `Emails: ${v}`,
        GMAIL_GET_MESSAGE: (v) => `Email: ${v.substring(0, 20)}...`,
        GMAIL_SEND_MESSAGE: (v) => `Send: ${v.split('|')[0]}`,
        GMAIL_ADD_LABEL: () => 'Label',
    };
    try {
        return labels[type] ? labels[type](value) : `${type}: ${value}`;
    } catch {
        return `${type}: ${value}`;
    }
};

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function CommandStepItem({ 
    command, 
    index, 
    isActive, 
    isPast, 
    isExpanded, 
    onToggleExpand 
}: { 
    command: AICommand; 
    index: number; 
    isActive: boolean; 
    isPast: boolean; 
    isExpanded: boolean; 
    onToggleExpand: () => void;
}) {
    const category = command.category || getCommandCategory(command.type);
    const categoryBg = getCategoryBg(category);
    const categoryColor = getCategoryColor(category);
    const duration = command.startTime && command.endTime 
        ? command.endTime - command.startTime 
        : command.startTime && command.status === 'executing' 
            ? Date.now() - command.startTime 
            : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group rounded-2xl mb-1 transition-all duration-300 border overflow-hidden ${
                isActive 
                    ? categoryBg
                    : isPast 
                        ? 'bg-transparent border-transparent opacity-50' 
                        : 'bg-transparent border-transparent opacity-70'
            }`}
        >
            <div 
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={onToggleExpand}
            >
                {/* Status Icon */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 ${
                    command.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    command.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    command.status === 'awaiting_permission' ? 'bg-amber-500/20 text-amber-400' :
                    isActive ? 'bg-sky-500/20 text-sky-400' :
                    'bg-white/5 text-white/30'
                }`}>
                    {command.status === 'completed' ? <CheckCircle2 size={13} /> :
                     command.status === 'failed' ? <AlertCircle size={13} /> :
                     command.status === 'awaiting_permission' ? <Shield size={13} /> :
                     isActive ? <Loader2 size={13} className="animate-spin" /> :
                     <Circle size={13} />}
                </div>

                {/* Category Icon */}
                <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-500 ${categoryBg} ${categoryColor}`}>
                    {getCategoryIcon(category)}
                </div>

                {/* Info Column */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold leading-tight truncate transition-colors ${isActive ? 'text-white' : isPast ? 'text-white/40' : 'text-white/60'}`}>
                            {getCommandLabel(command.type, command.value)}
                        </span>
                        {getRiskBadge(command.riskLevel)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-white/10 text-white/50' : 'bg-white/5 text-white/25'}`}>
                            {command.type}
                        </span>
                        {duration !== null && (
                            <span className="text-[8px] font-mono text-white/30 flex items-center gap-1">
                                <Clock size={8} />
                                {formatDuration(duration)}
                            </span>
                        )}
                        {command.status === 'awaiting_permission' && (
                            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">waiting for approval</span>
                        )}
                    </div>
                </div>

                {/* Expand/Collapse */}
                {(command.output || command.error) && (
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="flex-shrink-0 text-white/20"
                    >
                        <ChevronDown size={14} />
                    </motion.div>
                )}
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-3 space-y-2">
                            {/* Reason */}
                            {command.reason && (
                                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                                    <Info size={10} className="text-sky-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[9px] text-white/40 leading-relaxed">{command.reason}</span>
                                </div>
                            )}

                            {/* Command Output */}
                            {command.output && (
                                <div className={`p-2.5 rounded-lg border font-mono text-[9px] leading-relaxed overflow-hidden ${
                                    command.status === 'completed' 
                                        ? 'bg-green-500/5 border-green-500/10 text-green-300/70' 
                                        : 'bg-sky-500/5 border-sky-500/10 text-sky-300/70'
                                }`}>
                                    <pre className="whitespace-pre-wrap break-all max-h-24 overflow-y-auto modern-scrollbar">
                                        {command.output.length > 500 
                                            ? `${command.output.substring(0, 500)}...` 
                                            : command.output}
                                    </pre>
                                </div>
                            )}

                            {/* Error */}
                            {command.error && (
                                <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 flex items-start gap-2">
                                    <AlertTriangle size={10} className="text-red-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-[9px] text-red-300/80 font-mono leading-relaxed">{command.error}</span>
                                </div>
                            )}

                            {/* Active Progress Bar */}
                            {isActive && command.status === 'executing' && (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            className="h-full bg-sky-400"
                                            initial={{ width: '0%' }}
                                            animate={{ width: '100%' }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export const AICommandQueue: React.FC<AICommandQueueProps> = ({
    commands,
    currentCommandIndex,
    onCancel,
    onStopCurrent,
    cancelImmediately
}) => {
    const version = useAppVersion();
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    const [viewMode, setViewMode] = useState<'visual' | 'json' | 'terminal'>('visual');

    if (commands.length === 0) return null;

    const completedCount = commands.filter(c => c.status === 'completed').length;
    const failedCount = commands.filter(c => c.status === 'failed').length;
    const totalCount = commands.length;

    const toggleExpand = (idx: number) => {
        setExpandedSteps(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            className="absolute bottom-6 left-4 right-4 z-[100] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
            {/* Header with Progress */}
            <div className="px-5 py-4 bg-gradient-to-r from-sky-500/10 to-transparent border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                            <motion.div 
                                className="absolute inset-0 bg-sky-400/50 rounded-full"
                                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Action Chain</h3>
                        <span className="text-[9px] text-white/30 font-mono">v{version}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View Mode Tabs */}
                        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
                            {(['visual', 'json', 'terminal'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded transition-all ${
                                        viewMode === mode ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                                    }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        <div className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-white/40 font-mono border border-white/5">
                            {currentCommandIndex + 1} OF {totalCount}
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-sky-500 to-cyan-400"
                            animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                    <span className="text-[9px] font-mono text-white/30">
                        {completedCount}/{totalCount}
                        {failedCount > 0 && <span className="text-red-400 ml-1">{failedCount} failed</span>}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-h-72 overflow-y-auto modern-scrollbar p-1">
                {viewMode === 'visual' && (
                    <AnimatePresence mode="popLayout">
                        {commands.map((command, index) => (
                            <CommandStepItem
                                key={command.id}
                                command={command}
                                index={index}
                                isActive={index === currentCommandIndex}
                                isPast={index < currentCommandIndex}
                                isExpanded={expandedSteps.has(index)}
                                onToggleExpand={() => toggleExpand(index)}
                            />
                        ))}
                    </AnimatePresence>
                )}

                {viewMode === 'json' && (
                    <div className="p-3">
                        <pre className="text-[8px] text-white/50 font-mono overflow-x-auto max-h-64 overflow-y-auto modern-scrollbar bg-black/40 rounded-xl p-3 border border-white/5">
                            {JSON.stringify(commands.map(cmd => ({
                                type: cmd.type,
                                value: cmd.value,
                                status: cmd.status,
                                category: cmd.category || getCommandCategory(cmd.type),
                                riskLevel: cmd.riskLevel,
                                reason: cmd.reason,
                                duration: cmd.startTime && cmd.endTime ? `${cmd.endTime - cmd.startTime}ms` : null,
                                output: cmd.output ? `${cmd.output.substring(0, 100)}...` : null,
                            })), null, 2)}
                        </pre>
                    </div>
                )}

                {viewMode === 'terminal' && (
                    <div className="p-3 space-y-1">
                        {commands.filter(c => c.output || c.error).map((cmd, idx) => (
                            <div key={idx} className="rounded-lg overflow-hidden border border-white/5">
                                <div className="px-3 py-1.5 bg-white/[0.03] flex items-center gap-2">
                                    <span className="text-[9px] font-mono text-white/40">$</span>
                                    <span className="text-[9px] font-mono text-white/60 truncate">{cmd.value}</span>
                                    {cmd.status === 'completed' && <CheckCircle2 size={10} className="text-green-400 ml-auto" />}
                                    {cmd.status === 'failed' && <AlertCircle size={10} className="text-red-400 ml-auto" />}
                                </div>
                                {(cmd.output || cmd.error) && (
                                    <div className="px-3 py-2 bg-black/40 text-[8px] font-mono text-white/40 max-h-16 overflow-y-auto modern-scrollbar">
                                        {cmd.error || cmd.output}
                                    </div>
                                )}
                            </div>
                        ))}
                        {commands.filter(c => c.output || c.error).length === 0 && (
                            <div className="text-center py-6 text-[10px] text-white/20">No command output yet</div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gradient-to-t from-white/5 to-transparent border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {completedCount > 0 && (
                        <span className="text-[9px] font-bold text-green-400 flex items-center gap-1">
                            <CheckCircle2 size={10} /> {completedCount} completed
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {onStopCurrent && (
                        <button
                            onClick={onStopCurrent}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-amber-500/20 active:scale-95"
                        >
                            Stop After Current
                        </button>
                    )}
                    {cancelImmediately && (
                        <button
                            onClick={cancelImmediately}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-red-500/20 active:scale-95"
                        >
                            Cancel Now
                        </button>
                    )}
                    {onCancel && !onStopCurrent && (
                        <button
                            onClick={onCancel}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-red-500/20 active:scale-95"
                        >
                            Abort
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
