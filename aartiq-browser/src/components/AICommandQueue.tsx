"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, Circle, Loader2, AlertCircle, ChevronRight, Zap, Target, Search, Globe, 
  FileText, Camera, ScanLine, MousePointer2, Volume2, Sun, Terminal, Rocket, Languages, 
  Hourglass, Shield, Brain, Download, Code2, Database, Mail, Settings, Monitor
} from 'lucide-react';
import { useAppVersion } from '@/lib/useAppVersion';

export interface AICommand {
    id: string;
    type: string;
    value: string;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'awaiting_permission';
    output?: string;
    error?: string;
    context?: string;
    timestamp: number;
    category?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    reason?: string;
    jsonFormat?: object;
}

interface AICommandQueueProps {
    commands: AICommand[];
    currentCommandIndex: number;
    onCancel?: () => void;
}

const getCategoryIcon = (type: string): React.ReactNode => {
    const categoryIcons: Record<string, React.ReactNode> = {
        navigation: <Globe size={16} />,
        browser: <Monitor size={16} />,
        system: <Settings size={16} />,
        media: <Camera size={16} />,
        automation: <MousePointer2 size={16} />,
        utility: <Zap size={16} />,
        gmail: <Mail size={16} />,
        meta: <Brain size={16} />,
        pdf: <Download size={16} />,
        shell: <Terminal size={16} />,
    };
    return categoryIcons[type] || <Zap size={16} />;
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
        medium: { color: 'bg-yellow-500/30 text-yellow-300', label: 'MEDIUM' },
        high: { color: 'bg-orange-500/30 text-orange-300', label: 'HIGH' },
        critical: { color: 'bg-red-500/30 text-red-300', label: 'CRITICAL' },
    };
    const badge = badges[risk];
    if (!badge) return null;
    return (
        <span className={`px-1.5 py-0.5 text-[8px] font-black rounded ${badge.color}`}>
            {badge.label}
        </span>
    );
};

const getCommandIcon = (type: string) => {
    switch (type) {
        case 'NAVIGATE': return <Globe size={16} />;
        case 'SEARCH': return <Search size={16} />;
        case 'READ_PAGE_CONTENT': return <FileText size={16} />;
        case 'SCREENSHOT_AND_ANALYZE': return <Camera size={16} />;
        case 'OCR_SCREEN':
        case 'OCR_COORDINATES': return <ScanLine size={16} />;
        case 'FIND_AND_CLICK':
        case 'CLICK_ELEMENT':
        case 'CLICK_AT': return <MousePointer2 size={16} />;
        case 'SET_VOLUME': return <Volume2 size={16} />;
        case 'SET_BRIGHTNESS': return <Sun size={16} />;
        case 'SHELL_COMMAND': return <Terminal size={16} />;
        case 'OPEN_APP': return <Rocket size={16} />;
        case 'TRANSLATE': return <Languages size={16} />;
        case 'WEB_SEARCH': return <Globe size={16} />;
        case 'EXPLAIN_CAPABILITIES': return <Zap size={16} />;
        case 'WAIT': return <Hourglass size={16} />;
        case 'THINK': return <Brain size={16} />;
        case 'PLAN': return <Target size={16} />;
        case 'GENERATE_PDF': return <Download size={16} />;
        case 'DOM_SEARCH':
        case 'DOM_READ_FILTERED': return <Database size={16} />;
        case 'GMAIL_*':
        case 'GMAIL_AUTHORIZE':
        case 'GMAIL_LIST_MESSAGES':
        case 'GMAIL_GET_MESSAGE':
        case 'GMAIL_SEND_MESSAGE': return <Mail size={16} />;
        case 'GENERATE_DIAGRAM': return <Code2 size={16} />;
        default: return <Zap size={16} />;
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
        SHELL_COMMAND: (v) => `Terminal: ${v.substring(0, 30)}...`,
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

export const AICommandQueue: React.FC<AICommandQueueProps> = ({
    commands,
    currentCommandIndex,
    onCancel
}) => {
    const version = useAppVersion();
    if (commands.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            className="absolute bottom-6 left-4 right-4 z-[100] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
            {/* Glossy Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-sky-500/10 to-transparent border-b border-white/5 flex items-center justify-between">
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
                    <span className="text-[9px] text-white/30 font-mono">v{version} JSON</span>
                </div>
                <div className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-white/40 font-mono border border-white/5">
                    {currentCommandIndex + 1} OF {commands.length}
                </div>
            </div>

            {/* Command List */}
            <div className="max-h-72 overflow-y-auto modern-scrollbar p-1">
                <AnimatePresence mode="popLayout">
                    {commands.map((command, index) => {
                        const isActive = index === currentCommandIndex;
                        const isPast = index < currentCommandIndex;
                        const category = command.category || getCommandCategory(command.type);
                        const categoryBg = getCategoryBg(category);
                        const categoryColor = getCategoryColor(category);

                        return (
                            <motion.div
                                key={command.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`group px-4 py-3.5 rounded-2xl mb-1 transition-all duration-300 border ${isActive 
                                    ? categoryBg
                                    : isPast 
                                        ? 'bg-transparent border-transparent opacity-40' 
                                        : 'bg-transparent border-transparent opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    {/* Category Icon */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${categoryBg} ${categoryColor}`}>
                                        {getCategoryIcon(category)}
                                    </div>

                                    {/* Info Column */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-bold leading-tight truncate transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                                {getCommandLabel(command.type, command.value)}
                                            </span>
                                            {getRiskBadge(command.riskLevel)}
                                        </div>

                                        {/* Command Type Badge */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 ${isActive ? 'text-white/60' : 'text-white/30'}`}>
                                                {command.type}
                                            </span>
                                            {command.category && (
                                                <span className={`text-[8px] font-mono uppercase tracking-wider ${categoryColor}`}>
                                                    {category}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Command Output / Results */}
                                        {command.output && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                className={`mt-2 p-2 rounded-lg bg-black/40 border border-white/5 text-[9px] font-mono leading-relaxed overflow-hidden ${
                                                    isActive ? 'text-sky-300' : 'text-sky-300/40'
                                                }`}
                                            >
                                                <pre className="whitespace-pre-wrap break-all">
                                                    {command.output.length > 200 
                                                        ? `${command.output.substring(0, 200)}...` 
                                                        : command.output}
                                                </pre>
                                            </motion.div>
                                        )}

                                        {/* Active indicator */}
                                        {isActive && !command.output && (
                                            <div className="mt-1.5 flex items-center gap-2">
                                                <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-sky-400"
                                                        initial={{ width: '0%' }}
                                                        animate={{ width: '100%' }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Error */}
                                        {command.error && isActive && (
                                            <div className="text-[9px] text-red-400 font-medium mt-1">
                                                Error: {command.error}
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Icon */}
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                        command.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                        command.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                        command.status === 'awaiting_permission' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-white/5 text-white/40'
                                    }`}>
                                        {command.status === 'completed' ? <CheckCircle2 size={14} /> :
                                         command.status === 'failed' ? <AlertCircle size={14} /> :
                                         command.status === 'awaiting_permission' ? <Shield size={14} /> :
                                         <Loader2 size={14} className="animate-spin" />}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* JSON Format Toggle (optional display) */}
            <div className="px-4 py-2 bg-gradient-to-t from-white/5 to-transparent border-t border-white/5">
                <details className="text-[9px]">
                    <summary className="cursor-pointer text-white/30 hover:text-white/50 font-mono uppercase tracking-widest">
                        View JSON Format
                    </summary>
                    <pre className="mt-2 p-2 bg-black/40 rounded-lg text-[8px] text-white/50 font-mono overflow-x-auto max-h-32">
                        {JSON.stringify(commands.map(cmd => ({
                            type: cmd.type,
                            value: cmd.value,
                            status: cmd.status,
                            category: cmd.category || getCommandCategory(cmd.type),
                            riskLevel: cmd.riskLevel
                        })), null, 2)}
                    </pre>
                </details>
            </div>

            {/* Glassy Footer */}
            {onCancel && (
                <div className="p-4 bg-gradient-to-t from-white/5 to-transparent border-t border-white/5">
                    <button
                        onClick={onCancel}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 active:scale-95"
                    >
                        Abort Sequence
                    </button>
                </div>
            )}
        </motion.div>
    );
};
