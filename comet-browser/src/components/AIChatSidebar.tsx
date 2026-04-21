"use client";

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import {
  Maximize2, Minimize2, FileText, Download, Wifi, WifiOff, X,
  ChevronLeft, ChevronRight, ChevronDown, Zap, Send, Paperclip,
  ScanLine,
  MoreVertical,
  Sparkles,
  Image as ImageIcon,
  Image,
  Eye, EyeOff, Brain, Search, Loader2, MousePointerClick,
  CheckCircle2, AlertCircle, Layers,
  Share2, CopyIcon, Trash2, Printer, Cpu, Rocket, Camera, Terminal, MoreHorizontal, Play, History, Copy
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import dracula from 'react-syntax-highlighter/dist/cjs/styles/prism/dracula';

// Imported modular components
import ThinkingPanel, { type ThinkingStep } from './ai/ThinkingPanel';
import CollapsibleOCRMessage from './ai/CollapsibleOCRMessage';
import MessageActions from './ai/MessageActions';
import ConversationHistoryPanel, { type Conversation, type ChatMessage } from './ai/ConversationHistoryPanel';
import { useAIActionSecurityManager } from './ai/useAIActionSecurityManager';
import {
  robustJSONParse,
  extractAIReasoning,
  extractOCRResult,
  extractActionChain,
  extractMediaAttachments,
  extractActionCommands
} from './ai/RobustParsers';
import { useAppVersion } from '@/lib/useAppVersion';
import AISetupGuide from './ai/AISetupGuide';
import ThinkingIndicator, { type ThemePreset } from './ThinkingIndicator';
import LLMProviderSettings from './LLMProviderSettings';
import { AICommandQueue, type AICommand } from './AICommandQueue';
import CapabilitiesPanel from './CapabilitiesPanel';
import DOMSearchDisplay, { DOMMetaDisplay } from './ai/DOMSearchDisplay';
import { secureDOMReader, type DOMSearchResult, type FilteredDOMResult, type DOMElement } from './ai/SecureDOMReader';
import { detectSchedulingIntent, type SchedulingIntent } from './ai/SchedulingIntentDetector';
import SchedulingModal from './ai/SchedulingModal';
import MermaidDiagram from './ai/MermaidDiagram';
import FlowchartDiagram from './ai/FlowchartDiagram';
import ChartDiagram from './ai/ChartDiagram';
import { useUIStore } from '@/stores/uiStore';

// Logic & Utils
import {
  getThreatRecord, setThreatRecord, checkThreat, scrubbedContent,
  isFailedPageContent, extractSiteFromContext, buildCleanPDFContent, buildPDFFromJSON,
  lsGet, lsSet, preloadCometIcon, tryGetIconBase64,
  type PDFImage, type PDFActionLog, type PDFOCRData, generateSmartPDF, PDF_ICONS, getIcon
} from './ai/AIUtils';
import {
  COMET_CAPABILITIES, SYSTEM_INSTRUCTIONS, LANGUAGE_MAP, INTERNAL_TAG_RE,
  queryRequiresSearch
} from './ai/AIConstants';
import { useAppStore } from '@/store/useAppStore';
import { BrowserAI } from '@/lib/BrowserAI';
import { Security } from '@/lib/Security';
import { prepareCommandsForExecution, formatCommandsForExport, parseUnifiedCommands, stripAllCommands } from '@/lib/AICommandParser';
import { aiCommandOutput, stripCommandsFromOutput } from '@/lib/AICommandOutput';
import { searchContextStore } from '@/lib/SearchContextStore';
import { actionLogsStore, type ActionLog } from '@/lib/ActionLogsStore';
import { buildFrontendReasoningOptions, type LlmMode } from '@/lib/aiReasoningOptions';
import { getRecommendedGeminiModel } from '@/lib/modelRegistry';
import firebaseService from '@/lib/FirebaseService';
import { selectAIChatSidebarStore } from '@/store/selectors';

// ---------------------------------------------------------------------------
// Types (imported from types.ts)
// ---------------------------------------------------------------------------

import {
  type MediaItem,
  type ExtendedChatMessage,
  type VisualStage,
  type Attachment,
  type RefusedIntent,
  type RefusedIntentRecord,
} from './AIChatSidebar/types';
import {
  areCommandsSettled,
  buildConversationTitle,
  getCommandAttemptSignature,
} from './AIChatSidebar/helpers';

interface AIChatSidebarProps {
  studentMode: boolean;
  toggleStudentMode: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  selectedEngine: string;
  setSelectedEngine: (engine: string) => void;
  theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom';
  setTheme: (theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom') => void;
  backgroundImage: string;
  setBackgroundImage: (imageUrl: string) => void;
  backend: 'firebase' | 'mysql';
  setBackend: (backend: 'firebase' | 'mysql') => void;
  mysqlConfig: any;
  setMysqlConfig: (config: any) => void;
  side?: 'left' | 'right';
  setShowSettings?: (show: boolean) => void;
  setSettingsSection?: (section: string) => void;
  setBrowserDisabled?: (disabled: boolean) => void;
  showSchedulingModal?: boolean;
  setShowSchedulingModal?: (show: boolean) => void;
  schedulingIntent?: SchedulingIntent | null;
  setSchedulingIntent?: (intent: SchedulingIntent | null) => void;
  bridgeOnly?: boolean;
}

const renderMarkdownContent = (content: string) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[rehypeKatex]}
    components={{
      code({ className, children, ...rest }) {
        const match = /language-(\w+)/.exec(className || '');
        const codeContent = String(children).replace(/\n$/, '');

        return match ? (
          <div className="my-5 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
            <SyntaxHighlighter
              style={dracula as any}
              language={match[1]}
              PreTag="div"
              customStyle={{ margin: 0, padding: '1.5rem', fontSize: '11px' }}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        ) : (
          <code className="bg-white/10 px-2 py-0.5 rounded-lg text-[12px] font-mono text-sky-300" {...rest}>
            {children}
          </code>
        );
      }
    }}
  >
    {content}
  </ReactMarkdown>
);

const StreamingMarkdownMessage = memo(function StreamingMarkdownMessage({
  content,
  animate,
}: {
  content: string;
  animate: boolean;
}) {
  const markdownContent = useMemo(() => (
    content ? renderMarkdownContent(content) : null
  ), [content]);

  return (
    <div className="space-y-2">
      {markdownContent}
      {animate ? (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-1.5 rounded-full animate-pulse bg-sky-400/80 shadow-[0_0_10px_rgba(56,189,248,0.35)]"
        />
      ) : null}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const AIChatSidebar: React.FC<AIChatSidebarProps> = (props) => {
  const ACTION_CHAIN_MAX_ITERATIONS = 4;
  const ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS = 2;
  const ACTION_CHAIN_MAX_COMMANDS_PER_PASS = 6;
  const ACTION_CHAIN_MAX_SAME_COMMAND_ATTEMPTS = 2;
  const createMessageId = useCallback((prefix = 'msg') => (
    typeof window !== 'undefined' && window.crypto?.randomUUID
      ? `${prefix}-${window.crypto.randomUUID()}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  ), []);
  const router = useRouter();
  const store = useAppStore(useShallow(selectAIChatSidebarStore));
  const {
    aiProvider, ollamaBaseUrl, ollamaModel, openaiApiKey, localLLMBaseUrl,
    localLLMModel, geminiApiKey, xaiApiKey, anthropicApiKey, groqApiKey,
    hasSeenAiMistakeWarning, askForAiPermission, aiSafetyMode,
    additionalAIInstructions, selectedLanguage, history, tabs, activeTabId,
    currentUrl, sidebarWidth,
    setShowAiMistakeWarning, setActiveView,
    setCurrentUrl, setSidebarWidth, setGeminiModel, setGeminiFlashModel,
    localLlmMode, autoGeminiModelUpdates, geminiModel, geminiFlashModel,
    setTheme: storeSetTheme,
    ollamaModelsList, setOllamaModelsList, setOllamaModel, geminiModel: storeGeminiModel,
    hasSeenNeuralSetup, setHasSeenNeuralSetup,
    openaiModel, anthropicModel, groqModel, xaiModel,
  } = store;
  const appVersion = useAppVersion();
  const versionLabel = `v${appVersion}`;
  const gradientPreset = useUIStore((state) => state.gradientPreset);
  const resolvedTheme = useMemo<'dark' | 'light' | 'vibrant' | 'custom'>(() => {
    if (props.theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    }
    return props.theme;
  }, [props.theme]);
  const isLightTheme = resolvedTheme === 'light';
  const sidebarShellStyle = {
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--navbar-bg) 75%, transparent), color-mix(in srgb, var(--primary-bg) 88%, transparent))',
    borderColor: 'color-mix(in srgb, var(--border-color) 40%, transparent)',
    color: 'var(--primary-text)',
    backdropFilter: 'blur(24px)',
    boxShadow: isLightTheme ? '0 6px 30px color-mix(in srgb, var(--shadow-color) 40%, transparent)' : '0 18px 60px color-mix(in srgb, var(--shadow-color) 55%, transparent)',
  } as React.CSSProperties;
  const softPanelStyle = {
    background: 'color-mix(in srgb, var(--card-bg) 92%, transparent)',
    borderColor: 'var(--border-color)',
    color: 'var(--primary-text)',
    backdropFilter: 'blur(20px)',
  } as React.CSSProperties;
  const popoverStyle = {
    background: 'color-mix(in srgb, var(--card-bg) 96%, transparent)',
    borderColor: 'var(--border-color)',
    color: 'var(--primary-text)',
    backdropFilter: 'blur(30px)',
  } as React.CSSProperties;
  const userBubbleStyle = {
    background: props.theme === 'custom' ? 'var(--user-bubble-bg, var(--card-bg))' : isLightTheme
      ? 'color-mix(in srgb, var(--card-bg) 95%, transparent)'
      : 'color-mix(in srgb, var(--card-bg) 85%, transparent)',
    borderColor: isLightTheme ? 'var(--border-color)' : 'color-mix(in srgb, var(--border-color) 70%, transparent)',
    boxShadow: isLightTheme ? '0 4px 20px color-mix(in srgb, var(--shadow-color) 50%, transparent)' : 'none',
    backdropFilter: 'blur(12px)',
    color: 'var(--primary-text)',
  } as React.CSSProperties;
  const modelBubbleStyle = {
    background: props.theme === 'custom' ? 'var(--model-bubble-bg, var(--card-bg))' : isLightTheme
      ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--primary-bg)), color-mix(in srgb, var(--accent-light) 4%, var(--primary-bg)))'
      : 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--accent-light) 10%, var(--card-bg)))',
    borderColor: isLightTheme ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)',
    backdropFilter: 'blur(16px)',
    boxShadow: isLightTheme ? '0 4px 25px color-mix(in srgb, var(--shadow-color) 40%, transparent)' : '0 4px 30px color-mix(in srgb, var(--accent) 15%, transparent)',
    color: 'var(--primary-text)',
  } as React.CSSProperties;

  // Core state
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  // Command queue
  const [commandQueue, setCommandQueue] = useState<AICommand[]>([]);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const processingQueueRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const commandQueueRef = useRef<AICommand[]>([]);
  const currentCommandIndexRef = useRef(0);
  const commandQueueWaiterRef = useRef<{
    resolve: (result: { commands: AICommand[]; timedOut: boolean }) => void;
    timeoutId: number;
  } | null>(null);

  // Reasoning steps
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [thinkingText, setThinkingText] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const [lastSidebarInteractionAt, setLastSidebarInteractionAt] = useState<number>(Date.now());
  const thinkingIdCounter = useRef(0);

  // Refs & Workers
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tesseractWorkerRef = useRef<Tesseract.Worker | null>(null);
  const refusedIntentsRef = useRef<RefusedIntentRecord[]>([]);
  const activeStreamingMessageIdRef = useRef<string | null>(null);

  // UI state
  const [showRagPanel, setShowRagPanel] = useState(false);
  const [ragContextItems, setRagContextItems] = useState<any[]>([]);
  const [showLLMProviderSettings, setShowLLMProviderSettings] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [isReadingPage, setIsReadingPage] = useState(false);
  const [isMermaidLoaded, setIsMermaidLoaded] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<{ name: string; modified_at: string }[]>([]);
  const [groqSpeed, setGroqSpeed] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [streamingPDFContent, setStreamingPDFContent] = useState('');
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfVisualStage, setPdfVisualStage] = useState<VisualStage>('idle');
  const [pythonAvailable, setPythonAvailable] = useState<boolean>(false);
  const aiTabsAutoCloseRef = useRef(false);

  const findYouTubeLinkElement = (elements: DOMElement[]): DOMElement | null => {
    for (const element of elements) {
      if (element.tag === 'a') {
        const href = element.attributes?.href?.trim();
        if (href && /youtube\.com\/watch/.test(href)) {
          return element;
        }
      }
      if (element.children && element.children.length > 0) {
        const childResult = findYouTubeLinkElement(element.children);
        if (childResult) return childResult;
      }
    }
    return null;
  };

  const handleAutoNavigateToYouTubeVideo = useCallback(async (prompt: string): Promise<boolean> => {
    if (!/(youtube\.com|youtube video)/i.test(prompt) || !/(click|open|play|navigate|watch)/i.test(prompt)) {
      return false;
    }
    if (!window.electronAPI?.extractSecureDOM) return false;

    try {
      const domResult = await window.electronAPI.extractSecureDOM();
      if (!domResult?.elements?.length) return false;
      const match = findYouTubeLinkElement(domResult.elements);
      const href = match?.attributes?.href;
      if (!href) return false;

      const baseUrl = domResult.metadata?.url || currentUrl || window.location.origin;
      let finalUrl = href;
      try {
        if (finalUrl.startsWith('//')) {
          finalUrl = `${window.location.protocol}${finalUrl}`;
        } else if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = new URL(finalUrl, baseUrl).toString();
        }
      } catch {
        // Keep original href if resolution fails
      }

      store.addTab(finalUrl, 'ai-session');
      setActiveView('browser');
      const successMessage: ExtendedChatMessage = {
        role: 'model',
        content: `✅ Navigated to YouTube video: ${finalUrl}`
      };
      setMessages(prev => [...prev, successMessage]);
      return true;
    } catch (e) {
      console.error('[AI] YouTube auto-navigation failed', e);
      return false;
    }
  }, [currentUrl, setActiveView, setMessages, store]);
  const persistTimeoutRef = useRef<number | null>(null);

  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [shiftTabGlow, setShiftTabGlow] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ id: string; command: string; output: string; success: boolean; timestamp: number }>>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalLogIdCounter = useRef(0);
  const nativeMacSyncTimeoutRef = useRef<number | null>(null);
  const isDevMode = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  const {
    pendingPermission: permissionPending,
    requestPermission: requestActionPermission,
    approvalModal,
  } = useAIActionSecurityManager();

  const markSidebarInteraction = useCallback(() => {
    setLastSidebarInteractionAt(Date.now());
  }, []);

  const buildActionChainClarification = useCallback((options: {
    reason: string;
    failedCommands?: Array<{ type: string; value?: string; error?: string }>;
    invalidCommands?: Array<{ type: string; error: string }>;
    skippedCommands?: string[];
    attemptsUsed?: number;
    maxAttempts?: number;
  }) => {
    const failedCommands = options.failedCommands || [];
    const invalidCommands = options.invalidCommands || [];
    const skippedCommands = options.skippedCommands || [];

    const lines = [
      `I couldn't complete the action chain automatically.`,
      ``,
      `Reason: ${options.reason}`,
    ];

    if (failedCommands.length > 0) {
      lines.push('', 'Failed steps:');
      failedCommands.slice(0, 4).forEach((command, index) => {
        const detail = command.error || 'Step failed without a detailed error.';
        lines.push(`${index + 1}. ${command.type}${command.value ? ` (${command.value.slice(0, 80)})` : ''} - ${detail}`);
      });
    }

    if (invalidCommands.length > 0) {
      lines.push('', 'Invalid or unexecutable steps:');
      invalidCommands.slice(0, 4).forEach((command, index) => {
        lines.push(`${index + 1}. ${command.type} - ${command.error}`);
      });
    }

    if (skippedCommands.length > 0) {
      lines.push('', 'Skipped to avoid a loop:');
      skippedCommands.slice(0, 4).forEach((command, index) => {
        lines.push(`${index + 1}. ${command}`);
      });
    }

    if (typeof options.attemptsUsed === 'number' && options.attemptsUsed > 0 && typeof options.maxAttempts === 'number') {
      lines.push('', `Recovery attempts used: ${options.attemptsUsed}/${options.maxAttempts}`);
    }

    lines.push(
      '',
      'Please clarify the next step you want me to take, or tell me to retry with a different target/page.'
    );

    return lines.join('\n');
  }, []);

  const normalizeNavigationTarget = useCallback((rawTarget: string) => {
    const trimmed = rawTarget.trim();
    if (!trimmed || trimmed.startsWith('comet://')) {
      return trimmed;
    }

    if (/^(https?:|file:|about:|data:|mailto:|tel:)/i.test(trimmed)) {
      return trimmed;
    }

    if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return trimmed;
  }, []);

  const waitForTabNavigation = useCallback(async (tabId: string, expectedUrl?: string, timeoutMs = 20000) => {
    const normalizeUrlForCompare = (url?: string) => {
      if (!url) return '';
      const trimmed = url.trim();
      return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    };

    const urlsRoughlyMatch = (actualUrl?: string, expected?: string) => {
      const normalizedActual = normalizeUrlForCompare(actualUrl);
      const normalizedExpected = normalizeUrlForCompare(expected);

      if (!normalizedExpected) return Boolean(normalizedActual);
      if (!normalizedActual) return false;
      if (normalizedActual === normalizedExpected || normalizedActual.startsWith(normalizedExpected)) {
        return true;
      }

      try {
        const actual = new URL(normalizedActual);
        const wanted = new URL(normalizedExpected);
        if (actual.origin !== wanted.origin || actual.pathname !== wanted.pathname) {
          return false;
        }

        const expectedParams = new URLSearchParams(wanted.search);
        for (const [key, value] of expectedParams.entries()) {
          if (actual.searchParams.get(key) !== value) {
            return false;
          }
        }

        return true;
      } catch {
        return false;
      }
    };

    const deadline = Date.now() + timeoutMs;
    let sawLoading = false;
    let lastSeenUrl = '';

    while (Date.now() < deadline) {
      const state = useAppStore.getState();
      const tab = state.tabs.find((item) => item.id === tabId);

      if (tab) {
        const actualUrl = `${tab.url || ''}`.trim();
        const matchesExpected = !expectedUrl || urlsRoughlyMatch(actualUrl, expectedUrl);

        if (tab.isLoading) {
          sawLoading = true;
        }
        if (actualUrl) {
          lastSeenUrl = actualUrl;
        }

        if ((matchesExpected || sawLoading) && !tab.isLoading && actualUrl && actualUrl !== 'about:blank') {
          return {
            url: actualUrl,
            title: tab.title || 'New Tab',
          };
        }
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    throw new Error(`Timed out waiting for navigation${lastSeenUrl ? ` (${lastSeenUrl})` : ''}`);
  }, []);

  const openTabAndWaitForLoad = useCallback(async (url: string, groupId?: string) => {
    const normalizedUrl = normalizeNavigationTarget(url);
    const existingIds = new Set(useAppStore.getState().tabs.map((tab) => tab.id));
    store.addTab(normalizedUrl, groupId);
    await new Promise(resolve => setTimeout(resolve, 50));

    const state = useAppStore.getState();
    const createdTab = state.tabs.find((tab) => !existingIds.has(tab.id)) || state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!createdTab) {
      throw new Error(`Failed to create tab for ${normalizedUrl}`);
    }

    return waitForTabNavigation(createdTab.id, normalizedUrl);
  }, [normalizeNavigationTarget, store, waitForTabNavigation]);

  const waitForActiveTabToSettle = useCallback(async (timeoutMs = 20000) => {
    const state = useAppStore.getState();
    if (!state.activeTabId) {
      return null;
    }
    return waitForTabNavigation(state.activeTabId, state.currentUrl || undefined, timeoutMs);
  }, [waitForTabNavigation]);

  const appendTerminalLog = useCallback((commandName: string, output: string, success = true) => {
    if (!isDevMode) return;
    const logId = `pdf-${Date.now()}-${terminalLogIdCounter.current++}`;
    setShowTerminal(true);
    setTerminalLogs((prev) => [...prev, {
      id: logId,
      command: commandName,
      output,
      success,
      timestamp: Date.now(),
    }]);
  }, [isDevMode]);

  const updateVisualStage = useCallback((stage: VisualStage, message?: string) => {
    setPdfVisualStage(stage);
    if (message) setStreamingPDFContent(message);
  }, []);

  // DOM Search State
  const [domSearchResults, setDOMSearchResults] = useState<DOMSearchResult[]>([]);
  const [domSearchQuery, setDOMSearchQuery] = useState<string>('');
  const [domSearchLoading, setDOMSearchLoading] = useState(false);
  const [domMeta, setDOMMeta] = useState<FilteredDOMResult['metadata'] | null>(null);
  const [ocrSearchResults, setOCRSearchResults] = useState<DOMSearchResult[]>([]);
  const [ocrSearchQuery, setOCRSearchQuery] = useState<string>('');
  const [ocrSearchLoading, setOCRSearchLoading] = useState(false);

  // Scheduling State - controlled by props or local
  const [localSchedulingIntent, setLocalSchedulingIntent] = useState<SchedulingIntent | null>(null);
  const schedulingIntent = props.schedulingIntent !== undefined ? props.schedulingIntent : localSchedulingIntent;
  const setSchedulingIntent = props.setSchedulingIntent
    ? props.setSchedulingIntent
    : setLocalSchedulingIntent;

  // Use controlled modal state from props if provided
  const [localShowSchedulingModal, setLocalShowSchedulingModal] = useState(false);
  const showSchedulingModal = props.showSchedulingModal !== undefined ? props.showSchedulingModal : localShowSchedulingModal;
  const setShowSchedulingModal = props.showSchedulingModal !== undefined
    ? (val: boolean) => {
      if (props.setBrowserDisabled) props.setBrowserDisabled(val);
      if (props.setShowSchedulingModal) props.setShowSchedulingModal(val);
    }
    : setLocalShowSchedulingModal;

  useEffect(() => {
    commandQueueRef.current = commandQueue;
    currentCommandIndexRef.current = currentCommandIndex;

    if (commandQueueWaiterRef.current && areCommandsSettled(commandQueue)) {
      const waiter = commandQueueWaiterRef.current;
      commandQueueWaiterRef.current = null;
      window.clearTimeout(waiter.timeoutId);
      waiter.resolve({ commands: commandQueue, timedOut: false });
    }
  }, [commandQueue, currentCommandIndex]);

  const waitForCommandQueueCompletion = useCallback((timeoutMs = 120000) => {
    if (areCommandsSettled(commandQueueRef.current)) {
      return Promise.resolve({ commands: commandQueueRef.current, timedOut: false });
    }

    if (commandQueueWaiterRef.current) {
      window.clearTimeout(commandQueueWaiterRef.current.timeoutId);
      commandQueueWaiterRef.current.resolve({ commands: commandQueueRef.current, timedOut: true });
      commandQueueWaiterRef.current = null;
    }

    return new Promise<{ commands: AICommand[]; timedOut: boolean }>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (commandQueueWaiterRef.current?.timeoutId === timeoutId) {
          commandQueueWaiterRef.current = null;
        }
        resolve({ commands: commandQueueRef.current, timedOut: true });
      }, timeoutMs);

      commandQueueWaiterRef.current = { resolve, timeoutId };
    });
  }, []);

  useEffect(() => {
    return () => {
      if (commandQueueWaiterRef.current) {
        window.clearTimeout(commandQueueWaiterRef.current.timeoutId);
        commandQueueWaiterRef.current.resolve({ commands: commandQueueRef.current, timedOut: true });
        commandQueueWaiterRef.current = null;
      }
    };
  }, []);

  // Detect Python availability once (used for optional QA guidance)
  useEffect(() => {
    const checkPy = async () => {
      try {
        if (window.electronAPI?.checkPythonAvailable) {
          const ok = await window.electronAPI.checkPythonAvailable();
          setPythonAvailable(!!ok);
        }
      } catch {
        setPythonAvailable(false);
      }
    };
    checkPy();
  }, []);

  // ---------------------------------------------------------------------------
  // Helper Logic
  // ---------------------------------------------------------------------------

  const addThinkingStep = useCallback((label: string, detail?: string): string => {
    const id = `think-${Date.now()}-${thinkingIdCounter.current++}`;
    setThinkingSteps((prev) => [...prev, { id, label, status: 'running', detail, timestamp: Date.now() }]);
    return id;
  }, []);

  const resolveThinkingStep = useCallback((id: string, status: 'done' | 'error' | 'skipped', detail?: string) => {
    setThinkingSteps((prev) => prev.map((s) => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s));
  }, []);

  const updateThinkingStep = useCallback((id: string, detail: string) => {
    setThinkingSteps((prev) => prev.map((s) => s.id === id ? { ...s, detail } : s));
  }, []);

  const preloadCometIconLocal = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    if ((window as any).__cometIconBase64) return;
    try {
      const api = (window as any).electronAPI;
      if (typeof api?.getAppIcon === 'function') {
        const b64 = await api.getAppIcon();
        if (b64) (window as any).__cometIconBase64 = b64;
      }
    } catch { }
  }, []);

  const isAiSetup = useCallback(() => {
    if (aiProvider === 'ollama' && ollamaBaseUrl) return true;
    if (aiProvider === 'gemini' && geminiApiKey) return true;
    if (aiProvider === 'google' && geminiApiKey) return true;
    if (aiProvider === 'google-flash' && geminiApiKey) return true;
    if (aiProvider === 'openai' && openaiApiKey) return true;
    if (aiProvider === 'azure-openai' && store.azureOpenaiApiKey && store.azureOpenaiEndpoint) return true;
    if (aiProvider === 'anthropic' && anthropicApiKey) return true;
    if (aiProvider === 'groq' && groqApiKey) return true;
    if (aiProvider === 'xai' && xaiApiKey) return true;
    return false;
  }, [aiProvider, ollamaBaseUrl, geminiApiKey, openaiApiKey, anthropicApiKey, groqApiKey, xaiApiKey, store.azureOpenaiApiKey, store.azureOpenaiEndpoint]);

  // Scheduling handler
  const handleSchedulingConfirm = useCallback(async (config: any) => {
    if (!schedulingIntent) return;

    try {
      if (window.electronAPI?.scheduleTask) {
        await window.electronAPI.scheduleTask({
          name: schedulingIntent.taskName,
          type: schedulingIntent.taskType,
          cronExpression: config.schedule,
          outputPath: config.outputPath,
          enabled: config.enabled,
          prompt: inputMessage,
        });

        setMessages(prev => [...prev, {
          role: 'model',
          content: `✅ **Task Scheduled Successfully!**

I've set up "${schedulingIntent.taskName}" to run **${config.schedule}**.

📅 **Schedule:** ${config.schedule}
🤖 **Model:** ${config.model.provider}/${config.model.model}
💾 **Save to:** ${config.outputPath}
${config.notification?.onComplete ? '🔔 You will be notified when complete.' : ''}

You can manage this task anytime from the Automation panel.`
        } as ExtendedChatMessage]);

        setShowSchedulingModal(false);
        setSchedulingIntent(null);
        if (props.setBrowserDisabled) props.setBrowserDisabled(false);
      }
    } catch (error) {
      console.error('[Scheduling] Failed to schedule task:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        content: `⚠️ **Scheduling Failed**

I couldn't schedule the task. The background service may not be running. Please make sure Comet-AI's background service is installed and running.`
      } as ExtendedChatMessage]);
    }
  }, [schedulingIntent, inputMessage]);

  // ---------------------------------------------------------------------------
  // ✅ NEW: fetchRealSearchContext
  // Runs 3 real web searches and returns combined verified results.
  // Called BEFORE the LLM so it gets real data instead of hallucinating.
  // Results are cached for 5 minutes to avoid re-searching.
  // ---------------------------------------------------------------------------
  const fetchRealSearchContext = useCallback(async (topic: string): Promise<string> => {
    // Check if we have recent search for this topic
    const recentContext = searchContextStore.hasRecentSearch(topic);
    if (recentContext) {
      console.log('[CometAI] Using cached search for:', topic);
      return recentContext.content;
    }

    const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const queries = [
      `${topic} news today`,
      `latest ${topic} updates`,
      `${topic} ${currentDate}`,
    ];

    const results: string[] = [];

    for (const q of queries) {
      try {
        const res = await window.electronAPI.webSearchRag(q);
        if (res && res.length > 0) {
          const snippets = (res as string[])
            .map((r) => r.trim())
            .filter(Boolean)
            .slice(0, 5);
          results.push(`[Search: "${q}"]\n${snippets.join('\n')}`);
        }
      } catch (e) {
        console.warn('[CometAI] Pre-flight search failed for:', q, e);
      }
    }

    const combinedResults = results.join('\n\n');

    // Store in context for future use
    if (combinedResults) {
      searchContextStore.addWebSearch(topic, combinedResults);
    }

    return combinedResults;
  }, []);

  // ---------------------------------------------------------------------------
  // AI Logic Bridge
  // ---------------------------------------------------------------------------

  // Normalize 'gemini' -> 'google' so the main process provider switch always matches
  const normalizedProvider = aiProvider === 'gemini' ? 'google' : aiProvider;
  const selectedProviderModel = useMemo(() => {
    switch (normalizedProvider) {
      case 'ollama':
        return ollamaModel || 'llama3';
      case 'google':
        return geminiModel || 'gemini-2.5-pro';
      case 'google-flash':
        return geminiFlashModel || 'gemini-2.5-flash';
      case 'openai':
        return openaiModel || 'gpt-5.1';
      case 'azure-openai':
        return store.azureOpenaiModel || 'gpt-4.1-mini';
      case 'anthropic':
        return anthropicModel || 'claude-sonnet-4-20250514';
      case 'groq':
        return groqModel || 'llama-3.3-70b-versatile';
      case 'xai':
        return xaiModel || 'grok-4-fast-reasoning';
      default:
        return normalizedProvider;
    }
  }, [
    anthropicModel,
    geminiFlashModel,
    geminiModel,
    groqModel,
    normalizedProvider,
    ollamaModel,
    openaiModel,
    store.azureOpenaiModel,
    xaiModel,
  ]);

  const reasoningOptions = useMemo(() => buildFrontendReasoningOptions(
    (localLlmMode || 'normal') as LlmMode,
    normalizedProvider,
    {
      model: selectedProviderModel,
      baseUrl: normalizedProvider === 'ollama'
        ? ollamaBaseUrl
        : normalizedProvider === 'azure-openai' ? store.azureOpenaiEndpoint : undefined,
    }
  ), [localLlmMode, normalizedProvider, ollamaBaseUrl, selectedProviderModel, store.azureOpenaiEndpoint]);

  const getStreamingResponse = useCallback(async (history: ChatMessage[], messageId?: string, onFirstChunk?: () => void): Promise<any> => {
    return new Promise((resolve) => {
      let fullText = '';
      let fullThought = '';
      let animationFrame: number | null = null;
      let hasCalledOnFirstChunk = false;

      const flushStreamText = () => {
        animationFrame = null;
        setMessages((prev) => {
          const updated = [...prev];
          const targetIndex = messageId
            ? updated.findIndex((message) => message.id === messageId)
            : updated.length - 1;
          const lastMessage = targetIndex >= 0 ? updated[targetIndex] : null;
          if (lastMessage && lastMessage.role === 'model') {
            updated[targetIndex] = { ...lastMessage, content: fullText };
          }
          return updated;
        });
      };

      const cleanup = window.electronAPI.onChatStreamPart((part: any) => {
        if (!hasCalledOnFirstChunk && (part.type === 'text-delta' || part.type === 'reasoning-delta')) {
          hasCalledOnFirstChunk = true;
          onFirstChunk?.();
        }

        if (part.type === 'text-delta') {
          fullText += (part.textDelta || '');
          if (animationFrame === null) {
            animationFrame = window.requestAnimationFrame(flushStreamText);
          }
        } else if (part.type === 'reasoning-delta') {
          fullThought += (part.reasoningDelta || '');
          setThinkingText(fullThought.trim());
        } else if (part.type === 'error') {
          if (animationFrame !== null) {
            window.cancelAnimationFrame(animationFrame);
            flushStreamText();
          }
          cleanup();
          resolve({ error: part.error });
        } else if (part.type === 'finish') {
          if (animationFrame !== null) {
            window.cancelAnimationFrame(animationFrame);
          }
          flushStreamText();
          cleanup();
          resolve({ text: fullText, thought: fullThought });
        }
      });
      window.electronAPI.streamChatContent(history, reasoningOptions);
    });
  }, [reasoningOptions]);

  // ---------------------------------------------------------------------------
  // Message Sending & Task Centralization
  // ---------------------------------------------------------------------------

  const handleSendMessage = useCallback(async (customContent?: string) => {
    const rawContent = (customContent ?? inputMessage).trim();
    if (!rawContent && attachments.length === 0) return;



    // Show setup guide if AI is not configured. After first show, don't block—
    if (!isAiSetup()) {
      if (!hasSeenNeuralSetup) {
        setHasSeenNeuralSetup(true);
        setShowSetupGuide(true);
      }
    }

    // INSTANT feedback - show user message immediately
    setMessages(prev => [...prev, { id: createMessageId('user'), role: 'user', content: rawContent }]);
    if (!customContent) { setInputMessage(''); setAttachments([]); }
    
    // Show AI placeholder immediately so user knows AI received the message
    const aiPlaceholderId = createMessageId('assistant');
    setMessages(prev => [...prev, { id: aiPlaceholderId, role: 'model', content: '' }]);
    
    setIsLoading(true);
    setIsThinking(true);
    setThinkingSteps([]);
    setThinkingText('');
    setError(null);

    // Update the streaming message ref
    activeStreamingMessageIdRef.current = aiPlaceholderId;

    // Security Checks
    const threatCheck = checkThreat(rawContent);
    if (threatCheck.blocked) {
      setMessages(prev => [...prev, { id: createMessageId('assistant'), role: 'model', content: threatCheck.response ?? '' }] as ExtendedChatMessage[]);
      setIsLoading(false); setIsThinking(false); return;
    }

    // Check for scheduling intent
    const intent = detectSchedulingIntent(rawContent);
    if (intent && intent.detected && intent.confidence === 'high') {
      setSchedulingIntent(intent);
      setShowSchedulingModal(true);
      if (props.setBrowserDisabled) props.setBrowserDisabled(true);
    }

    // ✅ NEW: Load document skill if user wants to create pdf/docx/pptx/xlsx
    let skillContext = '';
    const docFormatMatch = rawContent.match(/\b(pdf|docx?|pptx?|xlsx?)\b/i);
    if (docFormatMatch && window.electronAPI?.loadSkill) {
      const format = docFormatMatch[1].toLowerCase();
      const normalizedFormat = format === 'doc' || format === 'docx' ? 'docx' : format === 'ppt' ? 'pptx' : format === 'xls' || format === 'xlsx' ? 'xlsx' : format;
      try {
        const skillId = addThinkingStep(`📖 Loading ${normalizedFormat.toUpperCase()} skill guide...`);
        skillContext = await window.electronAPI.loadSkill(normalizedFormat);
        resolveThinkingStep(skillId, 'done', `Loaded ${normalizedFormat.toUpperCase()} formatting guide`);
        console.log(`[SkillLoader] ✅ Loaded skill for ${normalizedFormat}: ${skillContext.length} chars`);
      } catch (e) {
        console.warn('[SkillLoader] ❌ Failed to load skill:', e);
      }
    }

    const { content: protectedContent, wasProtected } = Security.fortress(rawContent);
    const userMessage: ExtendedChatMessage = {
      role: 'user',
      content: protectedContent + (attachments.length > 0 ? `\n[Attached ${attachments.length} files]` : ''),
      attachments: attachments.map(a => a.data)
    };

    if (rawContent.includes('[EXPLAIN_CAPABILITIES]')) {
      setShowCapabilities(true);
      const capCmd: AICommand = {
        id: `cmd-${Date.now()}-cap`,
        type: 'EXPLAIN_CAPABILITIES',
        value: '',
        status: 'pending',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, { role: 'model', content: '✨ **Unlocking Neural Potential...**' }]);
      setCommandQueue([capCmd]);
      setCurrentCommandIndex(0);
      setIsLoading(false);
      setIsThinking(false);
      return;
    }

    if (wasProtected) setMessages(prev => [...prev, { role: 'model', content: '🛡️ **AI Fortress Active**: Sensitive data protected.' }]);

    try {
      if (!window.electronAPI) throw new Error('AI Engine disconnected.');

      // ✅ PARALLEL: Run RAG, Live Search, and Browser State in parallel for speed
      const [ragId, preflightId, browserId] = [
        addThinkingStep('Neural Retrieval...'),
        addThinkingStep('🔍 Fetching live data...'),
        addThinkingStep('📊 Getting browser state...')
      ];

      // Run all in parallel
      const [contextItems, liveSearchResult, browserStateResult] = await Promise.all([
        BrowserAI.retrieveContext(protectedContent).catch(() => []),
        queryRequiresSearch(protectedContent) ? (async () => {
          try {
            const topic = protectedContent
              .replace(/\b(create|make|generate|write|give me|show me|tell me|what are|what is|latest|find|search|get)\b/gi, '')
              .replace(/\b(pdf|report|document|page|today|news|please|can you|could you)\b/gi, '')
              .trim()
              .slice(0, 80) || 'technology news';
            return await fetchRealSearchContext(topic);
          } catch { return ''; }
        })() : Promise.resolve(''),
        (async () => {
          try {
            const tabs: any[] = await window.electronAPI.getOpenTabs();
            const activeTab = tabs.find(t => t.active) || tabs[0];
            if (tabs.length > 0) {
              return `[BROWSER STATE]\n- ACTIVE TAB: ${activeTab?.title || 'Unknown'} (${activeTab?.url || currentUrl || 'N/A'})\n- OPEN TABS (${tabs.length}):\n${tabs.map((t, idx) => `  ${idx + 1}. ${t.title} (${t.url}) ${t.active ? '[ACTIVE]' : ''}`).join('\n')}`;
            }
          } catch { return ''; }
          return '';          
        })()
      ]);

      const liveSearchContext = liveSearchResult;
      const browserStateContext = browserStateResult;

      // Update thinking steps
      setRagContextItems(contextItems);
      if (contextItems.length > 0) setShowRagPanel(true);
      resolveThinkingStep(ragId, 'done', `${contextItems.length} memories recovered`);
      if (liveSearchContext) resolveThinkingStep(preflightId, 'done', `Live data fetched (${liveSearchContext.length} chars)`);
      else resolveThinkingStep(preflightId, 'skipped', 'No live search needed');
      if (browserStateContext) resolveThinkingStep(browserId, 'done', `${browserStateContext.split('\n').length} lines`);
      else resolveThinkingStep(browserId, 'skipped', 'No browser state');

      // LLM Request — Build context with REAL data injected
      const aiId = addThinkingStep('LLM Processing...');

      // Get recent search context to avoid re-searching
      const searchContextSummary = searchContextStore.getContextSummary();

      const contextBlock = [
        searchContextSummary !== 'No recent context available.' ? `[📚 RECENT CONTEXT — CHECK THIS BEFORE SEARCHING!]\n${searchContextSummary}` : '',
        browserStateContext,
        contextItems.length > 0
          ? `[RAG MEMORY]\n${contextItems.map(c => c.text).join('\n')}`
          : '',
        liveSearchContext
          ? `[LIVE SEARCH RESULTS — USE ONLY THESE FOR CURRENT FACTS, DO NOT INVENT DATA]\n${liveSearchContext}`
          : '',
        skillContext
          ? `[📝 DOCUMENT SKILL — FOLLOW THESE FORMATTING RULES]\n${skillContext}`
          : '',
      ].filter(Boolean).join('\n\n');

      let currentHistory: ChatMessage[] = [
        {
          role: 'system',
          content: `${SYSTEM_INSTRUCTIONS}\n\n[CURRENT TIME]: ${new Date().toLocaleString()}\n[LOCATION]: India`
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        {
          role: 'user',
          content: contextBlock
            ? `${userMessage.content}\n\n${contextBlock}`
            : userMessage.content
        }
      ];

      let iterations = 0;
      let finalSynthesisDone = false;
      let recoveryAttempts = 0;
      const commandAttemptCounts = new Map<string, number>();

      while (iterations < ACTION_CHAIN_MAX_ITERATIONS && !finalSynthesisDone) {
        iterations++;
        const aiId = addThinkingStep(iterations === 1 ? 'LLM Processing...' : `Action Chain Synthesis & Evaluation (Step ${iterations})...`);

        const responseMessageId = createMessageId('assistant');
        activeStreamingMessageIdRef.current = responseMessageId;
        setMessages(prev => [...prev, { id: responseMessageId, role: 'model', content: '' }] as ExtendedChatMessage[]);
        const response = await getStreamingResponse(currentHistory, responseMessageId, () => {
          updateThinkingStep(aiId, iterations === 1 ? 'AI is responding...' : `Comet is processing Step ${iterations}...`);
        });
        resolveThinkingStep(aiId, response.error ? 'error' : 'done');

        if (response.error) throw new Error(response.error);

        // Clean up text format to remove the action commands from the visible message
        // parseAICommands now handles ALL formats (JSON, brackets, HTML comments) with built-in deduplication
        let { commands, responseText, invalidCommands } = prepareCommandsForExecution(response.text);

        // Also strip any remaining command tags/JSON for display
        responseText = stripAllCommands(responseText);

        const skippedCommands: string[] = [];
        const duplicatePreventedCommands: string[] = [];
        const normalizedCommands = commands
          .filter(command => command.type && (command.value !== undefined))
          .map(command => ({
            ...command,
            value: `${command.value || ''}`.trim(),
          }));

        commands = normalizedCommands.filter((command, index) => {
          if (index >= ACTION_CHAIN_MAX_COMMANDS_PER_PASS) {
            skippedCommands.push(`${command.type} was ignored because this pass exceeded ${ACTION_CHAIN_MAX_COMMANDS_PER_PASS} actions.`);
            return false;
          }

          const signature = getCommandAttemptSignature(command);
          const seenAttempts = (commandAttemptCounts.get(signature) || 0) + 1;
          commandAttemptCounts.set(signature, seenAttempts);

          if (seenAttempts > ACTION_CHAIN_MAX_SAME_COMMAND_ATTEMPTS) {
            duplicatePreventedCommands.push(`${command.type}${command.value ? ` (${command.value.slice(0, 80)})` : ''}`);
            return false;
          }

          return true;
        });

        skippedCommands.push(...duplicatePreventedCommands.map(command =>
          `${command} was skipped because the AI already tried that step too many times.`
        ));

        const trimmedResponseText = responseText.trim();

        // Update the last visible message to include the response content and reasoning
        setMessages(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const targetIndex = responseMessageId
            ? updated.findIndex((message) => message.id === responseMessageId)
            : updated.length - 1;
          if (targetIndex >= 0 && updated[targetIndex].role === 'model') {
            updated[targetIndex] = {
              ...updated[targetIndex],
              content: trimmedResponseText,
              thinkText: response.thought // 🚀 PERSIST reasoning for exports/copy
            };
          }
          return updated;
        });
        window.setTimeout(() => {
          if (activeStreamingMessageIdRef.current === responseMessageId) {
            activeStreamingMessageIdRef.current = null;
          }
        }, 1200);

        if (commands.length === 0) {
          // Only show error if there are genuinely unsupported commands AND no useful response text.
          // If the AI produced reasoning/think text only, just break cleanly (it's done deliberating).
          const hasRealInvalidCommands = invalidCommands.some(
            ({ command }) => command.type.includes('_') || command.type.length >= 5
          );
          const noUsefulContent = !trimmedResponseText || trimmedResponseText.length < 20;

          if (noUsefulContent && (hasRealInvalidCommands || skippedCommands.length > 0)) {
            const clarificationMessage = buildActionChainClarification({
              reason: !trimmedResponseText
                ? 'The AI returned an empty or unusable step, so execution was stopped before it could stall.'
                : 'The AI produced malformed or repetitive action steps, so execution was stopped before it could loop.',
              invalidCommands: invalidCommands
                .filter(({ command }) => command.type.includes('_') || command.type.length >= 5)
                .map(({ command, error }) => ({ type: command.type, error })),
              skippedCommands,
              attemptsUsed: recoveryAttempts,
              maxAttempts: ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS,
            });

            setMessages(prev => {
              if (prev.length === 0) {
                return [{ role: 'model', content: clarificationMessage } as ExtendedChatMessage];
              }

              const updated = [...prev];
              const lastIdx = updated.length - 1;
              const last = updated[lastIdx];
              if (last.role === 'model' && !(last.content || '').trim()) {
                updated[lastIdx] = {
                  ...last,
                  content: clarificationMessage,
                };
                return updated;
              }

              return [...updated, { role: 'model', content: clarificationMessage } as ExtendedChatMessage];
            });
          }
          finalSynthesisDone = true;
          break; // No commands needed, LLM has finished its task.
        }

        console.log('[AI] Commands parsed:', commands.map(c => c.type));

        // Save AI's response including the commands to history
        currentHistory = [...currentHistory, { role: 'assistant', content: response.text }];

        // Action Execution
        console.log('[AI] Setting up command queue with', commands.length, 'commands');
        const cmdId = addThinkingStep(`Executing Actions (${commands.length})...`);
        const aiCommands: AICommand[] = commands.map((c, i) => ({
          id: `cmd-${Date.now()}-${iterations}-${i}`,
          type: c.type,
          value: c.value,
          context: responseText,
          status: 'pending',
          timestamp: Date.now()
        }));
        console.log('[AI] Command queue:', aiCommands.map(c => c.type));
        commandQueueRef.current = aiCommands;
        setCommandQueue(aiCommands);
        setCurrentCommandIndex(0);

        const finalCommandResult = await waitForCommandQueueCompletion(120000);

        resolveThinkingStep(cmdId, 'done');

        if (finalCommandResult.timedOut) {
          setMessages(prev => [...prev, {
            role: 'model',
            content: buildActionChainClarification({
              reason: 'The browser workflow hit its execution timeout while waiting for steps to finish.',
              invalidCommands: invalidCommands.map(({ command, error }) => ({ type: command.type, error })),
              skippedCommands,
              attemptsUsed: recoveryAttempts,
              maxAttempts: ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS,
            })
          } as ExtendedChatMessage]);
          break;
        }

        const finalCommands = finalCommandResult.commands;

        // If the queue was cleared before completion
        if (finalCommands.length === 0 && commands.length > 0) {
          setMessages(prev => [...prev, {
            role: 'model',
            content: buildActionChainClarification({
              reason: 'The browser workflow stopped before any actionable result was returned.',
              invalidCommands: invalidCommands.map(({ command, error }) => ({ type: command.type, error })),
              skippedCommands,
              attemptsUsed: recoveryAttempts,
              maxAttempts: ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS,
            })
          } as ExtendedChatMessage]);
          break;
        }

        // Loop Synthesis step: Feed action outputs back into context
        const actionResults = finalCommands.map(c =>
          `[Action ${c.type}]: ${c.status === 'completed' ? (c.output || 'Success') : ('Error: ' + (c.error || 'Failed'))}`
        ).join('\n');

        const failedCommands = finalCommands
          .filter(command => command.status === 'failed')
          .map(command => ({
            type: command.type,
            value: command.value,
            error: command.error,
          }));
        const hadRecoveryIssues = failedCommands.length > 0 || invalidCommands.length > 0 || skippedCommands.length > 0;

        if (hadRecoveryIssues) {
          recoveryAttempts += 1;
        } else {
          recoveryAttempts = 0;
        }

        if (hadRecoveryIssues && recoveryAttempts > ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS) {
          setMessages(prev => [...prev, {
            role: 'model',
            content: buildActionChainClarification({
              reason: `The AI hit the recovery limit after ${ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS} retry rounds.`,
              failedCommands,
              invalidCommands: invalidCommands.map(({ command, error }) => ({ type: command.type, error })),
              skippedCommands,
              attemptsUsed: recoveryAttempts,
              maxAttempts: ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS,
            })
          } as ExtendedChatMessage]);
          break;
        }

        currentHistory = [
          ...currentHistory,
          {
            role: 'user',
            content: `Action outputs for the steps above:\n${actionResults}${invalidCommands.length > 0
                ? `\n\nInvalid commands skipped:\n${invalidCommands.map(({ command, error }) => `- ${command.type}: ${error}`).join('\n')}`
                : ''
              }${skippedCommands.length > 0
                ? `\n\nLoop prevention notes:\n${skippedCommands.map(note => `- ${note}`).join('\n')}`
                : ''
              }${recoveryAttempts > 0
                ? `\n\nRecovery attempts used: ${recoveryAttempts}/${ACTION_CHAIN_MAX_RECOVERY_ATTEMPTS}.\nDo not repeat the same failed command unless the parameters materially change.`
                : ''
              }\n\nIf you need another action pass, emit at most 3 focused commands. If you cannot safely continue, explain the blocker clearly to the user and ask one specific clarification question. If the steps succeeded or you already have enough information, provide the final answer now without more commands.`
          }
        ];
      }


    } catch (err: any) {
      console.error('Core AI execution failure:', err);
      setError(`Neural Engine Failure: ${err.message}`);
      setMessages(prev => [...prev, { role: 'model', content: `❌ **CRITICAL ERROR**\n${err.message}` } as ExtendedChatMessage]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [inputMessage, attachments, messages, aiProvider, currentUrl, addThinkingStep, resolveThinkingStep, getStreamingResponse, isAiSetup, fetchRealSearchContext, buildActionChainClarification, waitForCommandQueueCompletion, createMessageId]);

  const processNextCommand = useCallback(async () => {
    console.log('[AI] processNextCommand called, current index:', currentCommandIndex, 'queue length:', commandQueue.length);
    if (processingQueueRef.current || currentCommandIndex >= commandQueue.length) {
      console.log('[AI] Skipping - processing:', processingQueueRef.current, 'index >= length:', currentCommandIndex >= commandQueue.length);
      return;
    }

    processingQueueRef.current = true;
    const command = commandQueue[currentCommandIndex];
    const COMMAND_TIMEOUT = 10000;

    setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));

    let commandResult: { output: string; error?: string } = { output: '' };

    const executeWithTimeout = async (fn: () => Promise<void>) => {
      const timeoutPromise = new Promise<{ output: string; error: string }>((_, reject) =>
        setTimeout(() => reject(new Error(`Command timed out after ${COMMAND_TIMEOUT}ms`)), COMMAND_TIMEOUT)
      );
      try {
        await fn();
        commandResult.output = 'completed';
      } catch (e: any) {
        commandResult = { output: '', error: e.message };
      }
    };

    try {
      let output = '';
      switch (command.type) {
        case 'WAIT': {
          const ms = parseInt(command.value) || 2000;
          output = `Waiting for ${ms}ms...`;
          await new Promise(resolve => setTimeout(resolve, ms));
          break;
        }

        case 'THINK': {
          const thinkId = addThinkingStep(command.value || 'AI Reasoning...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          resolveThinkingStep(thinkId, 'done', 'Reasoning complete');
          output = `Reasoning step: ${command.value}`;
          break;
        }

        case 'PLAN': {
          output = `Executing plan: ${command.value}`;
          setMessages(prev => [...prev, { role: 'model', content: `🎯 **STRATEGIC PLAN:** ${command.value}` }]);
          break;
        }

        case 'NAVIGATE': {
          const targetUrl = command.value.trim() || 'https://www.google.com';
          if (targetUrl.startsWith('comet://')) {
            const page = targetUrl.replace('comet://', '');
            router.push(`/${page}`);
            setActiveView('browser');
            output = `Navigated to internal page: ${page}`;
          } else {
            setActiveView('browser');
            const navigationResult = await openTabAndWaitForLoad(targetUrl, 'ai-session');
            output = `Opened new tab and navigated to ${navigationResult.url || targetUrl}`;
          }
          break;
        }

        case 'CLICK_ELEMENT': {
          const selector = command.value.split('|')[0].trim();
          const clickStepId = addThinkingStep(`Clicking element: ${selector}...`);
          try {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
            const confirmed = await requestActionPermission({
              actionType: 'CLICK_ELEMENT',
              action: 'Click Element',
              target: selector,
              what: selector,
              reason: command.reason || 'The AI wants to click a page element in the current tab.',
              risk: 'medium',
            });
            if (!confirmed) {
              output = `Click denied for element: ${selector}`;
              resolveThinkingStep(clickStepId, 'error', 'Permission denied');
              break;
            }
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
            const res = await window.electronAPI.clickElement(selector);
            if (res.success) {
              output = `Successfully clicked element: ${selector}`;
              resolveThinkingStep(clickStepId, 'done', 'Element clicked');
            } else {
              output = `Failed to click element: ${res.error}`;
              resolveThinkingStep(clickStepId, 'error', res.error);
            }
          } catch (e: any) {
            output = `Click error: ${e.message}`;
            resolveThinkingStep(clickStepId, 'error', e.message);
          }
          break;
        }

        case 'CLICK_AT': {
          const coords = command.value.split('|')[0].trim();
          const [x, y] = coords.split(',').map(s => parseInt(s.trim()));
          const clickAtStepId = addThinkingStep(`Clicking at (${x}, ${y})...`);
          try {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
            const confirmed = await requestActionPermission({
              actionType: 'CLICK_AT',
              action: 'Click Screen Coordinates',
              target: `${x},${y}`,
              what: `(${x}, ${y})`,
              reason: command.reason || 'The AI wants to click a specific point on screen.',
              risk: 'medium',
            });
            if (!confirmed) {
              output = `Click denied at coordinates (${x}, ${y})`;
              resolveThinkingStep(clickAtStepId, 'error', 'Permission denied');
              break;
            }
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
            const res = await window.electronAPI.performClick({ x, y });
            if (res.success) {
              output = `Clicked at coordinates (${x}, ${y})`;
              resolveThinkingStep(clickAtStepId, 'done', 'Clicked at coords');
            } else {
              output = `Failed to click at coords: ${res.error}`;
              resolveThinkingStep(clickAtStepId, 'error', res.error);
            }
          } catch (e: any) {
            output = `Click error: ${e.message}`;
            resolveThinkingStep(clickAtStepId, 'error', e.message);
          }
          break;
        }

        case 'FIND_AND_CLICK': {
          const textToFind = command.value.split('|')[0].trim();
          const findClickStepId = addThinkingStep(`Finding and clicking: "${textToFind}"...`);
          try {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
            const confirmed = await requestActionPermission({
              actionType: 'FIND_AND_CLICK',
              action: 'Find And Click',
              target: textToFind,
              what: textToFind,
              reason: command.reason || 'The AI wants to search the screen for text and click it.',
              risk: 'medium',
            });
            if (!confirmed) {
              output = `Find-and-click denied for "${textToFind}"`;
              resolveThinkingStep(findClickStepId, 'error', 'Permission denied');
              break;
            }
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
            const res = await window.electronAPI.findAndClickText(textToFind);
            if (res.success) {
              output = `Found and clicked text: "${textToFind}"`;
              resolveThinkingStep(findClickStepId, 'done', 'Text found and clicked');
            } else {
              output = `Could not find text: "${textToFind}"`;
              resolveThinkingStep(findClickStepId, 'error', 'Text not found');
            }
          } catch (e: any) {
            output = `Find and click error: ${e.message}`;
            resolveThinkingStep(findClickStepId, 'error', e.message);
          }
          break;
        }

        case 'FILL_FORM': {
          const parts = command.value.split('|').map(s => s.trim());
          const selector = parts[0];
          const value = parts[1];
          const fillStepId = addThinkingStep(`Filling form element ${selector}...`);
          try {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
            const confirmed = await requestActionPermission({
              actionType: 'FILL_FORM',
              action: 'Fill Form Field',
              target: selector,
              what: selector,
              reason: command.reason || 'The AI wants to type into a page form field.',
              risk: 'medium',
            });
            if (!confirmed) {
              output = `Form fill denied for ${selector}`;
              resolveThinkingStep(fillStepId, 'error', 'Permission denied');
              break;
            }
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
            const res = await window.electronAPI.typeText(selector, value);
            if (res.success) {
              output = `Filled ${selector} with value: ${value}`;
              resolveThinkingStep(fillStepId, 'done', 'Form field filled');
            } else {
              output = `Failed to fill form: ${res.error}`;
              resolveThinkingStep(fillStepId, 'error', res.error);
            }
          } catch (e: any) {
            output = `Fill error: ${e.message}`;
            resolveThinkingStep(fillStepId, 'error', e.message);
          }
          break;
        }

        case 'SCROLL_TO': {
          const parts = command.value.split('|').map(s => s.trim());
          const selector = parts[0];
          const scrollStepId = addThinkingStep(`Scrolling to ${selector}...`);
          try {
            const code = `document.querySelector('${selector}')?.scrollIntoView({ behavior: 'smooth' })`;
            await window.electronAPI.executeJavaScript(code);
            output = `Scrolled to element: ${selector}`;
            resolveThinkingStep(scrollStepId, 'done', 'Scrolled to element');
          } catch (e: any) {
            output = `Scroll error: ${e.message}`;
            resolveThinkingStep(scrollStepId, 'error', e.message);
          }
          break;
        }

        // ✅ FIXED: WEB_SEARCH now stores real results in BrowserAI memory
        // so the LLM's next synthesis turn gets real data, not hallucination
        case 'SEARCH':
        case 'WEB_SEARCH': {
          let query = command.value.trim().replace(/^["'](.*)["']$/, '$1') || 'Comet AI Browser';
          let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

          // If the AI mistakenly uses WEB_SEARCH but provides a direct URL, handle it as a direct navigation
          if (query.match(/^https?:\/\/[^\s]+/i) || query.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/)) {
            searchUrl = query.startsWith('http') ? query : `https://${query}`;
            query = `Opening URL: ${searchUrl}`; // Just for logging
          }

          setActiveView('browser');

          const navigationResult = await openTabAndWaitForLoad(searchUrl, 'ai-session');
          output = `Opened new tab for: "${query}" (${navigationResult.url || searchUrl})`;

          // Fetch real results and store in vector memory for LLM context
          const results = await window.electronAPI.webSearchRag(query);
          if (results && results.length > 0) {
            const snippets = (results as string[])
              .map((r) => r.trim())
              .filter(Boolean)
              .slice(0, 6); // More snippets = richer context for LLM

            // ✅ Store in BrowserAI so the synthesis step gets REAL data
            const fullSnippet = `[WEB_SEARCH RESULTS for "${query}"]\n${snippets.join('\n---\n')}`;
            await BrowserAI.addToVectorMemory(fullSnippet, {
              type: 'web_search',
              query,
              timestamp: Date.now()
            });

            output = `Search results for "${query}":\n${snippets.join('\n')}`;
          } else {
            // Fallback: wait for the search page to load slightly and try DOM / OCR extraction
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
              const domRes = await window.electronAPI.extractPageContent();
              if (domRes && domRes.content && domRes.content.length > 100) {
                const scrubbed = scrubbedContent(domRes.content).substring(0, 1000); // 🚀 Truncate fallback DOM
                output = `Search results for "${query}" (fallback DOM snippet):\n${scrubbed}...`;
                await BrowserAI.addToVectorMemory(scrubbed, { type: 'web_search_fallback', query, url: searchUrl });
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  const newOcrLabel = `WEB_SEARCH_FALLBACK_DOM`;
                  if (last && last.role === 'model') {
                    // Update last message with truncated text
                    return [...prev.slice(0, -1), {
                      ...last,
                      isOcr: true,
                      ocrLabel: newOcrLabel,
                      ocrText: `${scrubbed}\n\n[Content truncated for clarity. Use specific DOM_SEARCH for more detail.]`
                    }];
                  }
                  return [...prev, {
                    role: 'model',
                    content: 'I pulled some fallback content from the search page.',
                    isOcr: true,
                    ocrLabel: newOcrLabel,
                    ocrText: scrubbed
                  } as ExtendedChatMessage];
                });
              } else {
                let ocrText = '';
                if (window.electronAPI.visionDescribe) {
                  const visionRes = await window.electronAPI.visionDescribe('Extract all text from this search page.');
                  ocrText = typeof visionRes === 'string' ? visionRes : ((visionRes as any)?.description || '');
                } else if (window.electronAPI.ocrScreenText) {
                  const ocrRes = await window.electronAPI.ocrScreenText();
                  ocrText = typeof ocrRes === 'string' ? ocrRes : ((ocrRes as any)?.text || '');
                }
                if (ocrText && ocrText.length > 50) {
                  output = `Search results for "${query}" (fallback OCR) (${ocrText.length} chars):\n${ocrText.substring(0, 4000)}...`;
                  await BrowserAI.addToVectorMemory(ocrText, { type: 'web_search_fallback_ocr', query, url: searchUrl });
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    const newOcrLabel = `WEB_SEARCH_FALLBACK_OCR`;
                    if (last && last.role === 'model') {
                      return [...prev.slice(0, -1), { ...last, isOcr: true, ocrLabel: newOcrLabel, ocrText: ocrText }];
                    }
                    return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: newOcrLabel, ocrText: ocrText } as ExtendedChatMessage];
                  });
                } else {
                  output = `No results found for "${query}". Do NOT invent data — tell the user you could not find current information.`;
                }
              }
            } catch (fallbackErr) {
              output = `No results found for "${query}". Do NOT invent data — tell the user you could not find current information.`;
            }
          }
          break;
        }

        case 'READ_PAGE_CONTENT': {
          try {
            await waitForActiveTabToSettle(20000);
            const res = await window.electronAPI.extractPageContent();
            if (res.content) {
              const scrubbed = scrubbedContent(res.content);
              output = `Page content read (${scrubbed.length} chars):\n${scrubbed.substring(0, 4000)}...`;
              await BrowserAI.addToVectorMemory(scrubbed, { type: 'page_content', url: currentUrl });
              searchContextStore.addPageContent(currentUrl, currentUrl, scrubbed);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  updated[prev.length - 1] = { ...last, isOcr: true, ocrLabel: 'PAGE_CONTENT', ocrText: scrubbed };
                  return updated;
                }
                return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: 'PAGE_CONTENT', ocrText: scrubbed } as ExtendedChatMessage];
              });
            } else {
              output = `Error reading page: ${res.error || 'No content'}`;
            }
          } catch (e: any) {
            output = `Error reading page: ${e.message}`;
          }
          break;
        }

        case 'OCR_SCREEN': {
          try {
            const stepId = addThinkingStep('Capturing screen for OCR...');
            if (!window.electronAPI.ocrScreenText) {
              output = 'OCR screen not available';
              resolveThinkingStep(stepId, 'error', output);
            } else {
              const ocrRes = await window.electronAPI.ocrScreenText();
              const ocrText = typeof ocrRes === 'string' ? ocrRes : ((ocrRes as any)?.text || '');
              if (ocrText) {
                output = `OCR screen (${ocrText.length} chars):\n${ocrText.substring(0, 4000)}...`;
                await BrowserAI.addToVectorMemory(ocrText, { type: 'ocr_screen', url: currentUrl });
                searchContextStore.addPageContent(currentUrl, currentUrl, ocrText);
              } else {
                output = 'No OCR text detected';
              }
              resolveThinkingStep(stepId, 'done', output);
            }
          } catch (e: any) {
            output = `OCR error: ${e.message}`;
          }
          break;
        }

        // ── CROSS_APP_JSON: Execute multiple cross-app actions in sequence ───────────────
        case 'CROSS_APP_JSON': {
          const stepId = addThinkingStep('Executing cross-app actions...');
          try {
            let actions: any[] = [];
            try {
              actions = JSON.parse(command.value || command.context || '[]');
              if (!Array.isArray(actions)) actions = [actions];
            } catch (parseErr) {
              output = 'Invalid CROSS_APP_JSON format. Use: [CROSS_APP_JSON: [{"type":"ocr","region":[x,y,w,h]},{"type":"click","app":"AppName","element":"Button"}]]';
              break;
            }
            
            const results: string[] = [];
            for (let i = 0; i < actions.length; i++) {
              const action = actions[i];
              const actionType = action.type?.toUpperCase();
              
              if (actionType === 'OCR' || actionType === 'CAPTURE') {
                const region = action.region || action.rect || [0, 0, 1920, 1080];
                const ocrId = addThinkingStep(`Cross-app OCR: region ${region}...`);
                const ocrRes = await window.electronAPI.ocrScreenText?.();
                const ocrText = typeof ocrRes === 'string' ? ocrRes : ((ocrRes as any)?.text || '');
                results.push(`OCR: ${ocrText.substring(0, 200)}...`);
                resolveThinkingStep(ocrId, 'done', 'OCR complete');
              } else if (actionType === 'CLICK' || actionType === 'TAP') {
                const appName = action.app || action.application || '';
                const elementText = action.element || action.text || action.label || '';
                const reason = action.reason || 'Cross-app click';
                const clickId = addThinkingStep(`Clicking ${appName}: ${elementText}...`);
                if (appName && elementText) {
                  const clickRes = await window.electronAPI.clickAppElement?.(appName, elementText, reason);
                  results.push(`Click ${appName}/${elementText}: ${clickRes?.success ? 'OK' : clickRes?.error || 'Failed'}`);
                  resolveThinkingStep(clickId, clickRes?.success ? 'done' : 'error', clickRes?.error || 'Done');
                } else if (action.x !== undefined && action.y !== undefined) {
                  const clickRes = await window.electronAPI.clickAt?.(action.x, action.y);
                  results.push(`Click at (${action.x}, ${action.y}): ${clickRes?.success ? 'OK' : clickRes?.error || 'Failed'}`);
                  resolveThinkingStep(clickId, clickRes?.success ? 'done' : 'error', clickRes?.error || 'Done');
                } else {
                  results.push(`Click: missing app/element or coordinates`);
                }
              } else if (actionType === 'TYPE' || actionType === 'INPUT') {
                const text = action.text || action.value || '';
                const typeId = addThinkingStep(`Typing: ${text.substring(0, 30)}...`);
                const typeRes = await window.electronAPI.typeTextApp?.(text);
                results.push(`Type "${text.substring(0, 30)}...": ${typeRes?.success ? 'OK' : typeRes?.error || 'Failed'}`);
                resolveThinkingStep(typeId, typeRes?.success ? 'done' : 'error', typeRes?.error || 'Done');
              } else if (actionType === 'WAIT' || actionType === 'DELAY') {
                const ms = action.ms || action.delay || 1000;
                await new Promise(r => setTimeout(r, ms));
                results.push(`Wait: ${ms}ms`);
              } else {
                results.push(`Unknown action: ${actionType}`);
              }
            }
            
            output = `Cross-app actions completed:\n${results.join('\n')}`;
            resolveThinkingStep(stepId, 'done', `${actions.length} actions executed`);
          } catch (e: any) {
            output = `CROSS_APP error: ${e.message}`;
            resolveThinkingStep(stepId, 'error', e.message);
          }
          break;
        }

        case 'ORGANIZE_TABS': {
          const organizeStepId = addThinkingStep('AI is Classifying Tabs...');
          try {
            const tabs = store.tabs;
            const tabsToClassify = tabs.map(t => ({ id: t.id, title: t.title, url: t.url || '' }));

            const urlCounts = new Map<string, string[]>();
            const closedDuplicates: string[] = [];

            tabs.forEach(t => {
              const url = t.url || '';
              if (url) {
                const normalized = url.replace(/\/$/, '').toLowerCase();
                const existing = urlCounts.get(normalized) || [];
                existing.push(t.id);
                urlCounts.set(normalized, existing);
              }
            });

            for (const [, tabIds] of urlCounts) {
              if (tabIds.length > 1) {
                for (let i = 1; i < tabIds.length; i++) {
                  store.removeTab(tabIds[i]);
                  closedDuplicates.push(tabIds[i]);
                }
              }
            }

            const result = await (window as any).electronAPI.classifyTabsAi({ tabs: tabsToClassify });
            if (result.success && result.classifications) {
              const classifications = result.classifications;
              const groupedTabs = new Map<string, string[]>();

              Object.entries(classifications).forEach(([tabId, groupName]) => {
                const existing = groupedTabs.get(groupName as string) || [];
                existing.push(tabId);
                groupedTabs.set(groupName as string, existing);
              });

              for (const [groupName, tabIds] of groupedTabs) {
                if (tabIds.length > 0) {
                  store.groupTabs(tabIds, groupName);
                }
              }

              const uniqueGroups = groupedTabs.size;
              const totalClosed = closedDuplicates.length;
              const action = totalClosed > 0
                ? `Organized ${tabs.length} tabs into ${uniqueGroups} groups and closed ${totalClosed} duplicate.`
                : `Successfully organized ${tabs.length} tabs into ${uniqueGroups} groups.`;
              output = action;
              resolveThinkingStep(organizeStepId, 'done', action);
            } else {
              output = `Organization failed: ${result.error}`;
              resolveThinkingStep(organizeStepId, 'error', result.error);
            }
          } catch (e: any) {
            output = `Internal error organizing tabs: ${e.message}`;
            resolveThinkingStep(organizeStepId, 'error', e.message);
          }
          break;
        }

        case 'CLOSE_TAB': {
          const tabId = command.value.trim();
          if (!tabId) {
            output = 'Invalid tab ID to close.';
          } else {
            store.removeTab(tabId);
            output = `Closed tab: ${tabId}`;
          }
          break;
        }

        case 'SET_THEME':
          storeSetTheme(command.value as any);
          output = `Theme set to ${command.value}`;
          break;


        case 'OPEN_VIEW': {
          setActiveView(command.value as any);
          output = `Switched to ${command.value} view`;
          break;
        }

        case 'GENERATE_IMAGE': {
          let prompt = command.value || 'An artistic masterpiece';
          let style = '';

          // Try to parse JSON if it looks like JSON
          if (prompt.trim().startsWith('{') && prompt.trim().endsWith('}')) {
            try {
              const data = JSON.parse(prompt);
              prompt = data.prompt || data.value || prompt;
              style = data.style || '';
            } catch { /* not JSON, use as string */ }
          }

          const fullPrompt = style ? `${prompt} in ${style} style` : prompt;
          const genId = addThinkingStep(`Generating image with AI: ${fullPrompt}...`);
          try {
            const generateImage = (window.electronAPI as typeof window.electronAPI & {
              generateImage?: (payload: { prompt: string }) => Promise<{ success: boolean; imageUrl?: string; imagePath?: string; error?: string }>;
            }).generateImage;

            if (!generateImage) {
              output = 'Image generation is not available in this build.';
              resolveThinkingStep(genId, 'error', output);
              break;
            }

            const res = await generateImage({ prompt: fullPrompt });
            if (res.success) {
              output = `Image generated successfully: ${res.imageUrl || res.imagePath}`;
              resolveThinkingStep(genId, 'done', 'Image generated');
              const url = res.imageUrl || (res.imagePath ? `file://${res.imagePath}` : '');
              if (url) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  const imgItem: MediaItem = {
                    id: `gen-img-${Date.now()}`,
                    type: 'image',
                    url: url,
                    title: 'Generated Image',
                    description: prompt
                  };
                  if (last && last.role === 'model') {
                    return [...prev.slice(0, -1), { ...last, mediaItems: [...(last.mediaItems || []), imgItem] }];
                  }
                  return [...prev, { role: 'model', content: `I've generated an image for you: ${prompt}`, mediaItems: [imgItem] }];
                });
              }
            } else {
              output = `Failed to generate image: ${res.error}`;
              resolveThinkingStep(genId, 'error', res.error);
            }
          } catch (e: any) {
            output = `Image generation error: ${e.message}`;
            resolveThinkingStep(genId, 'error', e.message);
          }
          break;
        }

        case 'APPLE_INTELLIGENCE_IMAGE': {
          const prompt = command.value || 'A beautiful landscape';
          const genId = addThinkingStep(`Generating image with Apple Intelligence: ${prompt}...`);
          try {
            const res = await window.electronAPI.generateAppleIntelligenceImage({ prompt });
            if (res.success) {
              output = `Image generated successfully: ${res.imagePath}`;
              resolveThinkingStep(genId, 'done', 'Image generated');
              if (res.imagePath) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  const imgItem: MediaItem = { id: `ai-img-${Date.now()}`, type: 'image', url: `file://${res.imagePath}`, title: 'Apple Intelligence Image', description: prompt };
                  if (last && last.role === 'model') {
                    return [...prev.slice(0, -1), { ...last, mediaItems: [...(last.mediaItems || []), imgItem] }];
                  }
                  return [...prev, { role: 'model', content: `I've generated an image for you: ${prompt}`, mediaItems: [imgItem] }];
                });
              }
            } else {
              output = `Apple image generation failed: ${res.error || res.imageReason || 'Unknown error'}`;
              resolveThinkingStep(genId, 'error', output);
            }
          } catch (e: any) {
            output = `Apple Intelligence error: ${e.message}`;
            resolveThinkingStep(genId, 'error', e.message);
          }
          break;
        }

        case 'APPLE_INTELLIGENCE_SUMMARY': {
          let textToSummarize = command.value || '';
          const sumId = addThinkingStep('Checking Apple Intelligence availability...');

          try {
            // Check Apple Intelligence availability first
            const status = await window.electronAPI.getAppleIntelligenceStatus?.();
            if (!status?.success) {
              resolveThinkingStep(sumId, 'error', 'Apple Intelligence is not available on this system.');
              setMessages(prev => [...prev, { 
                role: 'model', 
                content: `🍎 **Apple Intelligence Unavailable**\n\nApple Intelligence is not available on this system. This feature requires:\n- macOS 15.1+ (Sequoia or later)\n- Apple Silicon Mac (M1+)\n\nPlease use a different AI provider for summaries.` 
              }]);
              break;
            }

            // Use DOM for faster/better summary if no specific text provided
            if (!textToSummarize) {
              const domRes = await window.electronAPI.extractPageContent();
              textToSummarize = domRes.content || '';
              if (!textToSummarize) {
                resolveThinkingStep(sumId, 'error', 'No page content found to summarize.');
                setMessages(prev => [...prev, { role: 'model', content: "I couldn't find any content on the current page to summarize." }]);
                break;
              }
            }

            updateThinkingStep(sumId, 'Summarizing with Apple local models...');
            const res = await window.electronAPI.summarizeWithAppleIntelligence(textToSummarize);

            if (res.success && res.summary) {
              output = `Summary: ${res.summary}`;
              resolveThinkingStep(sumId, 'done', 'Summary created');
              setMessages(prev => [...prev, { role: 'model', content: `🍏 **Apple Intelligence Summary:**\n\n${res.summary}` }]);
            } else {
              output = `Apple summarization failed: ${res.error || 'Please ensure you have macOS 15.1+ and Apple Silicon Mac.'}`;
              resolveThinkingStep(sumId, 'error', output);
              setMessages(prev => [...prev, { 
                role: 'model', 
                content: `⚠️ **Apple Intelligence Error:**\n\n${res.error || 'Please ensure you have macOS 15.1+ and Apple Silicon Mac.'}` 
              }]);
            }
          } catch (e: any) {
            output = `Apple Intelligence error: ${e.message}`;
            resolveThinkingStep(sumId, 'error', e.message);
            setMessages(prev => [...prev, { 
              role: 'model', 
              content: `⚠️ **Apple Intelligence Error:**\n\n${e.message || 'Failed to run Apple Intelligence. Please ensure you have macOS 15.1+ and Apple Silicon Mac.'}` 
            }]);
          }
          break;
        }

        // ── GENERATE_DIAGRAM: render Mermaid diagram in chat ────────────────────
        case 'GENERATE_DIAGRAM': {
          const mermaidCode = command.value || command.context || '';
          if (!mermaidCode || mermaidCode.length < 10) {
            output = 'No valid Mermaid code provided.';
            break;
          }
          const diagramId = `mermaid-${Date.now()}`;
          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const existing = last.mediaItems || [];
            updated[updated.length - 1] = {
              ...last,
              mediaItems: [...existing, {
                type: 'mermaid',
                diagramId,
                code: mermaidCode
              }]
            };
            return updated;
          });
          output = `Diagram generated successfully`;
          break;
        }

        // ── GENERATE_FLOWCHART: render custom flowchart in chat ─────────────────
        case 'GENERATE_FLOWCHART': {
          const flowchartCode = command.value || command.context || '';
          if (!flowchartCode || flowchartCode.length < 5) {
            output = 'No valid flowchart code provided.';
            break;
          }
          const flowchartId = `flowchart-${Date.now()}`;
          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const existing = last.mediaItems || [];
            updated[updated.length - 1] = {
              ...last,
              mediaItems: [...existing, {
                type: 'flowchart',
                diagramId: flowchartId,
                code: flowchartCode
              }]
            };
            return updated;
          });
          output = `Flowchart generated successfully`;
          break;
        }

        // ── GENERATE_CHART: render Chart.js chart in chat ───────────────────────
        case 'GENERATE_CHART': {
          let chartData: any;
          try {
            chartData = robustJSONParse(command.value || command.context || '{}');
          } catch {
            output = 'Invalid chart data JSON.';
            break;
          }
          if (!chartData.datasets || chartData.datasets.length === 0) {
            output = 'No valid chart datasets provided.';
            break;
          }
          const chartId = `chart-${Date.now()}`;
          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const existing = last.mediaItems || [];
            updated[updated.length - 1] = {
              ...last,
              mediaItems: [...existing, {
                type: 'chart',
                chartId,
                data: chartData,
                options: chartData.options || {}
              }]
            };
            return updated;
          });
          output = `Chart generated successfully`;
          break;
        }

        case 'SET_VOLUME': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
          const confirmed = await requestActionPermission({
            actionType: 'SET_VOLUME',
            action: 'Set Volume',
            target: command.value,
            what: `${command.value}%`,
            reason: command.reason || 'The AI wants to change the system volume.',
            risk: 'medium',
          });
          if (!confirmed) {
            output = 'Volume change denied by user.';
            break;
          }
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          await window.electronAPI.setVolume(parseInt(command.value));
          output = `System volume adjusted to ${command.value}%`;
          break;
        }

        case 'SET_BRIGHTNESS': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
          const confirmed = await requestActionPermission({
            actionType: 'SET_BRIGHTNESS',
            action: 'Set Brightness',
            target: command.value,
            what: `${command.value}%`,
            reason: command.reason || 'The AI wants to change the display brightness.',
            risk: 'medium',
          });
          if (!confirmed) {
            output = 'Brightness change denied by user.';
            break;
          }
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          await window.electronAPI.setBrightness(parseInt(command.value));
          output = `Screen brightness adjusted to ${command.value}%`;
          break;
        }

        case 'SHELL_COMMAND': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          const logId = `term-${Date.now()}-${terminalLogIdCounter.current++}`;
          const logEntry = { id: logId, command: command.value, output: '', success: false, timestamp: Date.now() };
          setShowTerminal(true);
          setTerminalLogs(prev => [...prev, { ...logEntry, output: '⏳ Running...' }]);
          const res = await window.electronAPI.executeShellCommand({
            rawCommand: command.value,
            reason: command.reason,
            riskLevel: command.riskLevel || 'medium'
          });
          const cmdOutput = res.success ? (res.output || '(no output)') : `Error: ${res.error}`;
          setTerminalLogs(prev => prev.map(l => l.id === logId
            ? { ...l, output: cmdOutput, success: !!res.success }
            : l
          ));
          output = res.success
            ? `$ ${command.value}\n${cmdOutput}`
            : res.error === 'User blocked the command.'
              ? 'Command execution denied by user.'
              : `$ ${command.value}\n${cmdOutput}`;
          break;
        }

        case 'OPEN_APP': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
          const confirmed = await requestActionPermission({
            actionType: 'OPEN_APP',
            action: 'Open Application',
            target: command.value,
            what: command.value,
            reason: 'The AI wants to launch an external application.',
            risk: 'medium',
          });
          if (confirmed) {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
            await window.electronAPI.openExternalApp(command.value);
            output = `Application ${command.value} launched.`;
          } else {
            output = 'App launch denied by user.';
          }
          break;
        }

        case 'LIST_AUTOMATIONS': {
          const result = (window.electronAPI?.getScheduledTasks ? await window.electronAPI.getScheduledTasks() : []) as any;
          const tasks: any[] = Array.isArray(result) ? result : (Array.isArray(result?.tasks) ? result.tasks : []);
          if (!tasks.length) {
            output = 'No automation tasks are currently scheduled.';
          } else {
            output = tasks.map((task: any, idx: number) => {
              const label = task.name || `Task ${idx + 1}`;
              const schedule = task.schedule || 'custom';
              const status = task.enabled ? 'Active' : 'Paused';
              return `${idx + 1}. ${label} — ${schedule} (${status})`;
            }).join('\n');
          }
          break;
        }

        case 'DELETE_AUTOMATION': {
          let taskId = command.value?.trim();
          if (taskId?.startsWith('{')) {
            try {
              const parsed = JSON.parse(taskId);
              taskId = parsed.id || parsed.taskId || taskId;
            } catch {
              taskId = taskId.replace(/[{}]/g, '').split(':').pop()?.trim() || taskId;
            }
          }
          if (!taskId) {
            output = 'Provide the automation ID you want to delete.';
            break;
          }
          if (!window.electronAPI?.deleteScheduledTask) {
            output = 'Automation DELETE API is unavailable.';
            break;
          }
          const res = await window.electronAPI.deleteScheduledTask(taskId);
          if (res?.success) {
            output = `Deleted automation ${taskId}.`;
          } else {
            output = `Failed to delete automation: ${res?.error || 'unknown error'}.`;
          }
          break;
        }

        case 'OPEN_PDF': {
          const filePath = command.value;
          const res = await window.electronAPI.openPDF(filePath);
          output = res.success ? `Opened PDF: ${filePath}` : `Failed to open PDF: ${res.error}`;
          break;
        }

        case 'SCHEDULE_TASK': {
          let taskData: { schedule?: string; type?: string; name?: string; description?: string } = {};
          let rawValue = (command.value || '').trim();

          // Try JSON format first
          try {
            // Handle JSON wrapped in code blocks or quotes
            if (rawValue.includes('{')) {
              const jsonMatch = rawValue.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                taskData = JSON.parse(jsonMatch[0]);
              }
            } else {
              taskData = JSON.parse(rawValue);
            }
          } catch {
            // Fall back to pipe-separated format
            const parts = rawValue.split('|').map(p => p.trim());
            const [cron, taskType, taskName, description] = parts;
            taskData = { schedule: cron, type: taskType, name: taskName, description };
          }

          const { schedule, type, name, description } = taskData;

          if (!schedule || !type || !name) {
            output = 'SCHEDULE_TASK requires: {"schedule": "cron", "type": "pdf-generate", "name": "Task Name", "description": "..."}';
            break;
          }

          try {
            const intent = {
              detected: true,
              confidence: 'high' as const,
              taskName: name,
              taskType: type as any,
              schedule: {
                type: 'cron' as const,
                expression: schedule,
                description: `Scheduled: ${schedule}`,
              },
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              outputPath: '~/Documents/Comet-AI',
            };

            setSchedulingIntent(intent);
            setShowSchedulingModal(true);
            if (props.setBrowserDisabled) props.setBrowserDisabled(true);
            output = `Scheduling modal opened for task: ${name}`;
          } catch (error) {
            output = `Failed to schedule task: ${(error as Error).message}`;
          }
          break;
        }

        // ✅ NEW: CREATE_PDF_JSON / CREATE_FILE_JSON - Primary JSON-based generation
        // Format: JSON object with structured pages/sections (or slides) and images
        case 'CREATE_PDF_JSON':
        case 'CREATE_FILE_JSON': {
          // Handle models that send structured objects instead of strings
          let rawValue: any = command.value ?? '';
          if (typeof rawValue !== 'string') {
            try {
              rawValue = JSON.stringify(rawValue);
            } catch {
              rawValue = String(rawValue);
            }
          }
          rawValue = (rawValue as string).trim();

          // Clean up malformed input
          rawValue = rawValue.replace(/^\s*\]+\s*:\s*/, '').trim();

          let pdfData: any = null;

          // Use robust JSON parsing - tries multiple strategies
          const strategies: Array<() => any> = [
            // 1) Direct robust parse of the whole value
            () => robustJSONParse(rawValue).data,
            // 2) Extract from markdown code blocks
            () => {
              const match = rawValue.match(/```(?:json)?\s*([\s\S]*?)```/);
              return match ? robustJSONParse(match[1].trim()).data : null;
            },
            // 3) Find JSON object with title/pages anywhere in text
            () => {
              const match = rawValue.match(/\{[\s\S]*?"(?:title|pages|format)"[\s\S]*?\}/);
              return match ? robustJSONParse(match[0]).data : null;
            },
            // 4) Find first { ... } block
            () => {
              const match = rawValue.match(/\{[\s\S]*?\}/);
              return match ? robustJSONParse(match[0]).data : null;
            },
          ];

          for (const strategy of strategies) {
            try {
              const result = strategy();
              if (result && typeof result === 'object') {
                // If wrapped as { commands: [ {type,value}, ... ] }, extract inner value
                if (Array.isArray(result.commands)) {
                  const inner = result.commands.find((c: any) =>
                    typeof c?.type === 'string' &&
                    ['CREATE_FILE_JSON', 'CREATE_PDF_JSON'].includes(c.type));
                  if (inner?.value) {
                    if (typeof inner.value === 'string') {
                      const innerResult = robustJSONParse(inner.value);
                      if (innerResult.success) {
                        pdfData = innerResult.data;
                        break;
                      }
                      try { pdfData = JSON.parse(inner.value); break; } catch { /* fall through */ }
                      pdfData = inner.value;
                      break;
                    }
                    pdfData = inner.value;
                    break;
                  }
                }
                pdfData = result;
                break;
              }
            } catch { /* try next strategy */ }
          }

          if (!pdfData || typeof pdfData !== 'object') {
            output = `⚠️ JSON parsing failed. Please use proper JSON format.`;
            output += `\n\n**Correct format:**\n\`\`\`json\n{\n  "title": "Document Title",\n  "template": "professional",\n  "content": "Your content here..."\n}\n\`\`\``;
            output += `\n\nOr use markdown format: [GENERATE_PDF: Title | actual content here...]`;
            break;
          }

          if (!pdfData) pdfData = {};

          // slides alias -> pages
          if (!pdfData.pages && Array.isArray(pdfData.slides)) {
            pdfData.pages = pdfData.slides.map((slide: any, i: number) => {
              const sections: any[] = [];
              if (Array.isArray(slide.sections)) {
                slide.sections.forEach((s: any) => sections.push(s));
              } else if (Array.isArray(slide.content)) {
                slide.content.forEach((c: any, idx: number) => {
                  sections.push({ title: slide.sectionTitles?.[idx] || '', content: c });
                });
              } else if (typeof slide.content === 'string') {
                sections.push({ title: '', content: slide.content });
              }
              return {
                title: slide.title || `Slide ${i + 1}`,
                icon: slide.icon,
                sections: sections.length ? sections : [{ title: '', content: slide.content || '' }],
                images: slide.images,
              };
            });
          }

          // Minimal one-page fallback
          if (!pdfData.pages && pdfData.content) {
            pdfData.pages = [{
              title: pdfData.title || 'Document',
              sections: [{ title: pdfData.subtitle || 'Content', content: pdfData.content }]
            }];
          }

          // Validate required fields
          if (!pdfData.title && !pdfData.pages) {
            output = '❌ JSON must have at least "title" or "pages" field';
            break;
          }

          // Infer format: explicit -> use it; slides without format -> assume pptx; else pdf
          let format = (pdfData.format || pdfData.output?.format || '').toLowerCase();
          if (!format && pdfData.slides && !pdfData.pages) format = 'pptx';
          if (!format) format = 'pdf';

          // Extract method: html (default), pdfmake, or pdf-lib
          const method = (pdfData.method || pdfData.generationMethod || 'html').toLowerCase();

          const pdfTitle = pdfData.title || 'Document';
          const pdfSubtitle = pdfData.subtitle || '';
          const pdfAuthor = pdfData.author || '';
          const template = pdfData.template || 'professional';
          const watermark = pdfData.watermark || '';
          const bgColor = pdfData.bgColor || '#ffffff';
          const priority = pdfData.priority || 'normal';

          // Extract images from JSON (new action format)
          const pdfImagesFromJson: Array<{ type: string; src?: string; caption?: string; alt?: string; width?: number | string }> = [];
          const addImage = (img: any) => {
            if (!img) return;
            if ((img.type === 'url' || !img.type) && img.src) {
              pdfImagesFromJson.push({ type: 'url', src: img.src, caption: img.caption, alt: img.alt, width: img.width });
            } else if (img.type === 'screenshot') {
              pdfImagesFromJson.push({ type: 'screenshot', caption: img.caption, alt: img.alt || 'Screenshot', width: img.width || '100%' });
            }
          };
          if (pdfData.images && Array.isArray(pdfData.images)) {
            for (const img of pdfData.images) addImage(img);
          }
          if (Array.isArray(pdfData.pages)) {
            pdfData.pages.forEach((p: any) => {
              if (Array.isArray(p.images)) p.images.forEach((img: any) => addImage(img));
            });
          }

          // Build markdown content from JSON structure
          let pdfContent = '';

          // Add metadata at the top
          const metaParts: string[] = [];
          if (pdfSubtitle) metaParts.push(`*${pdfSubtitle}*`);
          if (pdfAuthor && pdfAuthor !== 'Comet AI') metaParts.push(`**Author:** ${pdfAuthor}`);
          if (metaParts.length > 0) {
            pdfContent += metaParts.join('\n') + '\n\n---\n\n';
          }

          // Process pages
          if (pdfData.pages && Array.isArray(pdfData.pages)) {
            for (let i = 0; i < pdfData.pages.length; i++) {
              const page = pdfData.pages[i];

              // Page title
              pdfContent += `## ${page.icon || ''} ${page.title || `Section ${i + 1}`}\n\n`;

              // Process sections
              if (page.sections && Array.isArray(page.sections)) {
                for (const section of page.sections) {
                  if (section.title) {
                    pdfContent += `### ${section.icon || ''} ${section.title}\n\n`;
                  }
                  pdfContent += `${section.content || ''}\n\n`;
                }
              } else if (page.content) {
                // Fallback: page has direct content
                pdfContent += `${page.content}\n\n`;
              }

              // Page break between pages (except last)
              if (i < pdfData.pages.length - 1) {
                pdfContent += '\n---\n\n';
              }
            }
          } else if (pdfData.content) {
            // Fallback: direct content
            pdfContent += pdfData.content;
          }

          // Add metadata markers for template processing
          const metadataMarkers = [
            `[TEMPLATE:${template}]`,
            watermark ? `[WATERMARK:${watermark}]` : '',
            bgColor !== '#ffffff' ? `[BG_COLOR:${bgColor}]` : '',
            priority !== 'normal' ? `[PRIORITY:${priority}]` : '',
          ].filter(Boolean).join('');

          pdfContent = metadataMarkers + '\n\n' + pdfContent;

          // Process images from JSON (URLs need fetching, screenshots need capture)
          const jsonImageResults: Array<{ src: string; caption?: string; alt?: string; width?: string | number }> = [];

          if (pdfImagesFromJson.length > 0) {
            console.log(`[PDF-LOG] Processing ${pdfImagesFromJson.length} images from JSON...`);
            if (isDevMode) appendTerminalLog('JSON Images', `Processing ${pdfImagesFromJson.length} images from JSON...`);
          }

          for (const img of pdfImagesFromJson) {
            if (img.type === 'url' && img.src) {
              try {
                const normalized = img.src.startsWith('http') ? img.src : `https://${img.src}`;
                console.log(`[PDF-LOG] Fetching JSON image: ${normalized}`);
                if (isDevMode) appendTerminalLog('Image Fetch', `Fetching JSON image: ${normalized}`);
                const response = await fetch(normalized);
                if (response.ok) {
                  const blob = await response.blob();
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error('Failed to read image'));
                    reader.readAsDataURL(blob);
                  });
                  console.log(`[PDF-LOG] ✅ JSON image fetched successfully: ${normalized} (${Math.round(dataUrl.length / 1024)}KB)`);
                  if (isDevMode) appendTerminalLog('Image Fetch', `✅ Loaded: ${normalized} (${Math.round(dataUrl.length / 1024)}KB)`);
                  jsonImageResults.push({
                    src: dataUrl,
                    caption: img.caption,
                    alt: img.alt || 'Embedded image',
                    width: img.width || '100%'
                  });
                } else {
                  console.log(`[PDF-LOG] ❌ Failed to fetch JSON image: ${normalized} (HTTP ${response.status})`);
                  if (isDevMode) appendTerminalLog('Image Fetch', `❌ Failed: ${normalized} (${response.status})`, false);
                }
              } catch (e: any) {
                console.log(`[PDF-LOG] ❌ Exception fetching JSON image: ${img.src} - ${e.message}`);
                if (isDevMode) appendTerminalLog('Image Fetch', `❌ Error: ${img.src} - ${e.message}`, false);
              }
            } else if (img.type === 'screenshot') {
              try {
                console.log(`[PDF-LOG] Capturing screenshot for PDF...`);
                if (isDevMode) appendTerminalLog('Screenshot', '📸 Capturing browser view for JSON image...');
                updateVisualStage('capturing', 'Capturing screenshot for PDF...');
                const dataUrl: string | null = await window.electronAPI.captureBrowserViewScreenshot();
                if (dataUrl) {
                  console.log(`[PDF-LOG] ✅ Screenshot captured (${Math.round(dataUrl.length / 1024)}KB)`);
                  if (isDevMode) appendTerminalLog('Screenshot', `✅ Captured (${Math.round(dataUrl.length / 1024)}KB) - added to PDF`);
                  jsonImageResults.push({
                    src: dataUrl,
                    caption: img.caption || `Screenshot at ${new Date().toLocaleTimeString()}`,
                    alt: img.alt || 'Browser screenshot',
                    width: img.width || '100%'
                  });
                } else {
                  console.log(`[PDF-LOG] ❌ No browser view available for screenshot`);
                  if (isDevMode) appendTerminalLog('Screenshot', '❌ No browser view available', false);
                }
              } catch (e: any) {
                console.log(`[PDF-LOG] ❌ Screenshot capture failed: ${e.message}`);
                if (isDevMode) appendTerminalLog('Screenshot', `❌ Error: ${e.message}`, false);
              } finally {
                updateVisualStage('idle');
              }
            }
          }

          // ✅ Process [CAPTURE_SCREEN] inline tags in PDF content
          const screenshotTagRegex = /\[CAPTURE_SCREEN\s*(?:\|\s*caption:([^\]]+))?\]/gi;
          let screenshotMatch;
          while ((screenshotMatch = screenshotTagRegex.exec(pdfContent)) !== null) {
            const rawTag = screenshotMatch[0];
            const cap = (screenshotMatch[1] || '').trim();
            try {
              console.log(`[PDF-LOG] Processing inline [CAPTURE_SCREEN] tag...`);
              if (isDevMode) appendTerminalLog('Screenshot', '📸 Capturing browser view for inline tag...');
              const dataUrl = await window.electronAPI.captureBrowserViewScreenshot();
              if (dataUrl) {
                const imgMd = `\n\n![Screenshot](${dataUrl})${cap ? `\n*${cap}*` : ''}\n\n`;
                // Use a safe multi-replace approach
                pdfContent = pdfContent.split(rawTag).join(imgMd);
                console.log(`[PDF-LOG] ✅ Inline screenshot captured and replaced`);
              } else {
                pdfContent = pdfContent.split(rawTag).join('\n\n*[Current browser view unavailable for screenshot]*\n\n');
              }
            } catch (e: any) {
              console.error('[PDF] Inline screenshot failed:', e);
              pdfContent = pdfContent.split(rawTag).join(`\n\n*[Error capturing screenshot: ${e.message}]*\n\n`);
            }
          }

          // ✅ Process [IMAGE_URL] inline tags in PDF content
          const inlineImageUrlRegex = /\[IMAGE_URL:([\s\S]+?)\]/gi;
          let imageUrlMatch;
          while ((imageUrlMatch = inlineImageUrlRegex.exec(pdfContent)) !== null) {
            const raw = imageUrlMatch[0];
            const payload = (imageUrlMatch[1] || '').trim();
            if (!payload) continue;

            const segments = payload.split('|').map(segment => segment.trim()).filter(Boolean);
            if (segments.length === 0) continue;

            const rawUrl = segments.shift() || '';
            const url = rawUrl.replace(/\s+/g, '');
            if (!url) continue;

            let cap: string | undefined;
            segments.forEach(segment => {
              const [key, ...valueParts] = segment.split(':');
              if (!key || valueParts.length === 0) return;
              if (key.toLowerCase().trim() === 'caption') {
                cap = valueParts.join(':').trim();
              }
            });

            try {
              const normalized = url.startsWith('http') ? url : `https://${url}`;
              console.log(`[PDF-LOG] Fetching inline [IMAGE_URL]: ${normalized}`);
              if (isDevMode) appendTerminalLog('Image Fetch', `📸 Fetching inline asset: ${normalized}`);

              const imgRes = await fetch(normalized);
              if (imgRes.ok) {
                const blob = await imgRes.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = () => reject(new Error('Failed to read image'));
                  reader.readAsDataURL(blob);
                });
                const imgMd = `\n\n![Image](${dataUrl})${cap ? `\n*${cap}*` : ''}\n\n`;
                pdfContent = pdfContent.split(raw).join(imgMd);
                console.log(`[PDF-LOG] ✅ Inline image fetched and replaced: ${normalized}`);
                if (isDevMode) appendTerminalLog('Image Fetch', `✅ Loaded: ${normalized}`);
              } else {
                pdfContent = pdfContent.split(raw).join(`\n\n*[Failed to fetch image: ${normalized} (HTTP ${imgRes.status})]*\n\n`);
                if (isDevMode) appendTerminalLog('Image Fetch', `❌ Failed: ${normalized} (${imgRes.status})`, false);
              }
            } catch (e: any) {
              console.error('[PDF] Inline image fetch failed:', e);
              pdfContent = pdfContent.split(raw).join(`\n\n*[Error fetching image: ${e.message}]*\n\n`);
              if (isDevMode) appendTerminalLog('Image Fetch', `❌ Error: ${e.message}`, false);
            }
          }

          if (jsonImageResults.length > 0) {
            console.log(`[PDF-LOG] ✅ Added ${jsonImageResults.length} images to PDF content`);
            if (isDevMode) appendTerminalLog('JSON Images', `✅ Added ${jsonImageResults.length} images to PDF`);
          }

          // Add JSON images to pdfContent as markdown
          if (jsonImageResults.length > 0) {
            const imagesMarkdown = '\n\n---\n\n## Images\n\n' +
              jsonImageResults.map((img, idx) => `![${img.alt || 'Image'}](${img.src})` + (img.caption ? `\n*${img.caption}*` : '')).join('\n\n');
            pdfContent += imagesMarkdown;
          }

          const commonPayload = {
            ...pdfData,
            format,
            title: pdfTitle,
            subtitle: pdfSubtitle,
            author: pdfAuthor,
            template,
            watermark,
            bgColor,
            priority,
            pages: pdfData.pages,
            images: jsonImageResults.length ? jsonImageResults : pdfImagesFromJson,
            content: pdfContent,
            pythonAvailable,
            method,
          };

          setIsGeneratingPDF(true);
          setPdfProgress(0);
          setShowTerminal(true);
          setStreamingPDFContent(`Preparing ${format.toUpperCase()}: ${pdfTitle}...`);

          await preloadCometIconLocal();
          const iconSource = (window as any).__cometIconBase64 || null;

          try {
            if (format === 'xlsx' || format === 'excel') {
              const res = await window.electronAPI.generateXLSX(commonPayload);
              output = res?.success
                ? `✅ **Excel Generated Successfully!**\n\n**Title:** ${pdfTitle}\n**File:** ${res.filePath || 'Saved to Downloads'}`
                : `❌ Excel generation failed: ${res?.error || 'Unknown error'}`;
            } else if (format === 'pptx') {
              const res = await window.electronAPI.generatePPTX(commonPayload);
              output = res?.success
                ? `✅ **PPTX Generated Successfully!**\n\n**Title:** ${pdfTitle}\n**File:** ${res.filePath || 'Saved to Downloads'}`
                : `❌ PPTX generation failed: ${res?.error || 'Unknown error'}`;
            } else if (format === 'docx') {
              const res = await window.electronAPI.generateDOCX(commonPayload);
              output = res?.success
                ? `✅ **DOCX Generated Successfully!**\n\n**Title:** ${pdfTitle}\n**File:** ${res.filePath || 'Saved to Downloads'}`
                : `❌ DOCX generation failed: ${res?.error || 'Unknown error'}`;
            } else {
              // ✅ Unified Proper PDF Engine (Stabilized HTML method)
              const cleanHTML = generateSmartPDF(pdfContent, iconSource, jsonImageResults);
              const res = await window.electronAPI.generatePDF(pdfTitle, cleanHTML) as any;
              if (res.success) {
                output = `✅ **PDF Generated Successfully!**\n\n**Title:** ${pdfTitle}\n**Engine:** Comet Neural Export\n**Template:** ${template}\n**File:** ${res.filePath}`;
              } else {
                output = `❌ PDF generation failed: ${res.error}`;
              }
            }
          } catch (e: any) {
            output = `❌ Error generating file: ${e.message}`;
          } finally {
            setIsGeneratingPDF(false);
            setPdfProgress(100);
            setStreamingPDFContent('');
          }
          break;
        }

        // ✅ FIXED: GENERATE_PDF now supports screenshots, custom title/author/subtitle
        // Format: [GENERATE_PDF: title | screenshot:yes | author:Name | subtitle:Subtitle | content...]
        // NOTE: This is now a FALLBACK - prefer CREATE_PDF_JSON for structured content
        case 'GENERATE_PDF': {
          let rawValue = command.value || '';

          // ── Clean up malformed input ────────────────────────────────────────
          // Fix cases like "[GENERATE_PDF: ]: content" or malformed brackets
          rawValue = rawValue
            .replace(/^\s*\]+\s*:\s*/, '') // Remove leading ]: or ]]: patterns
            .replace(/^\s*:\s*/, '') // Remove leading : pattern
            .trim();

          // ── Parse extended options from pipe-separated fields ───────────────
          const allParts = rawValue.split('|').map((p: string) => p.trim()).filter(p => p.length > 0);
          const options: Record<string, string> = {};
          const contentParts: string[] = [];

          for (const part of allParts) {
            // Skip empty parts or just "]:"
            if (!part || part === ']:' || part === ':') continue;

            // Parse key:value options
            const kvMatch = part.match(/^(title|author|subtitle|screenshot|filename|template|tags|category|watermark)\s*:\s*(.+)$/i);
            if (kvMatch) {
              const key = kvMatch[1].toLowerCase();
              const value = kvMatch[2].trim();
              // Skip if value is empty or just placeholder
              if (value && !/^\[?\s*\]?\s*$/.test(value) && value.toLowerCase() !== 'content' && value.toLowerCase() !== 'placeholder') {
                options[key] = value;
              }
            } else {
              contentParts.push(part);
            }
          }

          // If no content parts but we have context, use context
          if (contentParts.length === 0 && command.context) {
            contentParts.push(command.context);
          }

          // First non-option part is always the title if no explicit title: key
          let pdfTitle = options.title || contentParts[0]?.trim() || 'Document';

          // Clean up title if it's clearly malformed
          if (!pdfTitle || pdfTitle.length < 2 || /^\[?\s*\]?\s*$/.test(pdfTitle)) {
            pdfTitle = contentParts.length > 1 ? contentParts[1]?.trim() || 'Document' : 'Document';
          }

          // Fix for "title | actual title" or "title: actual title"
          if (pdfTitle.toLowerCase() === 'title' && contentParts[1]) {
            pdfTitle = contentParts[1];
            contentParts.splice(0, 1);
          }

          const pdfSubtitle = options.subtitle || '';
          const pdfAuthor = options.author || 'Comet AI';
          const mentionScreenshot = /screenshot|capture (?:the )?page|include this page/i.test(
            `${command.context || ''} ${contentParts.join(' ')}`
          );
          const shouldScreenshot = options.screenshot?.toLowerCase() === 'yes'
            || options.screenshot?.toLowerCase() === 'true'
            || mentionScreenshot;
          const shouldIncludeAttachments = options.attachments?.toLowerCase() !== 'no';

          // Build content from remaining parts (skip title)
          let pdfContent = contentParts.slice(1).join(' | ').trim();

          // If content is still empty or placeholder, try the first content part
          if (!pdfContent || pdfContent.length < 10 || /^\[?\s*\]?\s*$/.test(pdfContent)) {
            pdfContent = contentParts[0]?.trim() || command.context || '';
          }

          // ✅ NEW: If content is just a placeholder like "content", use the full message text passed in context
          if (!pdfContent || pdfContent.length < 50 || /\[content\]|placeholder|lorem ipsum/i.test(pdfContent) || pdfContent.toLowerCase() === 'content' || /^\[?\s*\]?\s*$/.test(pdfContent)) {
            if (command.context) {
              pdfContent = command.context;
            } else if (contentParts.length > 0) {
              // Use the longest content part
              const longestPart = contentParts.reduce((a, b) => a.length > b.length ? a : b, '');
              if (longestPart.length > pdfContent.length) {
                pdfContent = longestPart;
              }
            }
          }

          // Detect if this PDF needs live/current data
          const isDataPDF = /news|update|report|today|latest|tech|market|sports|daily/i.test(pdfTitle);
          const contentTooShort = pdfContent.length < 200 && !isDataPDF;
          const hasFakePlaceholder = /\[content\]|\[details\]|placeholder|lorem ipsum/i.test(pdfContent) || pdfContent.toLowerCase() === 'content';

          if (isDataPDF || contentTooShort || hasFakePlaceholder) {
            const searchId = addThinkingStep(`🔍 Fetching real data for "${pdfTitle}"...`);
            try {
              const topic = pdfTitle
                .replace(/\b(pdf|report|daily|today|–|-|news|tech)\b/gi, '')
                .trim()
                .slice(0, 60) || 'latest news';

              const realData = await fetchRealSearchContext(topic);

              if (realData && realData.length > 100) {
                pdfContent = pdfContent
                  ? `${pdfContent}\n\n--- VERIFIED REAL-TIME DATA ---\n${realData}`
                  : `--- VERIFIED REAL-TIME DATA ---\n${realData}`;
                resolveThinkingStep(searchId, 'done', `Real data injected (${realData.length} chars)`);
              } else {
                resolveThinkingStep(searchId, 'error', 'Search returned no data — PDF will note data unavailability');
                pdfContent = pdfContent || `This report could not retrieve live data at the time of generation (${new Date().toLocaleString()}). Please search manually for current information.`;
              }
            } catch (e: any) {
              resolveThinkingStep(searchId, 'error', `Search failed: ${e.message}`);
            }
          }

          // ── Capture browser page screenshot (active tab only) ──────────────
          // Uses Electron's webContents.capturePage() via captureBrowserViewScreenshot
          const pdfImages: import('./ai/AIUtils').PDFImage[] = [];
          const inlineImageTags: { raw: string; url: string; caption?: string; alt?: string }[] = [];
          const inlineImageRegex = /\[IMAGE_URL:([\s\S]+?)\]/gi;
          let imageTagMatch;
          while ((imageTagMatch = inlineImageRegex.exec(pdfContent)) !== null) {
            const raw = imageTagMatch[0];
            const payload = (imageTagMatch[1] || '').trim();
            if (!payload) continue;
            const segments = payload.split('|').map(segment => segment.trim()).filter(Boolean);
            if (segments.length === 0) continue;
            const rawUrl = segments.shift() || '';
            const url = rawUrl.replace(/\s+/g, '');
            if (!url) continue;
            let alt: string | undefined;
            let caption: string | undefined;
            segments.forEach(segment => {
              const [key, ...valueParts] = segment.split(':');
              if (!key || valueParts.length === 0) return;
              const normalizedKey = key.toLowerCase().trim();
              const value = valueParts.join(':').trim().replace(/\s+/g, ' ');
              if (!value) return;
              if (normalizedKey === 'alt') {
                alt = value;
              } else if (normalizedKey === 'caption') {
                caption = value;
              }
            });
            inlineImageTags.push({
              raw,
              url,
              alt,
              caption,
            });
          }

          if (inlineImageTags.length > 0) {
            updateVisualStage('fetching', 'Fetching inline visuals...');
          }
          const inlineImagePromises = inlineImageTags.map(async (tag) => {
            const normalized = tag.url.startsWith('http') ? tag.url : `https://${tag.url}`;
            if (isDevMode) appendTerminalLog('Image Fetch', `Requesting ${normalized}`);
            console.log(`[PDF-LOG] Fetching inline image for PDF: ${normalized}`);
            try {
              const response = await fetch(normalized);
              if (!response.ok) {
                if (isDevMode) appendTerminalLog('Image Fetch', `Failed to fetch ${normalized} (${response.status})`, false);
                return null;
              }
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read image'));
                reader.readAsDataURL(blob);
              });
              if (isDevMode) appendTerminalLog('Image Fetch', `Fetched inline image ${normalized}`, true);
              console.log(`[PDF-LOG] Loaded inline image (${normalized}) for PDF`);
              return { ...tag, src: dataUrl };
            } catch (err: any) {
              if (isDevMode) appendTerminalLog('Image Fetch', `Failed to fetch ${normalized}: ${err?.message || 'unknown'}`, false);
              console.log(`[PDF-LOG] Inline image fetch failed: ${normalized} (${err?.message || 'unknown'})`);
              return null;
            }
          });

          const inlineImages = (await Promise.all(inlineImagePromises)).filter(Boolean) as Array<{
            raw: string;
            src: string;
            caption?: string;
            alt?: string;
          }>;
          inlineImages.forEach((img) => {
            pdfContent = pdfContent.replace(img.raw, '');
            pdfImages.push({
              src: img.src,
              alt: img.alt || 'Embedded image',
              caption: img.caption || 'Embedded image from URL',
              width: '100%',
            });
          });
          if (inlineImageTags.length > 0) {
            updateVisualStage('idle');
          }
          if (inlineImages.length > 0 && isDevMode) {
            appendTerminalLog('Image Fetch', `Loaded ${inlineImages.length} inline images`);
          }

          // ── Include user-uploaded attachments ──────────────────────────────
          if (shouldIncludeAttachments) {
            // Get all attachments from the entire current conversation history
            const allAttachments = messages.flatMap(m => (m as ExtendedChatMessage).attachments || []);
            if (allAttachments.length > 0) {
              allAttachments.forEach((data, i) => {
                pdfImages.push({
                  src: data,
                  alt: `User Attachment ${i + 1}`,
                  caption: `User-provided visual data #${i + 1}`,
                  width: '100%'
                });
              });
            }
          }

          if (shouldScreenshot) {
            updateVisualStage('capturing', 'Capturing browser screenshot...');
            const ssId = addThinkingStep('📸 Capturing browser page for PDF...');
            if (isDevMode) appendTerminalLog('Screenshot', 'Starting browser view capture for PDF...');
            console.log('[PDF-LOG] Capturing browser view screenshot for PDF...');
            try {
              const dataUrl: string | null = await window.electronAPI.captureBrowserViewScreenshot();
              if (dataUrl) {
                pdfImages.push({
                  src: dataUrl,
                  alt: 'Browser Page Screenshot',
                  caption: `Page screenshot at ${new Date().toLocaleTimeString()} — ${currentUrl || 'active tab'}`,
                  width: '100%'
                });
                const screenshotMarkdown = `\n\n![Browser Screenshot | Captured at ${new Date().toLocaleTimeString().replace(/:/g, '-')}](${dataUrl})`;
                if (!pdfContent.includes(screenshotMarkdown)) {
                  pdfContent += screenshotMarkdown;
                }
                resolveThinkingStep(ssId, 'done', 'Browser page screenshot captured');
                if (isDevMode) appendTerminalLog('Screenshot', 'Browser screenshot captured and added to PDF');
                console.log('[PDF-LOG] Browser screenshot captured and queued for PDF');
              } else {
                resolveThinkingStep(ssId, 'error', 'No browser view active to screenshot');
                if (isDevMode) appendTerminalLog('Screenshot', 'No browser view available for screenshot', false);
                console.log('[PDF-LOG] Browser screenshot unavailable (hidden tab or no active view)');
              }
            } catch (e: any) {
              resolveThinkingStep(ssId, 'error', `Screenshot failed: ${e.message}`);
              if (isDevMode) appendTerminalLog('Screenshot', `Screenshot failed: ${e.message}`, false);
              console.log(`[PDF-LOG] Screenshot capture error: ${e.message}`);
            } finally {
              updateVisualStage('idle');
            }
          }

          // ── Prepend subtitle/author to content if provided ─────────────────
          if (pdfSubtitle || pdfAuthor !== 'Comet AI') {
            const meta: string[] = [];
            if (pdfSubtitle) meta.push(`*${pdfSubtitle}*`);
            if (pdfAuthor && pdfAuthor !== 'Comet AI') meta.push(`**Author:** ${pdfAuthor}`);
            pdfContent = meta.join('\n') + '\n\n---\n\n' + pdfContent;
          }

          await preloadCometIconLocal();
          const iconSource = (window as any).__cometIconBase64 || null;

          setIsGeneratingPDF(true);
          setPdfProgress(0);
          setShowTerminal(true);
          setStreamingPDFContent(`Generating PDF: ${pdfTitle}...`);

          // Replicate slide logic for the success message UI
          const slides = pdfContent.split(/---\n?/).filter(s => s.trim().length > 10);
          const isSlideShow = slides.length > 2;

          setStreamingPDFContent(`Generating PDF: ${pdfTitle}...`);
          const cleanHTML = generateSmartPDF(pdfContent, iconSource, pdfImages.length > 0 ? pdfImages : undefined);
          const res = await window.electronAPI.generatePDF(pdfTitle, cleanHTML) as any;

          setIsGeneratingPDF(false);
          setPdfProgress(100);
          setStreamingPDFContent('');
          updateVisualStage('idle');

          if (res.success) {
            output = `✅ **PDF GENERATION SUCCESSFUL**\n\n### 📄 Document Overview\n- **Title:** ${pdfTitle}\n- **Pages:** ${isSlideShow ? slides.length : '1'}\n- **Format:** ${isSlideShow ? 'Slide Deck (Presenton Style)' : 'Standard Report'}\n- **📁 File Path:** \`${res.filePath}\`\n- **Status:** ✅ Downloaded Successfully\n\nYou can find the PDF at: **${res.filePath}**\n\nWould you like me to open the document for you?`;

            // Add a special message with an "Open PDF" button
            setMessages(prev => [...prev, {
              role: 'model',
              content: `📄 **PDF Generated: ${res.fileName}**\n\n📁 Location: ${res.filePath}`,
              actionLogs: [{ type: 'PDF_READY', output: res.filePath, success: true }]
            } as ExtendedChatMessage]);
          } else {
            updateVisualStage('idle');
            output = `❌ PDF GENERATION FAILED\n- Error: ${res.error}\n- Context: Please verify title and content format.`;
          }
          break;
        }

        // ── SHOW_IMAGE: display an image from URL in the chat ─────────────────
        // Format: [SHOW_IMAGE: imageUrl | optional caption]
        case 'SHOW_IMAGE': {
          const parts = command.value.split('|').map((s: string) => s.trim());
          const imageUrl = parts[0];
          const caption = parts[1] || '';

          if (!imageUrl) { output = 'No image URL provided.'; break; }

          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const existing = last.mediaItems || [];
            updated[updated.length - 1] = {
              ...last,
              mediaItems: [...existing, { type: 'image', url: imageUrl, caption }]
            };
            return updated;
          });
          output = `Image displayed: ${imageUrl}`;
          break;
        }

        // ── SHOW_VIDEO: display a YouTube/video card in chat ──────────────────
        // Format: [SHOW_VIDEO: videoUrl | title | description]
        case 'SHOW_VIDEO': {
          const parts = command.value.split('|').map((s: string) => s.trim());
          const videoUrl = parts[0];
          const videoTitle = parts[1] || 'Video';
          const videoDesc = parts[2] || '';

          if (!videoUrl) { output = 'No video URL provided.'; break; }

          // Extract YouTube video ID to build thumbnail URL (no API key needed)
          let videoId: string | undefined;
          let thumbnailUrl: string | undefined;
          let source: 'youtube' | 'other' = 'other';

          const ytMatch = videoUrl.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
          );
          if (ytMatch) {
            videoId = ytMatch[1];
            source = 'youtube';
            // Use maxresdefault thumbnail, fallback to hqdefault
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
          }

          setMessages(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const existing = last.mediaItems || [];
            updated[updated.length - 1] = {
              ...last,
              mediaItems: [...existing, {
                type: 'video',
                videoUrl,
                title: videoTitle,
                description: videoDesc,
                thumbnailUrl,
                source,
                videoId
              }]
            };
            return updated;
          });
          output = `Video card added: ${videoTitle}`;
          break;
        }

        case 'EXPLAIN_CAPABILITIES': {
          setShowCapabilities(true);

          // Get platform-specific commands
          const platform = (typeof process !== 'undefined' && process.platform) || 'darwin';
          const isMac = platform === 'darwin';
          const isWindows = platform === 'win32';
          const isLinux = platform === 'linux';

          // Step 1: Announce demonstration start
          setMessages(prev => [...prev, { role: 'model', content: "🚀 **Initiating Full Capability Demonstration...**\n\nI'll showcase real tasks across all my capabilities." }]);
          await new Promise(resolve => setTimeout(resolve, 800));

          // Step 2: Web Search - Latest News
          const searchStepId = addThinkingStep('Searching latest news...');
          setMessages(prev => [...prev, { role: 'model', content: "📰 **Task 1: Real-Time Web Search**\nSearching for latest technology news..." }]);
          await new Promise(resolve => setTimeout(resolve, 500));

          let newsResults = '';
          try {
            const searchResults = await window.electronAPI.webSearchRag('latest technology news today 2026');
            if (searchResults && searchResults.length > 0) {
              newsResults = searchResults.slice(0, 3).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n');
              setMessages(prev => [...prev, { role: 'model', content: `✅ **News Search Complete:**\n${newsResults}` }]);
            }
          } catch (e) {
            console.warn('[Demo] News search failed:', e);
          }
          resolveThinkingStep(searchStepId, newsResults ? 'done' : 'error', newsResults ? '3 results found' : 'Search failed');

          // Step 3: System Info via Shell Command
          setMessages(prev => [...prev, { role: 'model', content: "🖥️ **Task 2: Shell Command Execution**\nGetting WiFi/network information..." }]);
          await new Promise(resolve => setTimeout(resolve, 500));

          let wifiInfo = '';
          try {
            let wifiCmd = isMac ? '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I | grep SSID' :
              isWindows ? 'netsh wlan show interfaces | findstr SSID' :
                'iwgetid -r';
            const shellResult = await window.electronAPI.executeShellCommand(wifiCmd);
            wifiInfo = shellResult.success ? (shellResult.output || 'WiFi connected').trim() : 'Network info retrieved';
          } catch (e) {
            wifiInfo = 'System info available';
          }
          setMessages(prev => [...prev, { role: 'model', content: `✅ **Shell Command Result:**\n\`\`\`\n${wifiInfo}\n\`\`\`` }]);

          // Step 4: Volume Adjustment
          setMessages(prev => [...prev, { role: 'model', content: "🔊 **Task 3: System Volume Control**\nAdjusting volume to 50%..." }]);
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            await window.electronAPI.setVolume(50);
            setMessages(prev => [...prev, { role: 'model', content: "✅ **Volume adjusted to 50%**" }]);
          } catch (e) {
            setMessages(prev => [...prev, { role: 'model', content: "⚠️ Volume control not available on this system" }]);
          }

          // Step 5: Open Calculator App
          setMessages(prev => [...prev, { role: 'model', content: "🧮 **Task 4: Application Launch**\nOpening calculator..." }]);
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            let calcApp = isMac ? 'Calculator' : isWindows ? 'calc' : 'gnome-calculator';
            await window.electronAPI.openExternalApp(calcApp);
            setMessages(prev => [...prev, { role: 'model', content: `✅ **Calculator launched successfully** (${isMac ? 'macOS' : isWindows ? 'Windows' : 'Linux'})` }]);
          } catch (e) {
            setMessages(prev => [...prev, { role: 'model', content: "⚠️ Could not launch calculator" }]);
          }

          // Step 6: Screenshot Capture
          setMessages(prev => [...prev, { role: 'model', content: "📸 **Task 5: Screenshot Capture**\nCapturing and analyzing screen..." }]);
          await new Promise(resolve => setTimeout(resolve, 1000));

          let screenshotBase64: string | undefined;
          try {
            if (window.electronAPI.visionCaptureBase64) {
              const captureRes = await window.electronAPI.visionCaptureBase64();
              if (captureRes.success && captureRes.image) {
                screenshotBase64 = captureRes.image;
                setMessages(prev => [...prev, { role: 'model', content: "✅ **Screenshot captured** - Ready to embed in PDF report" }]);
              }
            }
          } catch (e) {
            console.warn('[Demo] Screenshot failed:', e);
          }

          // Step 7: Generate Comprehensive Capability Report PDF
          setMessages(prev => [...prev, { role: 'model', content: "📄 **Task 6: PDF Generation**\nCreating comprehensive capability report with screenshots..." }]);
          await new Promise(resolve => setTimeout(resolve, 500));

          await preloadCometIconLocal();
          const iconSource = (window as any).__cometIconBase64 || null;

          const capabilityFeatures = [
            'Browser Automation: Navigate, search, and interact with web pages autonomously',
            'Real-Time Web Search: Live search with RAG-powered context retrieval',
            'PDF Generation: Create branded documents with embedded screenshots and images',
            'OCR & Vision: Extract text from images and analyze screen content',
            'Shell Command Execution: Run terminal commands with user approval',
            'System Control: Adjust volume, brightness, and other system settings',
            'Application Launching: Open any app (Calculator, Terminal, browsers, etc.)',
            'Multi-Platform: Works on Windows, macOS, and Linux',
            'Secure DOM Reading: Filtered, injection-checked page content extraction',
            'Prompt Injection Protection: Triple-lock security architecture',
            'RAG Memory: Contextual learning from browsing sessions',
            'Multi-Step Agency: Chained command execution with approval gates',
            'Cross-Device Authorization: QR-based high-risk action approval',
          ];

          const pdfTitle = `Comet_AI_Capability_Report_${new Date().toISOString().split('T')[0]}`;

          // Use the enhanced PDF builder with screenshot support
          const { buildCapabilityReportPDF } = await import('./ai/AIUtils');
          const capabilityPDF = buildCapabilityReportPDF({
            author: 'Preet Kumar Patel (16-year-old student, India)',
            version: versionLabel,
            features: capabilityFeatures,
            platform: 'Windows, macOS, Linux, Android'
          }, screenshotBase64, iconSource);

          await window.electronAPI.generatePDF(pdfTitle, capabilityPDF);
          setMessages(prev => [...prev, { role: 'model', content: "✅ **Capability Report PDF generated and saved!**" }]);

          // Final Summary
          setMessages(prev => [...prev, {
            role: 'model', content: `
## ✅ **Full Demonstration Complete!**

I've successfully executed the following real tasks:

| Task | Status | Details |
|------|--------|---------|
| 📰 Web Search | ✅ | Fetched latest tech news |
| 🖥️ Shell Command | ✅ | Retrieved WiFi/network info |
| 🔊 Volume Control | ✅ | Set to 50% |
| 🧮 App Launch | ✅ | Opened Calculator |
| 📸 Screenshot | ✅ | Captured screen content |
| 📄 PDF Report | ✅ | Created with all capabilities |

---

**📥 Your Capability Report PDF has been saved to Downloads folder.**

**Built by:** Preet Kumar Patel - A 16-year-old student from India 🇮🇳

*Comet AI ${versionLabel} - The AI-Native Browser*
          ` }]);

          output = 'Full capability demonstration executed successfully with real tasks: search, shell command, volume, app launch, screenshot, and PDF generation.';
          break;
        }

        case 'RELOAD':

          await window.electronAPI.reload();
          output = 'Active page reloaded.';
          break;

        case 'GO_BACK':
          await window.electronAPI.goBack();
          output = 'Navigated back in history.';
          break;

        case 'GO_FORWARD':
          await window.electronAPI.goForward();
          output = 'Navigated forward in history.';
          break;

        case 'OCR_COORDINATES':
        case 'OCR_SCREEN':
        case 'SCREENSHOT_AND_ANALYZE': {
          // Check if user has already granted OCR permission permanently
          const permKey = `OCR_SCREEN:${command.value || 'default'}`;
          if (window.electronAPI?.permCheck) {
            const permRes = await window.electronAPI.permCheck(permKey);
            if (permRes?.granted) {
              console.log('[Permission] OCR pre-authorized via stored permission');
            }
          }

          const stepId = addThinkingStep('Capturing screenshot...', 'Taking screenshot and running OCR');
          try {
            let ocrText = '';

            // First try: Capture browser view screenshot (most reliable for browser content)
            if (window.electronAPI.captureBrowserViewScreenshot) {
              const screenshotData = await window.electronAPI.captureBrowserViewScreenshot();
              if (screenshotData) {
                // Run Tesseract OCR on the captured image
                try {
                  const { data } = await Tesseract.recognize(screenshotData, 'eng', {
                    logger: (m: any) => {
                      if (m.status === 'recognizing text') {
                        setPdfProgress(Math.round(m.progress * 100));
                      }
                    }
                  });
                  ocrText = data?.text || '';
                } catch (tessErr: any) {
                  console.error('Tesseract OCR failed:', tessErr);
                }
              }
            }

            // Fallback: Try vision describe if OCR didn't work
            if (!ocrText && window.electronAPI.visionDescribe) {
              try {
                const visionRes = await window.electronAPI.visionDescribe('What is on this screen? Extract all visible text, buttons, links, and content.');
                ocrText = typeof visionRes === 'string' ? visionRes : ((visionRes as any)?.description || '');
              } catch (visionErr: any) {
                console.error('Vision describe failed:', visionErr);
              }
            }

            // Final fallback: Try basic OCR
            if (!ocrText && window.electronAPI.ocrScreenText) {
              try {
                const ocrRes = await window.electronAPI.ocrScreenText();
                ocrText = typeof ocrRes === 'string' ? ocrRes : ((ocrRes as any)?.text || '');
              } catch (ocrErr: any) {
                console.error('OCR screen text failed:', ocrErr);
              }
            }

            resolveThinkingStep(stepId, 'done', ocrText ? 'Screenshot captured and analyzed' : 'Screenshot captured');

            if (ocrText) {
              output = `📸 **Screenshot Analyzed** (${ocrText.length} chars)\n\n${ocrText.substring(0, 4000)}${ocrText.length > 4000 ? '\n\n_(truncated)..._' : ''}`;
              await BrowserAI.addToVectorMemory(ocrText, { type: 'screenshot_ocr', url: currentUrl });
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  updated[prev.length - 1] = { ...last, isOcr: true, ocrLabel: 'SCREENSHOT_ANALYSIS', ocrText: ocrText };
                  return updated;
                }
                return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: 'SCREENSHOT_ANALYSIS', ocrText: ocrText } as ExtendedChatMessage];
              });
            } else {
              output = '⚠️ Screenshot captured but no text detected. The page may be empty or contain only images.';
            }
          } catch (e: any) {
            resolveThinkingStep(stepId, 'error', e.message);
            output = `❌ Screenshot failed: ${e.message}`;
          }
          break;
        }

        case 'EXTRACT_DATA': {
          const selector = command.value.split('|')[0].trim();
          try {
            const res = await window.electronAPI.extractPageContent();
            if (res && res.content) {
              const scrubbed = scrubbedContent(res.content);
              output = `Extracted data from page (${scrubbed.length} chars):\n${scrubbed.substring(0, 4000)}...`;
              await BrowserAI.addToVectorMemory(scrubbed, { type: 'extracted_data', selector, url: currentUrl });
            } else {
              output = `No data found for selector: ${selector}.`;
            }
          } catch (e: any) {
            output = `Extract failed: ${e.message}`;
          }
          break;
        }

        case 'DOM_SEARCH': {
          const query = command.value.trim() || '';
          if (!query) {
            output = 'DOM_SEARCH requires a query parameter.';
            break;
          }

          const searchStepId = addThinkingStep(`Searching DOM for "${query}"...`);
          setDOMSearchLoading(true);
          setDOMSearchQuery(query);
          setDOMSearchResults([]);

          try {
            const res = await window.electronAPI.searchDOM(query);
            if (res.error) {
              output = `DOM search failed: ${res.error}`;
              setDOMSearchLoading(false);
            } else {
              const results: DOMSearchResult[] = (res.results || []).map((r: any) => ({
                text: r.text || '',
                context: r.context || '',
                xpath: r.xpath || '',
                score: r.score || 0,
                tag: r.tag || 'element'
              }));

              setDOMSearchResults(results);
              const formattedResults = results.map((r, i) => `${i + 1}. ${r.context}: "${r.text}"`).join('\n');
              output = `DOM search for "${query}" returned ${results.length} results:\n${formattedResults.substring(0, 4000)}`;
              await BrowserAI.addToVectorMemory(
                `DOM Search Results for "${query}":\n${formattedResults}`,
                { type: 'dom_search', query, url: currentUrl }
              );
            }
            resolveThinkingStep(searchStepId, 'done', `${res.results?.length || 0} results found`);
          } catch (e: any) {
            output = `DOM search error: ${e.message}`;
            resolveThinkingStep(searchStepId, 'error', e.message);
          } finally {
            setDOMSearchLoading(false);
          }
          break;
        }

        case 'OPEN_MCP_SETTINGS': {
          store.openMcpSettings();
          output = 'Opening MCP Settings panel...';
          break;
        }

        case 'OPEN_AUTOMATION_SETTINGS': {
          console.log('[AI] OPEN_AUTOMATION_SETTINGS handler called');
          if (props.setShowSettings && props.setSettingsSection) {
            console.log('[AI] Using props.setShowSettings');
            props.setShowSettings(true);
            props.setSettingsSection('automation');
            output = 'Opening Automation Settings...';
          } else if (window.electronAPI?.openSettingsPopup) {
            console.log('[AI] Using IPC openSettingsPopup');
            window.electronAPI.openSettingsPopup('automation');
            output = 'Opening Automation Settings...';
          } else {
            console.log('[AI] No method available - props exists:', !!props.setShowSettings, 'IPC exists:', !!window.electronAPI?.openSettingsPopup);
            output = 'Automation settings not available in current context.';
          }
          break;
        }

        case 'OPEN_SCHEDULING_MODAL': {
          // Parse scheduling data from command value (JSON format)
          let scheduleData: any = {};
          const rawValue = command.value.trim();

          try {
            if (rawValue) {
              if (rawValue.includes('{')) {
                const jsonMatch = rawValue.match(/\{[\s\S]*\}/);
                if (jsonMatch) scheduleData = JSON.parse(jsonMatch[0]);
              } else {
                // Pipe-separated: schedule|type|name|description
                const parts = rawValue.split('|').map(p => p.trim());
                scheduleData = {
                  schedule: parts[0] || '0 8 * * *',
                  type: parts[1] || 'ai-prompt',
                  name: parts[2] || 'Scheduled Task',
                  description: parts[3] || '',
                };
              }
            }
          } catch (e) {
            console.error('Failed to parse scheduling data:', e);
          }

          // Create scheduling intent
          const intent: SchedulingIntent = {
            detected: true,
            confidence: 'high' as const,
            taskName: scheduleData.name || 'Scheduled Task',
            taskType: scheduleData.type as any || 'ai-prompt',
            schedule: {
              type: 'cron' as const,
              expression: scheduleData.schedule || '0 8 * * *',
              description: `Scheduled: ${scheduleData.schedule || '0 8 * * *'}`,
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            outputPath: scheduleData.outputPath || '~/Documents/Comet-AI',
          };

          // Use props to set up and show modal
          if (props.setSchedulingIntent) {
            props.setSchedulingIntent(intent);
          }
          if (props.setShowSchedulingModal) {
            props.setShowSchedulingModal(true);
          }
          if (props.setBrowserDisabled) {
            props.setBrowserDisabled(true);
          }

          output = `Opening scheduling modal for: ${intent.taskName}`;
          break;
        }

        case 'DOM_READ_FILTERED': {
          const query = command.value.trim();
          const readStepId = addThinkingStep('Reading secure DOM...');

          try {
            const res = await window.electronAPI.extractSecureDOM();
            if (res.error) {
              output = `DOM read failed: ${res.error}`;
              resolveThinkingStep(readStepId, 'error', res.error);
            } else {
              const domResult: FilteredDOMResult = {
                content: res.content || '',
                elements: res.elements || [],
                metadata: res.metadata || {
                  url: currentUrl || '',
                  title: '',
                  timestamp: Date.now(),
                  injectionDetected: false,
                  filterStats: { piiRemoved: 0, scriptsRemoved: 0, stylesRemoved: 0, navRemoved: 0, adsRemoved: 0 }
                }
              };

              setDOMMeta(domResult.metadata);

              const contextForAI = secureDOMReader.buildContextForAI(domResult, query);

              if (query) {
                const searchResults = secureDOMReader.searchDOM(domResult.elements, { query, maxResults: 10 });
                setDOMSearchResults(searchResults);
                setDOMSearchQuery(query);
                output = `Secure DOM read complete. Found ${searchResults.length} matches for "${query}".\n\nContext:\n${contextForAI.substring(0, 4000)}...`;
              } else {
                output = `Secure DOM read complete (${(res.content || '').length} chars filtered).\n\nContent:\n${contextForAI.substring(0, 4000)}...`;
              }

              await BrowserAI.addToVectorMemory(contextForAI, { type: 'secure_dom_read', url: currentUrl });

              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  updated[prev.length - 1] = { ...last, isOcr: true, ocrLabel: 'DOM_EXTRACTED', ocrText: contextForAI };
                  return updated;
                }
                return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: 'DOM_EXTRACTED', ocrText: contextForAI } as ExtendedChatMessage];
              });

              resolveThinkingStep(readStepId, 'done', `${(res.content || '').length} chars processed`);
            }
          } catch (e: any) {
            output = `DOM read error: ${e.message}`;
            resolveThinkingStep(readStepId, 'error', e.message);
          }
          break;
        }

        // ── PLUGIN_COMMAND: Execute plugin-defined commands ─────────────────────
        case 'PLUGIN_COMMAND': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          try {
            const pluginCommandId = command.value;
            const params = command.context ? JSON.parse(command.context) : {};

            if (window.electronAPI?.plugins?.executeCommand) {
              const result = await window.electronAPI.plugins.executeCommand(pluginCommandId, params);
              output = result.success ? (result.result || 'Command executed successfully') : `Error: ${result.error}`;
            } else {
              output = 'Plugin command execution is not available.';
            }
          } catch (e: any) {
            output = `Plugin command error: ${e.message}`;
          }
          break;
        }

        default:
          output = `Operation ${command.type} completed.`;
      }

      if (commandResult.error) {
        output = commandResult.error;
        setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'failed', error: output } : cmd));
      } else {
        setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'completed', output } : cmd));
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          const updated = [...prev];
          const actionLogs = last.actionLogs || [];
          updated[prev.length - 1] = { ...last, actionLogs: [...actionLogs, { type: command.type, output, success: !commandResult.error }] };
          return updated;
        }
        return prev;
      });
    } catch (err: any) {
      const errorOutput = err.message;
      setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'failed', error: err.message } : cmd));
    } finally {
      processingQueueRef.current = false;
      setCurrentCommandIndex(prev => prev + 1);
    }
  }, [commandQueue, currentCommandIndex, activeTabId, router, storeSetTheme, setActiveView, currentUrl, requestActionPermission, preloadCometIconLocal, addThinkingStep, resolveThinkingStep, fetchRealSearchContext, openTabAndWaitForLoad, waitForActiveTabToSettle]);

  const formatMessageForExport = (m: ExtendedChatMessage) => {
    let result = `${m.role.toUpperCase()}:\n`;

    // AI Reasoning / Thinking
    if (m.thinkText) {
      result += `\n[AI REASONING]\n${m.thinkText.trim()}\n[/AI REASONING]\n`;
    }

    // OCR Sources (Collapsible in UI, shown as structured data in export)
    if (m.isOcr && m.ocrText) {
      result += `\n[OCR_RESULT]\n${JSON.stringify({
        type: 'OCR_EXTRACTION',
        label: m.ocrLabel || 'EXTRACTED_DATA',
        textLength: m.ocrText.length,
        content: m.ocrText.trim()
      }, null, 2)}\n[/OCR_RESULT]\n`;
    }

    // Action Chain (Separate JSON format)
    if (m.actionLogs && m.actionLogs.length > 0) {
      result += `\n[ACTION_CHAIN_JSON]\n${JSON.stringify({
        type: 'ACTION_CHAIN_EXPORT',
        version: '1.0',
        exportTimestamp: Date.now(),
        actions: m.actionLogs.map((log, index) => ({
          index: index + 1,
          type: log.type,
          success: log.success,
          output: log.output
        }))
      }, null, 2)}\n[/ACTION_CHAIN_JSON]\n`;
    }

    // Media Attachments
    if (m.mediaItems && m.mediaItems.length > 0) {
      result += `\n[MEDIA_ATTACHMENTS_JSON]\n${JSON.stringify({
        type: 'MEDIA_EXPORT',
        version: '1.0',
        attachments: m.mediaItems.map(item => ({
          type: item.type,
          ...(item.type === 'image' ? { url: item.url, caption: item.caption } : {}),
          ...(item.type === 'video' ? { videoUrl: item.videoUrl, title: item.title, description: item.description } : {})
        }))
      }, null, 2)}\n[/MEDIA_ATTACHMENTS_JSON]\n`;
    }

    // Main Content
    result += `\n${m.content.trim()}`;
    return result.trim();
  };

  const clearChat = useCallback(() => {
    setMessages([]);
    setThinkingSteps([]);
    setThinkingText('');
    setShowActionsMenu(false);
    setAttachments([]);
    setInputMessage('');
    setActiveConversationId(null);
    setShowConversationHistory(false);
  }, []);

  const saveConversation = useCallback(() => {
    if (messages.length === 0) return;
    const now = Date.now();
    const storedMessages = messages.map((msg) => ({ ...msg }));
    const generatedId = typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `conv-${now}`;
    const conversationId = activeConversationId ?? generatedId;
    const conversationRecord: Conversation = {
      id: conversationId,
      title: buildConversationTitle(storedMessages),
      messages: storedMessages,
      createdAt: now,
      updatedAt: now,
    };

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === conversationId);
      const merged = {
        ...conversationRecord,
        createdAt: existing?.createdAt ?? conversationRecord.createdAt,
      };
      const next = [merged, ...prev.filter((c) => c.id !== conversationId)];
      const truncated = next.slice(0, 20);
      lsSet('conversations_list', truncated);
      return truncated;
    });

    if (conversationId !== activeConversationId) {
      setActiveConversationId(conversationId);
    }
  }, [activeConversationId, messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (persistTimeoutRef.current) {
      window.clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      saveConversation();
      persistTimeoutRef.current = null;
    }, 600);

    return () => {
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [messages, saveConversation]);

  const handleLoadConversation = useCallback((id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setMessages(conv.messages as ExtendedChatMessage[]);
    setActiveConversationId(conv.id);
    setShowConversationHistory(false);
  }, [conversations]);

  const handleDeleteConversation = useCallback((id: string) => {
    const nextList = conversations.filter((conv) => conv.id !== id);
    lsSet('conversations_list', nextList);
    setConversations(nextList);
    if (activeConversationId === id) {
      if (nextList.length > 0) {
        setMessages(nextList[0].messages as ExtendedChatMessage[]);
        setActiveConversationId(nextList[0].id);
      } else {
        clearChat();
      }
    }
  }, [activeConversationId, conversations, clearChat]);

  const handleNewConversation = useCallback(() => {
    clearChat();
    setShowConversationHistory(false);
  }, [clearChat]);

  const exportChat = useCallback(async (format: 'text' | 'pdf') => {
    if (messages.length === 0) return;
    setShowActionsMenu(false);

    // Format full session
    const fullContent = messages.map(m => formatMessageForExport(m)).join('\n\n' + '='.repeat(40) + '\n\n');

    // Include action logs in export (separate from main chat)
    const actionLogsExport = actionLogsStore.exportAsJSON();
    const shellLogsExport = actionLogsStore.getShellLogs().length > 0
      ? actionLogsStore.exportAsText().split('[SHELL_COMMANDS_LOG]')[1] || ''
      : '';

    if (window.electronAPI) {
      if (format === 'text') {
        const exportContent = `${fullContent}\n\n${'='.repeat(60)}\nACTION LOGS (${versionLabel} JSON Format)\n${'='.repeat(60)}\n\n${actionLogsExport}`;
        const res = await (window.electronAPI as any).exportChatAsTxt(exportContent);
        if (res?.success) setFeedback('Chat & Action Logs Exported to Downloads');
      } else {
        // Robustly convert tags to HTML using multi-stage parsing
        const convertTagsToHTML = (text: string): string => {
          let html = text;

          // AI Reasoning tags
          const reasoningBlocks = extractAIReasoning(text);
          for (const block of reasoningBlocks) {
            const escaped = block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.replace(
              new RegExp(`\\[?\\s*AI REASONING\\s*\\]?\\s*${block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\[?\\s*/AI REASONING\\s*\\]?`, 'gi'),
              `<div style="background:#f8fafc; padding:15px; border-left:4px solid #0ea5e9; margin:10px 0; font-style:italic; font-size:12px; color:#475569;"><strong>AI Reasoning</strong><br/>${escaped}</div>`
            );
          }

          // OCR Result tags
          const ocrResult = extractOCRResult(text);
          if (ocrResult.success && ocrResult.data) {
            const jsonStr = JSON.stringify(ocrResult.data, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.replace(/\[\s*OCR_RESULT\s*\][\s\S]*?\[\s*\/OCR_RESULT\s*\]/gi,
              `<div style="background:#fef3c7; padding:15px; border-left:4px solid #f59e0b; margin:10px 0; font-size:12px; color:#92400e;"><strong>OCR Result</strong><br/><pre style="font-size:10px; overflow-x:auto;">${jsonStr}</pre></div>`);
          }

          // Action Chain JSON tags
          const actionChain = extractActionChain(text);
          if (actionChain.success && actionChain.data) {
            const jsonStr = JSON.stringify(actionChain.data, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.replace(/\[\s*ACTION_CHAIN_JSON\s*\][\s\S]*?\[\s*\/ACTION_CHAIN_JSON\s*\]/gi,
              `<div style="background:#0f172a; color:#e2e8f0; padding:15px; border-radius:10px; margin:10px 0; font-family:monospace; font-size:11px;"><strong>Action Chain (JSON)</strong><br/><pre style="font-size:10px; overflow-x:auto;">${jsonStr}</pre></div>`);
          }

          // Media Attachments JSON tags
          const mediaResult = extractMediaAttachments(text);
          if (mediaResult.success && mediaResult.data) {
            const jsonStr = JSON.stringify(mediaResult.data, null, 2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            html = html.replace(/\[\s*MEDIA_ATTACHMENTS_JSON\s*\][\s\S]*?\[\s*\/MEDIA_ATTACHMENTS_JSON\s*\]/gi,
              `<div style="background:#dbeafe; padding:15px; border-left:4px solid #3b82f6; margin:10px 0; font-size:12px; color:#1e40af;"><strong>Media Attachments (JSON)</strong><br/><pre style="font-size:10px; overflow-x:auto;">${jsonStr}</pre></div>`);
          }

          return html.replace(/\n/g, '<br/>');
        };

        const bodyContent = `
          <div style="white-space: pre-wrap; font-size: 14px; color: #1e293b;">
            ${convertTagsToHTML(fullContent)}
          </div>
          <div style="margin-top:40px; padding:20px; background:#f8fafc; border-top:2px solid #e2e8f0;">
            <h2 style="font-size:16px; color:#0f172a; margin-bottom:10px;">Action Logs (Separate)</h2>
            <pre style="font-size:11px; color:#475569; white-space:pre-wrap; word-break:break-all;">${actionLogsExport}</pre>
          </div>
        `;

        await preloadCometIconLocal();
        const iconSource = (window as any).__cometIconBase64 || null;
        const bandedHtml = generateSmartPDF(bodyContent, iconSource);

        await window.electronAPI.generatePDF('Comet Intelligence Report', bandedHtml);
        setFeedback('PDF Document Ready with Action Logs');
      }
    }
    setTimeout(() => setFeedback(null), 3000);
  }, [messages]);

  const copyChatToClipboard = useCallback(() => {
    const chatData = messages.map(m => formatMessageForExport(m)).join('\n\n' + '='.repeat(50) + '\n\n');
    navigator.clipboard.writeText(chatData);
    setShowActionsMenu(false);
  }, [messages]);

  useEffect(() => {
    if (commandQueue.length > 0 && currentCommandIndex < commandQueue.length && !processingQueueRef.current) {
      processNextCommand();
    }
  }, [commandQueue, currentCommandIndex, processNextCommand]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const mermaid = (window as any).mermaid;
    if (mermaid) mermaid.initialize({ theme: 'dark' });
    setIsMermaidLoaded(true);

    const hOnline = () => setIsOnline(true);
    const hOffline = () => setIsOnline(false);
    window.addEventListener('online', hOnline);
    window.addEventListener('offline', hOffline);

    const savedConversations = lsGet<Conversation[]>('conversations_list', []);
    setConversations(savedConversations);
    // Start with new chat on app restart - uncomment below to restore previous conversation
    // if (savedConversations.length > 0) {
    //   const latest = savedConversations[0];
    //   setActiveConversationId(latest.id);
    //   setMessages(latest.messages as ExtendedChatMessage[]);
    // }

    return () => {
      window.removeEventListener('online', hOnline);
      window.removeEventListener('offline', hOffline);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Tab' && permissionPending && permissionPending.context?.risk !== 'high') {
        setShiftTabGlow(true);
        setTimeout(() => setShiftTabGlow(false), 900);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [permissionPending]);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      const unsub = window.electronAPI.on('pdf-generation-log', (log: string) => {
        setTerminalLogs(prev => [...prev, {
          id: `pdf-${Date.now()}-${terminalLogIdCounter.current++}`,
          command: 'GENERATE_PDF',
          output: log,
          success: !log.includes('❌'),
          timestamp: Date.now()
        }]);
      });

      const unsubProgress = window.electronAPI.on('pdf-generation-progress', (progress: number) => {
        setPdfProgress(progress);
      });

      const unsubXlsx = window.electronAPI.on('xlsx-generation-log', (log: string) => {
        setTerminalLogs(prev => [...prev, {
          id: `xlsx-${Date.now()}-${terminalLogIdCounter.current++}`,
          command: 'GENERATE_XLSX',
          output: log,
          success: !log.includes('❌'),
          timestamp: Date.now()
        }]);
      });

      const unsubXlsxProgress = window.electronAPI.on('xlsx-generation-progress', (progress: number) => {
        setPdfProgress(progress);
      });

      const unsubPptx = window.electronAPI.on('pptx-generation-log', (log: string) => {
        setTerminalLogs(prev => [...prev, {
          id: `pptx-${Date.now()}-${terminalLogIdCounter.current++}`,
          command: 'GENERATE_PPTX',
          output: log,
          success: !log.includes('❌'),
          timestamp: Date.now()
        }]);
      });

      const unsubPptxProgress = window.electronAPI.on('pptx-generation-progress', (progress: number) => {
        setPdfProgress(progress);
      });

      const unsubDocx = window.electronAPI.on('docx-generation-log', (log: string) => {
        setTerminalLogs(prev => [...prev, {
          id: `docx-${Date.now()}-${terminalLogIdCounter.current++}`,
          command: 'GENERATE_DOCX',
          output: log,
          success: !log.includes('❌'),
          timestamp: Date.now()
        }]);
      });

      const unsubDocxProgress = window.electronAPI.on('docx-generation-progress', (progress: number) => {
        setPdfProgress(progress);
      });

      return () => {
        unsub();
        unsubProgress();
        unsubXlsx();
        unsubXlsxProgress();
        unsubPptx();
        unsubPptxProgress();
        unsubDocx();
        unsubDocxProgress();
      };
    }
  }, []);

  useEffect(() => {
    if (aiProvider === 'ollama') {
      setIsFetchingModels(true);
      fetch(`${ollamaBaseUrl}/api/tags`)
        .then(res => res.json())
        .then(data => {
          if (data && data.models) {
            setOllamaModelsList(data.models);
            if (data.models.length > 0 && (!ollamaModel || !data.models.find((m: any) => m.name === ollamaModel))) {
              setOllamaModel(data.models[0].name);
            }
          }
        })
        .catch(err => console.error("Failed to fetch Ollama models", err))
        .finally(() => setIsFetchingModels(false));
    }
  }, [aiProvider, ollamaBaseUrl]);

  const latestMessage = messages[messages.length - 1];
  const latestMessageContent = latestMessage?.content ?? '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, latestMessageContent, isLoading]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      markSidebarInteraction();
    }
  }, [messages.length, isLoading]);



  // Remote Prompt Listening (from mobile via cloud sync)
  useEffect(() => {
    let remoteCleanup: (() => void) | undefined;
    if (window.electronAPI?.onRemoteAiPrompt) {
      remoteCleanup = window.electronAPI.onRemoteAiPrompt((data: {
        prompt: string;
        promptId?: string;
        fromDeviceId?: string;
        streamToMobile?: boolean;
      }) => {
        console.log('[Remote-Prompt] Received from mobile:', data.prompt);
        handleSendMessage(data.prompt);
      });
    }
    return () => {
      if (remoteCleanup) remoteCleanup();
    };
  }, [handleSendMessage]);

  useEffect(() => {
    if (!window.electronAPI?.onNativeMacPrompt) return;
    const cleanup = window.electronAPI.onNativeMacPrompt((payload: { prompt: string }) => {
      if (payload?.prompt) {
        console.log('[NativeMacPrompt] Received prompt:', payload.prompt.substring(0, 50));
        handleSendMessage(payload.prompt).catch(err => console.error('[NativeMacPrompt] Error:', err));
      }
    });
    return cleanup;
  }, [handleSendMessage]);

  useEffect(() => {
    const listener = window.electronAPI?.onAIChatInputText ?? window.electronAPI?.onAiChatInputText;
    if (!listener) return;
    const cleanup = listener((text: string) => {
      if (typeof text === 'string') {
        setInputMessage(text);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.on) return;

    const cleanupConversationAction = window.electronAPI.on(
      'native-mac-ui-conversation-action',
      (payload: { action?: string; id?: string | null }) => {
        switch (payload?.action) {
          case 'new':
            handleNewConversation();
            break;
          case 'load':
            if (payload.id) {
              handleLoadConversation(payload.id);
            }
            break;
          case 'delete':
            if (payload.id) {
              handleDeleteConversation(payload.id);
            }
            break;
          default:
            break;
        }
      }
    );

    const cleanupExport = window.electronAPI.on(
      'native-mac-ui-export',
      (payload: { format?: 'text' | 'pdf' }) => {
        if (payload?.format === 'text' || payload?.format === 'pdf') {
          exportChat(payload.format);
        }
      }
    );

    return () => {
      cleanupConversationAction();
      cleanupExport();
    };
  }, [exportChat, handleDeleteConversation, handleLoadConversation, handleNewConversation]);

  useEffect(() => {
    if (!window.electronAPI?.updateNativeMacUIState) return;

    if (nativeMacSyncTimeoutRef.current) {
      window.clearTimeout(nativeMacSyncTimeoutRef.current);
    }

    nativeMacSyncTimeoutRef.current = window.setTimeout(() => {
      const snapshotMessages = messages.slice(-20).map((message, index) => ({
        id: message.id || `${message.role}-${index}`,
        role: message.role,
        content: `${message.content || ''}`.slice(0, 12000),
        timestamp: Date.now() + index,
        thinkText: message.thinkText ? message.thinkText.slice(0, 8000) : null,
        isOcr: !!message.isOcr,
        ocrLabel: message.ocrLabel ? `${message.ocrLabel}`.slice(0, 120) : null,
        ocrText: message.ocrText ? message.ocrText.slice(0, 12000) : null,
        actionLogs: Array.isArray(message.actionLogs)
          ? message.actionLogs.slice(0, 24).map((log) => ({
            type: `${log.type || ''}`.slice(0, 120),
            output: `${log.output || ''}`.slice(0, 4000),
            success: !!log.success,
          }))
          : [],
        mediaItems: Array.isArray(message.mediaItems)
          ? message.mediaItems.slice(0, 12).map((item) => {
            if (item.type === 'image') {
              return {
                type: item.type,
                url: item.url,
                caption: item.caption || null,
              };
            }

            if (item.type === 'video') {
              return {
                type: item.type,
                videoUrl: item.videoUrl,
                title: item.title,
                description: item.description || null,
                thumbnailUrl: item.thumbnailUrl || null,
                source: item.source,
                videoId: item.videoId || null,
              };
            }

            if (item.type === 'mermaid' || item.type === 'flowchart') {
              return {
                type: item.type,
                diagramId: item.diagramId,
                code: item.code,
              };
            }

            return {
              type: item.type,
              chartId: item.chartId,
              chartDataJSON: JSON.stringify(item.data || {}),
              chartOptionsJSON: JSON.stringify(item.options || {}),
            };
          })
          : [],
      }));

      const snapshotActionChain = commandQueue.slice(0, 24).map((command) => ({
        id: command.id,
        type: command.type,
        value: command.value,
        status: command.status,
        category: command.category,
        riskLevel: command.riskLevel,
      }));

      const snapshotConversations = conversations.slice(0, 20).map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
      }));

      const snapshotActivityTags = Array.from(new Set(
        searchContextStore.getRecentContexts(6).map((context) => {
          switch (context.type) {
            case 'web_search':
              return context.query ? `Searched for: ${context.query}` : 'Searched the web';
            case 'page_content':
              return `Read: ${context.title || context.url || 'Current page'}`;
            case 'ocr':
              return `OCR: ${context.query || 'Screen capture'}`;
            case 'dom':
              return context.query ? `Scanned DOM: ${context.query}` : `Scanned DOM: ${context.url || 'Current page'}`;
            default:
              return '';
          }
        }).filter(Boolean)
      )).slice(0, 8);

      const snapshotThinkingSteps = thinkingSteps.slice(-12).map((step) => ({
        id: step.id,
        label: step.label.slice(0, 200),
        status: step.status as 'running' | 'done' | 'error',
        detail: step.detail ? step.detail.slice(0, 500) : undefined,
        timestamp: step.timestamp,
      }));

      if (isLoading) {
        snapshotActivityTags.unshift('Comet is thinking');
      }

      window.electronAPI.updateNativeMacUIState({
        inputDraft: inputMessage,
        isLoading,
        error,
        currentCommandIndex,
        themeAppearance: resolvedTheme === 'light' ? 'light' : 'dark',
        messages: snapshotMessages,
        actionChain: snapshotActionChain,
        conversations: snapshotConversations,
        activeConversationId,
        activityTags: Array.from(new Set(snapshotActivityTags)).slice(0, 8),
        thinkingSteps: snapshotThinkingSteps,
      });
      nativeMacSyncTimeoutRef.current = null;
    }, 120);

    return () => {
      if (nativeMacSyncTimeoutRef.current) {
        window.clearTimeout(nativeMacSyncTimeoutRef.current);
        nativeMacSyncTimeoutRef.current = null;
      }
    };
  }, [messages, commandQueue, conversations, activeConversationId, currentCommandIndex, inputMessage, isLoading, error, resolvedTheme]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (props.isCollapsed) {
    return (
      <div className="flex flex-col items-center h-full py-6 space-y-6" style={sidebarShellStyle}>
        <button onClick={props.toggleCollapse} className="w-10 h-10 flex items-center justify-center rounded-2xl transition-all text-secondary-text hover:text-primary-text" style={softPanelStyle}>
          {props.side === 'right' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    );
  }

  const currentActiveModel = selectedProviderModel;

  if (props.bridgeOnly) {
    return null;
  }

  const effectiveSidebarWidth = sidebarWidth;

  return (
    <div
      className={`ai-sidebar-theme adaptive-theme-surface flex flex-col h-full overflow-hidden relative transition-[width,box-shadow,border-radius] duration-500 backdrop-blur-xl ${isFullScreen ? 'fixed inset-0 z-[9999]' : ''}`}
      style={{ width: isFullScreen ? '100%' : effectiveSidebarWidth, ...sidebarShellStyle }}
      onMouseEnter={markSidebarInteraction}
      onMouseDown={markSidebarInteraction}
      onClick={markSidebarInteraction}
      onFocusCapture={markSidebarInteraction}
    >
      {/* Overlays */}
      <ConversationHistoryPanel
        show={showConversationHistory}
        conversations={conversations}
        activeId={activeConversationId}
        onClose={() => setShowConversationHistory(false)}
        onLoad={handleLoadConversation}
        onDelete={handleDeleteConversation}
        onNew={handleNewConversation}
      />

      <CapabilitiesPanel
        isOpen={showCapabilities}
        onClose={() => setShowCapabilities(false)}
      />

      <AnimatePresence>
        {showSetupGuide && <AISetupGuide onClose={() => setShowSetupGuide(false)} onComplete={() => { setShowSetupGuide(false); setShowLLMProviderSettings(true); }} />}
      </AnimatePresence>

      <AnimatePresence>
        {commandQueue.length > 0 && currentCommandIndex < commandQueue.length && (
          <AICommandQueue
            commands={commandQueue}
            currentCommandIndex={currentCommandIndex}
            onCancel={() => setCommandQueue([])}
          />
        )}
      </AnimatePresence>

      {/* Live PDF Generation Overlay */}
      <AnimatePresence>
        {isGeneratingPDF && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-6 top-32 z-[1000] p-6 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent border border-white/20 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 via-purple-500 to-sky-500 animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <FileText size={32} className="text-sky-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Live PDF Streaming</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-tighter mt-2 font-bold leading-relaxed max-w-[200px]">
                  {streamingPDFContent}
                </p>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-sky-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pdfProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {pdfVisualStage !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.35 }}
                  className="mt-4 flex items-center gap-3 px-4 py-3 bg-black/60 border border-white/10 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
                >
                  <motion.div
                    className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center"
                    animate={pdfVisualStage === 'capturing' ? {
                      boxShadow: [
                        '0 0 0 0 rgba(14, 165, 233, 0.4)',
                        '0 0 0 8px rgba(14, 165, 233, 0)',
                        '0 0 0 0 rgba(14, 165, 233, 0)'
                      ]
                    } : {}}
                    transition={{ duration: 1.5, repeat: pdfVisualStage === 'capturing' ? Infinity : 0 }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-white/20"
                      animate={pdfVisualStage === 'capturing' ? { opacity: [0, 1, 0], scale: [1, 1.5] } : {}}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    />
                    {pdfVisualStage === 'capturing' ? (
                      <Camera size={20} className="text-white relative z-10" />
                    ) : (
                      <Image size={20} className="text-white relative z-10" />
                    )}
                  </motion.div>
                  <div className="text-left">
                    <motion.p
                      className="text-[11px] font-black uppercase tracking-[0.3em] text-white/70"
                      animate={pdfVisualStage === 'capturing' ? { opacity: [1, 0.7, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      {pdfVisualStage === 'capturing' ? '📸 Capturing screenshot' : '🌐 Fetching visuals'}
                    </motion.p>
                    <motion.p
                      className="text-[10px] text-white/40 leading-tight"
                      key={pdfVisualStage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {pdfVisualStage === 'capturing'
                        ? 'Recording the current browser view into your report...'
                        : 'Downloading referenced images before rendering the document...'}
                    </motion.p>
                  </div>
                  <motion.div
                    className="ml-auto flex gap-0.5"
                    animate={pdfVisualStage === 'capturing' ? { opacity: 1 } : { opacity: 0.5 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-3 bg-sky-400 rounded-full"
                        animate={pdfVisualStage === 'capturing' ? {
                          height: [12, 20, 12],
                          opacity: [0.5, 1, 0.5]
                        } : {}}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15
                        }}
                      />
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Panel */}
      <AnimatePresence>
        {showTerminal && terminalLogs.length > 0 && (
          <motion.div
            key="terminal"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            className="absolute bottom-4 left-4 z-[9000] rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] bg-[#09090f] w-80 max-w-[320px]"
            style={{ maxHeight: '220px' }}
          >
            <div className="flex items-center justify-between px-4 py-2 bg-[#111118] border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <button onClick={() => setShowTerminal(false)} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors" title="Close Terminal" />
                  <button onClick={() => setTerminalLogs([])} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-colors" title="Clear Terminal" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest ml-2">Comet Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTerminalLogs([])} className="text-[9px] text-white/20 hover:text-white/50 font-mono uppercase tracking-widest transition-colors">Clear</button>
                <button onClick={() => setShowTerminal(false)} className="text-white/20 hover:text-white/60 transition-colors"><X size={14} /></button>
              </div>
            </div>
            <div className="overflow-y-auto modern-scrollbar p-3 space-y-2 font-mono text-[11px]" style={{ maxHeight: '170px' }}>
              {terminalLogs.map(log => (
                <div key={log.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400/70">❯</span>
                    <span className="text-sky-300/80">{log.command}</span>
                  </div>
                  <pre className={`ml-4 whitespace-pre-wrap break-all leading-relaxed ${log.success ? 'text-white/60' : 'text-red-400/80'}`}>{log.output}</pre>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{approvalModal}</AnimatePresence>

      {/* Header */}
      <header className={`px-4 flex flex-col justify-center border-b backdrop-blur-2xl sticky top-0 z-[50] transition-[height,padding] duration-500 h-[56px]`} style={{ ...sidebarShellStyle, borderColor: 'color-mix(in srgb, var(--border-color) 35%, transparent)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl p-1 border" style={softPanelStyle}>
              <img src="icon.png" alt="Comet" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-text leading-tight">Comet AI</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1 h-1 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[8px] font-bold text-secondary-text uppercase tracking-widest">Autonomous</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTerminal(v => !v)}
              className={`p-2.5 rounded-xl transition-all relative ${showTerminal ? 'bg-green-500/20 text-green-400' : 'text-secondary-text hover:text-primary-text'}`}
              style={!showTerminal ? softPanelStyle : undefined}
              title="Toggle Terminal"
            >
              <Terminal size={18} />
              {terminalLogs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-[8px] font-bold text-black flex items-center justify-center">
                  {terminalLogs.length > 9 ? '9+' : terminalLogs.length}
                </span>
              )}
            </button>
            <button onClick={() => setShowCapabilities(!showCapabilities)} className={`p-2.5 rounded-xl transition-all ${showCapabilities ? 'bg-sky-500/20 text-sky-400' : 'text-secondary-text hover:text-primary-text'}`} style={!showCapabilities ? softPanelStyle : undefined} title="View AI Capabilities">
              <Sparkles size={18} />
            </button>
            <div className="relative group">
              <button className="p-2.5 rounded-xl text-secondary-text hover:text-primary-text transition-all" style={softPanelStyle}>
                <MoreVertical size={18} />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 border rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] p-2 backdrop-blur-2xl" style={popoverStyle}>
                <button onClick={() => exportChat('pdf')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-primary-text transition-all">
                  <Printer size={14} className="text-sky-400" /> Export branded PDF
                </button>
                <button onClick={() => exportChat('text')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-primary-text transition-all">
                  <FileText size={14} className="text-purple-400" /> Export as .txt
                </button>
                <button onClick={copyChatToClipboard} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-primary-text transition-all">
                  <CopyIcon size={14} className="text-amber-400" /> Copy full session
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => {
                    const cycle: Array<'dark' | 'light' | 'vibrant' | 'custom'> = ['dark', 'light', 'vibrant', 'custom'];
                    const cur = props.theme === 'system' ? 'dark' : (props.theme as 'dark' | 'light' | 'vibrant' | 'custom');
                    const idx = cycle.indexOf(cur);
                    props.setTheme(cycle[(idx + 1) % cycle.length]);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-primary-text transition-all"
                >
                  <span className="text-base leading-none">
                    {props.theme === 'light' ? '☀️' : props.theme === 'vibrant' ? '🔮' : props.theme === 'custom' ? '🎨' : '🌑'}
                  </span>
                  Theme: {props.theme === 'light' ? 'Light' : props.theme === 'vibrant' ? 'Vibrant' : props.theme === 'custom' ? 'Custom' : 'Dark'}
                </button>
                <button onClick={() => setShowLLMProviderSettings(!showLLMProviderSettings)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary-text hover:text-primary-text transition-all">
                  <Cpu size={14} className="text-green-400" /> Intelligence Settings
                </button>
                <button onClick={clearChat} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-all">
                  <Trash2 size={14} /> Clear reasoning chain
                </button>
              </div>
            </div>
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2.5 rounded-xl text-secondary-text hover:text-primary-text transition-all" style={softPanelStyle}>
              {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {store.tabs.some(t => t.groupId === 'ai-session') && (
              <button
                onClick={() => store.closeTabGroup('ai-session')}
                className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all border border-red-500/10"
                title="Close AI Session Tabs"
              >
                <Layers size={18} />
              </button>
            )}
            <button onClick={props.toggleCollapse} className="p-2.5 rounded-xl text-secondary-text hover:text-primary-text transition-all" style={softPanelStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className={`flex-1 overflow-y-auto modern-scrollbar transition-[padding] duration-500 backdrop-blur-sm p-5 space-y-8`} style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary-bg) 92%, transparent), color-mix(in srgb, var(--primary-bg) 98%, transparent))' }}>
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-[2rem] flex items-center justify-center border shadow-2xl" style={softPanelStyle}>
                <Brain size={32} className="text-secondary-text" />
              </div>
              <div>
                <h3 className="text-sm font-black text-secondary-text uppercase tracking-widest">How can I assist your workflow?</h3>
                <p className="text-[10px] text-secondary-text uppercase tracking-tighter mt-1 font-bold">I can navigate, browse, and execute tasks across Comet.</p>
              </div>
            </motion.div>
          )}
          {messages.map((msg, i) => {
            let displayContent = msg.content;
            let displayThought = msg.thinkText;

            const thinkMatch = displayContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
            if (thinkMatch) {
              displayThought = thinkMatch[1].trim();
              displayContent = displayContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
            }

            displayContent = displayContent.replace(INTERNAL_TAG_RE, '').trim();

            const isLastMessage = i === messages.length - 1;
            const msgIsOcr = (msg as any).isOcr || (msg as any).ocrText;
            const hasValidOcr = msgIsOcr && ((msg as any).ocrText || (msg as any).ocrLabel);
            const isStreamingEmpty = isLastMessage && isLoading && !displayContent && !hasValidOcr;
            if (isStreamingEmpty && msg.role === 'model') {
              return null;
            }

            return (
              <motion.div
                key={msg.id || `${msg.role}-${i}`}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.role === 'model' && (msg.thinkingSteps || displayThought) && (
                  <div className="w-full max-w-[90%] mb-2">
                    <ThinkingPanel steps={msg.thinkingSteps} thinkText={displayThought} initialOpen={false} />
                  </div>
                )}

                <div
                  className={`group relative max-w-[90%] p-5 rounded-[2.5rem] text-[13px] leading-relaxed transition-all duration-500 hover:shadow-2xl ${msg.role === 'user' ? 'rounded-tr-none shadow-xl' : 'rounded-tl-none'}`}
                  style={msg.role === 'user' ? userBubbleStyle : modelBubbleStyle}
                >
                  {msg.role === 'model' && (
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/20">
                          <Sparkles size={12} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-sky-400/60">Comet Response</span>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(displayContent); }}
                        className="p-1.5 rounded-lg text-sky-400/40 hover:text-sky-400 hover:bg-sky-500/20 transition-all opacity-0 group-hover:opacity-100"
                        title="Copy response"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {displayContent && (
                    <StreamingMarkdownMessage
                      content={displayContent}
                      animate={msg.role === 'model' && msg.id === activeStreamingMessageIdRef.current}
                    />
                  )}
                  {msgIsOcr && (msg as any).ocrText && (
                    <CollapsibleOCRMessage label={(msg as any).ocrLabel || 'SCREENSHOT_ANALYSIS'} content={(msg as any).ocrText} />
                  )}

                  {/* ── Inline Media: Images & Video Cards ─────────────────── */}
                  {msg.mediaItems && msg.mediaItems.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {msg.mediaItems.map((item, midx) => {
                        if (item.type === 'image') {
                          const imageUrl = item.url;
                          const handleDownload = async () => {
                            const link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = item.title || `image-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          };
                          const handleCopy = async () => {
                            try {
                              const response = await fetch(imageUrl);
                              const blob = await response.blob();
                              await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                            } catch {
                              // Fallback: just copy the URL
                              await navigator.clipboard.writeText(imageUrl);
                            }
                          };
                          return (
                            <motion.div
                              key={midx}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-2xl overflow-hidden border border-white/10 shadow-xl group relative"
                            >
                              <img
                                src={item.url}
                                alt={item.caption || 'Image'}
                                className="w-full max-h-80 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%230f0f1a" width="400" height="200"/><text fill="%23ffffff40" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">Image unavailable</text></svg>';
                                }}
                              />
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={handleDownload}
                                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors"
                                  title="Download"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                                <button
                                  onClick={handleCopy}
                                  className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors"
                                  title="Copy to clipboard"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                              {(item.caption || item.description) && (
                                <div className="px-3 py-2 bg-black/30 text-[10px] text-white/50 font-medium">
                                  {item.caption || item.description}
                                </div>
                              )}
                            </motion.div>
                          );
                        }
                        if (item.type === 'video') {
                          const isYt = item.source === 'youtube';
                          return (
                            <motion.a
                              key={midx}
                              href={item.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.preventDefault(); window.electronAPI?.createView?.({ tabId: `yt-${Date.now()}`, url: item.videoUrl }); store.addTab(item.videoUrl); }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="block rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-black/40 hover:border-sky-500/40 transition-all group cursor-pointer"
                            >
                              {/* Thumbnail */}
                              <div className="relative">
                                {item.thumbnailUrl ? (
                                  <img
                                    src={item.thumbnailUrl}
                                    alt={item.title}
                                    className="w-full max-h-52 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    onError={(e) => {
                                      // Fallback to hqdefault if maxresdefault 404s
                                      if (isYt && item.videoId) {
                                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-40 bg-gradient-to-br from-sky-900/40 to-purple-900/40 flex items-center justify-center">
                                    <Play size={40} className="text-white/30" />
                                  </div>
                                )}
                                {/* Play button overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 ${isYt ? 'bg-red-600' : 'bg-sky-500'}`}>
                                    <Play size={22} className="text-white ml-1" fill="white" />
                                  </div>
                                </div>
                                {/* Source badge */}
                                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isYt ? 'bg-red-600 text-white' : 'bg-sky-500 text-black'}`}>
                                  {isYt ? 'YouTube' : 'Video'}
                                </div>
                              </div>
                              {/* Info */}
                              <div className="p-3">
                                <p className="text-sm font-bold text-white/90 leading-tight line-clamp-2">{item.title}</p>
                                {item.description && (
                                  <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed line-clamp-3">{item.description}</p>
                                )}
                                <p className="text-[9px] text-sky-400/60 mt-2 font-mono truncate">{item.videoUrl}</p>
                              </div>
                            </motion.a>
                          );
                        }
                        if (item.type === 'mermaid') {
                          return (
                            <MermaidDiagram key={midx} diagramId={item.diagramId} code={item.code} />
                          );
                        }
                        if (item.type === 'flowchart') {
                          return (
                            <FlowchartDiagram key={midx} diagramId={item.diagramId} code={item.code} />
                          );
                        }
                        if (item.type === 'chart') {
                          return (
                            <ChartDiagram key={midx} chartId={item.chartId} data={item.data} options={item.options} />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                  {msg.actionLogs && msg.actionLogs.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {msg.actionLogs.map((log, idx) => {
                        const isSearch = log.type.includes('SEARCH');
                        const isRead = log.type.includes('READ') || log.type.includes('EXTRACT');
                        const isClick = log.type.includes('CLICK');
                        const isOcr = log.type.includes('SCREENSHOT') || log.type.includes('OCR') || log.type.includes('VISION');
                        const isPdf = log.type === 'PDF_READY';

                        let colorClass = log.success ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-red-500/10 border-red-500/30 text-red-400';
                        if (log.success) {
                          if (isClick) colorClass = 'bg-amber-500/10 border-amber-500/30 text-amber-500';
                          else if (isOcr) colorClass = 'bg-purple-500/10 border-purple-500/30 text-purple-400';
                          else if (isPdf) colorClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-pointer hover:bg-emerald-500/20';
                        }

                        return (
                          <div
                            key={idx}
                            onClick={() => isPdf && window.electronAPI.openPDF(log.output)}
                            className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border transition-all duration-300 hover:scale-105 shadow-sm active:scale-95 ${colorClass}`}
                            title={isPdf ? 'Click to open PDF' : log.output}
                          >
                            {isSearch && <Search size={12} />}
                            {(isRead || isPdf) && <FileText size={12} />}
                            {isClick && <MousePointerClick size={12} />}
                            {isOcr && <Camera size={12} />}
                            {!isSearch && !isRead && !isClick && !isOcr && !isPdf && (log.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />)}
                            <span>{isPdf ? 'Open PDF' : log.type.replace(/_/g, ' ')}</span>
                          </div>
                        );
                      })}

                    </div>
                  )}

                  {/* DOM Search Results Display */}
                  {i === messages.length - 1 && (domSearchResults.length > 0 || domSearchLoading || domMeta) && (
                    <DOMSearchDisplay
                      results={domSearchResults}
                      query={domSearchQuery}
                      isLoading={domSearchLoading}
                      onClose={() => { setDOMSearchResults([]); setDOMMeta(null); }}
                      type="dom"
                      timestamp={domMeta?.timestamp}
                    />
                  )}

                  {/* OCR Search Results Display */}
                  {i === messages.length - 1 && (ocrSearchResults.length > 0 || ocrSearchLoading) && (
                    <DOMSearchDisplay
                      results={ocrSearchResults}
                      query={ocrSearchQuery}
                      isLoading={ocrSearchLoading}
                      onClose={() => { setOCRSearchResults([]); }}
                      type="ocr"
                    />
                  )}

                  {msg.role === 'model' && (
                    <MessageActions content={displayContent} index={i} copiedIndex={copiedMessageIndex} onCopy={() => { }} onShare={() => { }} />
                  )}
                </div>
              </motion.div>
            )
          })}
          {isLoading && messages.length === 0 && <ThinkingIndicator theme={gradientPreset as ThemePreset} variant="full" />}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'model' && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))', borderColor: 'rgba(99,102,241,0.3)' }}
            >
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400/80 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-indigo-400/60 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-indigo-400/40 animate-pulse" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Comet is thinking</span>
            </div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className={`sticky bottom-0 transition-[padding] duration-500 p-6 pt-0`} style={{ background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--primary-bg) 75%, transparent) 28%, var(--primary-bg) 100%)', backdropFilter: 'blur(20px)' }}>
        <div className={`p-4 rounded-[2.5rem] border transition-all shadow-2xl relative group ${shiftTabGlow
          ? 'border-purple-500/80 shadow-[0_0_24px_4px_rgba(168,85,247,0.35)] focus-within:border-purple-500/80'
          : 'border-white/10 focus-within:border-sky-500/30'
          }`} style={softPanelStyle}>

          <div className="absolute -top-10 left-4 flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded-full border" style={popoverStyle}>
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-secondary-text">{currentActiveModel}</span>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {attachments.map((a, i) => (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={i} className="flex items-center gap-2 px-3 py-2 bg-sky-500/10 rounded-2xl text-[10px] text-sky-400 border border-sky-500/20">
                  {a.type === 'image' ? <ImageIcon size={12} /> : <FileText size={12} />}
                  <span className="max-w-[100px] truncate font-bold uppercase tracking-tight">{a.filename}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-400 transition-colors"><X size={12} /></button>
                </motion.div>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showActionsMenu && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                className="absolute bottom-28 left-4 z-[60] w-52 backdrop-blur-3xl border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden p-1.5"
                style={popoverStyle}
              >
                <button onClick={clearChat} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-red-500/70 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"><Trash2 size={14} /> Clear Thread</button>
                <div className="h-px bg-white/5 my-1 mx-2" />
                <button onClick={() => exportChat('text')} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><FileText size={14} /> Export text</button>
                <button onClick={() => exportChat('pdf')} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><Download size={14} /> Export PDF</button>
                <button onClick={copyChatToClipboard} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><CopyIcon size={14} /> Copy Context</button>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            value={inputMessage}
            onChange={(e) => {
              markSidebarInteraction();
              setInputMessage(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            onFocus={markSidebarInteraction}
            placeholder="Command your workspace..."
            className={`w-full bg-transparent text-sm text-primary-text placeholder:text-secondary-text outline-none resize-none modern-scrollbar font-medium transition-[height] duration-500 h-24 py-2`}
          />

          <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-2xl hover:bg-accent/5 text-secondary-text hover:text-primary-text transition-all"><Paperclip size={20} /></button>
              <button
                onClick={() => setShowConversationHistory(true)}
                title="Conversation history"
                className="p-3 rounded-2xl hover:bg-accent/5 text-secondary-text hover:text-primary-text transition-all"
              >
                <History size={20} />
              </button>
              <button onClick={() => setShowActionsMenu(!showActionsMenu)} className={`p-3 rounded-2xl transition-all ${showActionsMenu ? 'bg-accent/10 text-primary-text' : 'hover:bg-accent/5 text-secondary-text hover:text-primary-text'}`}><MoreHorizontal size={20} /></button>
            </div>
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputMessage.trim() && attachments.length === 0)}
              className={`group flex items-center justify-center w-12 h-12 rounded-[1.5rem] transition-all hover:scale-105 active:scale-95 disabled:opacity-10 disabled:grayscale`}
              style={{
                background: props.theme === 'custom' ? 'var(--custom-btn-bg)' : 'var(--accent)',
                color: props.theme === 'custom' ? 'var(--custom-btn-text)' : 'white',
                boxShadow: isLightTheme
                  ? '0 4px 12px var(--shadow-color)'
                  : '0 4px 15px var(--shadow-color)'
              }}
            >
              <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
        <p className="text-[8px] text-center text-secondary-text mt-5 uppercase tracking-[0.5em] font-black opacity-60">Neural Engine Active • {versionLabel}</p>
      </footer>

      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => { }} />
      <LLMProviderSettings
        {...props}
        showSettings={showLLMProviderSettings}
        setShowSettings={setShowLLMProviderSettings}
        ollamaModels={ollamaModelsList.map(m => ({ name: m.name, modified_at: (m as any).modified_at || 'Recently' }))}
        setOllamaModels={setOllamaModelsList}
        setError={setError}
      />
      {/* Feedback Notification */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-sky-500 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl z-[1000] flex items-center gap-2"
          >
            <CheckCircle2 size={14} /> {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduling Modal - only render if not controlled by props */}
      {props.showSchedulingModal === undefined && (
        <SchedulingModal
          isOpen={showSchedulingModal}
          onClose={() => {
            setShowSchedulingModal(false);
            setSchedulingIntent(null);
            if (props.setBrowserDisabled) props.setBrowserDisabled(false);
          }}
          onConfirm={handleSchedulingConfirm}
          taskDetails={{
            taskName: schedulingIntent?.taskName || 'Scheduled Task',
            taskType: schedulingIntent?.taskType || 'ai-prompt',
            schedule: schedulingIntent?.schedule.expression || '0 8 * * *',
            description: `Detected: ${schedulingIntent?.schedule.description || 'Custom schedule'}`,
          }}
        />
      )}
    </div>
  );
};

export default memo(AIChatSidebar);
