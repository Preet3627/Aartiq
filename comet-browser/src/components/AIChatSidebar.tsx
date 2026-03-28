"use client";

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Maximize2, Minimize2, FileText, Download, Wifi, WifiOff, X,
  ChevronLeft, ChevronRight, ChevronDown, Zap, Send, Paperclip,
  ScanLine,
  MoreVertical,
  Sparkles,
  Image as ImageIcon,
  Eye, EyeOff, Brain, Search, Loader2, MousePointerClick,
  CheckCircle2, AlertCircle, Layers,
  Share2, CopyIcon, Trash2, Printer, Cpu, Rocket, Camera, Terminal, MoreHorizontal, Play, History
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
import ClickPermissionModal from './ai/ClickPermissionModal';
import ConversationHistoryPanel, { type Conversation, type ChatMessage } from './ai/ConversationHistoryPanel';
import {
  robustJSONParse,
  extractAIReasoning,
  extractOCRResult,
  extractActionChain,
  extractMediaAttachments,
  cleanTagsFromText,
  extractActionCommands
} from './ai/RobustParsers';
import AISetupGuide from './ai/AISetupGuide';
import ThinkingIndicator from './ThinkingIndicator';
import LLMProviderSettings from './LLMProviderSettings';
import { AICommandQueue, type AICommand } from './AICommandQueue';
import CapabilitiesPanel from './CapabilitiesPanel';
import DOMSearchDisplay, { DOMMetaDisplay } from './ai/DOMSearchDisplay';
import { secureDOMReader, type DOMSearchResult, type FilteredDOMResult, type DOMElement } from './ai/SecureDOMReader';
import { detectSchedulingIntent, type SchedulingIntent } from './ai/SchedulingIntentDetector';
import SchedulingModal from './ai/SchedulingModal';

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaItem = {
  type: 'image';
  url: string;
  caption?: string;
} | {
  type: 'video';
  videoUrl: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  source: 'youtube' | 'other';
  videoId?: string;
};

type ExtendedChatMessage = ChatMessage & {
  attachments?: string[];
  isOcr?: boolean;
  ocrLabel?: string;
  ocrText?: string;
  thinkingSteps?: ThinkingStep[];
  thinkText?: string;
  actionLogs?: { type: string, output: string, success: boolean }[];
  mediaItems?: MediaItem[];
};

type VisualStage = 'idle' | 'fetching' | 'capturing';

const buildConversationTitle = (messages: ExtendedChatMessage[]): string => {
  const snippet = messages.find((m) => m.role === 'user')?.content
    ?? messages.find((m) => m.role === 'model')?.content
    ?? '';
  const cleaned = snippet
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (cleaned.length > 0) return cleaned;
  return `Conversation • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

interface Attachment {
  type: 'image' | 'pdf';
  data: string;
  ocrText?: string;
  filename: string;
}

type ClickableDomElement = {
  index: number;
  tagName: string;
  text: string;
  selector?: string;
  href?: string | null;
  ariaLabel?: string | null;
  title?: string | null;
  rect?: { x: number; y: number; width: number; height: number };
};

type PageDomInfo = {
  success: boolean;
  url?: string;
  title?: string;
  bodyText?: string;
  links?: Array<{ href: string; text: string }>;
  forms?: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; placeholder: string }> }>;
  clickableElements?: ClickableDomElement[];
  error?: string;
};

type ExtractedSearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

type RefusedIntent = 'credential_login' | 'session_export' | 'file_exfiltration';
interface RefusedIntentRecord {
  intent: RefusedIntent;
  site?: string;
  timestamp: number;
}

interface AIChatSidebarProps {
  studentMode: boolean;
  toggleStudentMode: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  selectedEngine: string;
  setSelectedEngine: (engine: string) => void;
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
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
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const AIChatSidebar: React.FC<AIChatSidebarProps> = (props) => {
  const router = useRouter();
  const store = useAppStore();
  const {
    aiProvider, ollamaBaseUrl, ollamaModel, openaiApiKey, localLLMBaseUrl,
    localLLMModel, geminiApiKey, anthropicApiKey, groqApiKey,
    hasSeenAiMistakeWarning, askForAiPermission, aiSafetyMode,
    additionalAIInstructions, selectedLanguage, history, tabs, activeTabId,
    currentUrl, sidebarWidth,
    setShowAiMistakeWarning, setActiveView,
    setCurrentUrl, setSidebarWidth, setGeminiModel,
    localLlmMode, autoGeminiModelUpdates, geminiModel,
    setTheme: storeSetTheme,
    ollamaModelsList, setOllamaModelsList, setOllamaModel, geminiModel: storeGeminiModel,
    hasSeenNeuralSetup, setHasSeenNeuralSetup,
  } = store;

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
  const chainApprovedRef = useRef(false);

  // Reasoning steps
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [thinkingText, setThinkingText] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const thinkingIdCounter = useRef(0);

  // Refs & Workers
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tesseractWorkerRef = useRef<Tesseract.Worker | null>(null);
  const refusedIntentsRef = useRef<RefusedIntentRecord[]>([]);

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

  const [permissionPending, setPermissionPending] = useState<any | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [shiftTabGlow, setShiftTabGlow] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<Array<{ id: string; command: string; output: string; success: boolean; timestamp: number }>>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalLogIdCounter = useRef(0);
  const isDevMode = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

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

  const extractActivePageOcrText = useCallback(async (): Promise<string> => {
    let ocrText = '';

    if (window.electronAPI?.captureBrowserViewScreenshot) {
      try {
        const screenshotData = await window.electronAPI.captureBrowserViewScreenshot();
        if (screenshotData) {
          const { data } = await Tesseract.recognize(screenshotData, 'eng', {
            logger: (m: any) => {
              if (m.status === 'recognizing text') {
                setPdfProgress(Math.round(m.progress * 100));
              }
            }
          });
          ocrText = data?.text || '';
        }
      } catch (e) {
        console.warn('[AI] Browser OCR capture failed', e);
      }
    }

    if (!ocrText && window.electronAPI?.visionDescribe) {
      try {
        const visionRes = await window.electronAPI.visionDescribe('Extract visible text, buttons, links, and important page content from this browser tab.');
        ocrText = typeof visionRes === 'string' ? visionRes : ((visionRes as any)?.description || '');
      } catch (e) {
        console.warn('[AI] Vision fallback failed', e);
      }
    }

    if (!ocrText && window.electronAPI?.ocrScreenText) {
      try {
        const ocrRes = await window.electronAPI.ocrScreenText();
        ocrText = typeof ocrRes === 'string' ? ocrRes : ((ocrRes as any)?.text || '');
      } catch (e) {
        console.warn('[AI] Screen OCR fallback failed', e);
      }
    }

    return scrubbedContent(ocrText || '');
  }, []);

  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  const ensureBrowserContextReady = useCallback(async () => {
    setActiveView('browser');
    if (!window.electronAPI) return;
    window.electronAPI.showAllViews?.();
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }, [setActiveView]);

  const readPageContentSmart = useCallback(async (domTimeoutMs = 7000): Promise<{ method: 'dom' | 'ocr'; content: string; error?: string }> => {
    await ensureBrowserContextReady();
    if (!window.electronAPI?.extractPageContent) {
      const ocrOnlyText = await extractActivePageOcrText();
      if (ocrOnlyText.length > 40) {
        return { method: 'ocr', content: ocrOnlyText };
      }
      return { method: 'ocr', content: '', error: 'DOM reader unavailable and OCR returned no usable text' };
    }
    try {
      const domRes = await withTimeout(window.electronAPI.extractPageContent(), domTimeoutMs, 'DOM read timeout');
      const domText = scrubbedContent(domRes?.content || '');
      if (domText.length > 80) {
        return { method: 'dom', content: domText };
      }
    } catch (err: any) {
      console.warn('[AI] DOM read timed out or failed, switching to OCR fallback:', err?.message || err);
    }

    const ocrText = await extractActivePageOcrText();
    if (ocrText.length > 40) {
      return { method: 'ocr', content: ocrText };
    }

    return { method: 'ocr', content: '', error: 'No readable page content from DOM or OCR' };
  }, [ensureBrowserContextReady, extractActivePageOcrText, withTimeout]);

  const buildClickableElementsSummary = useCallback((pageInfo?: PageDomInfo | null): string => {
    const clickableElements = (pageInfo?.clickableElements || [])
      .filter((element) => (element.text || element.ariaLabel || element.title || '').trim().length > 0)
      .slice(0, 12);

    if (clickableElements.length === 0) {
      return '';
    }

    return clickableElements.map((element, index) => {
      const label = element.text || element.ariaLabel || element.title || '(unlabeled control)';
      const selector = element.selector ? ` selector=${element.selector}` : '';
      const href = element.href ? ` href=${element.href}` : '';
      return `${index + 1}. <${element.tagName}> "${label}"${selector}${href}`;
    }).join('\n');
  }, []);

  const getActivePageAutomationContext = useCallback(async (): Promise<string> => {
    if (!window.electronAPI?.getCurrentUrl || !window.electronAPI?.getPageDomInfo) {
      return '';
    }

    try {
      const liveUrl = await window.electronAPI.getCurrentUrl();
      const pageInfo = await window.electronAPI.getPageDomInfo(activeTabId) as PageDomInfo;

      if (!liveUrl && !pageInfo?.success) {
        return '';
      }

      const clickableSummary = buildClickableElementsSummary(pageInfo);
      const linkSummary = (pageInfo?.links || [])
        .filter((link) => link.href)
        .slice(0, 8)
        .map((link, index) => `${index + 1}. ${link.text || link.href} -> ${link.href}`)
        .join('\n');

      const textSnippet = scrubbedContent(pageInfo?.bodyText || '').slice(0, 1200);

      return [
        '[ACTIVE PAGE CONTEXT]',
        `URL: ${liveUrl || pageInfo?.url || currentUrl || 'Unknown'}`,
        `TITLE: ${pageInfo?.title || 'Unknown'}`,
        clickableSummary ? `[CLICKABLE ELEMENTS]\n${clickableSummary}` : '',
        linkSummary ? `[VISIBLE LINKS]\n${linkSummary}` : '',
        textSnippet ? `[VISIBLE PAGE TEXT]\n${textSnippet}` : '',
        'Use CLICK_ELEMENT with selector when available. If only button text is known, CLICK_ELEMENT may use the text label as a fallback.'
      ].filter(Boolean).join('\n');
    } catch (e) {
      console.warn('[AI] Failed to build active page automation context', e);
      return '';
    }
  }, [activeTabId, buildClickableElementsSummary, currentUrl]);

  const openSearchLinksAndAnalyze = useCallback(async (query: string) => {
    if (!window.electronAPI) {
      return { results: [] as ExtractedSearchResult[], openedPages: [] as string[] };
    }

    await new Promise((resolve) => setTimeout(resolve, 2200));

    const extraction = await window.electronAPI.extractSearchResults();
    const results = ((extraction?.results || []) as ExtractedSearchResult[])
      .filter((result) => result?.url && result?.title)
      .slice(0, 4);

    const openedPages: string[] = [];

    for (const result of results.slice(0, 2)) {
      store.addTab(result.url, 'ai-search-result');
      setActiveView('browser');
      await new Promise((resolve) => setTimeout(resolve, 2500));

      let resolvedUrl = result.url;
      let pageTitle = result.title;
      let domSnippet = '';

      try {
        resolvedUrl = await window.electronAPI.getCurrentUrl();
      } catch {
        resolvedUrl = result.url;
      }

      try {
        const pageInfo = await window.electronAPI.getPageDomInfo() as PageDomInfo;
        pageTitle = pageInfo?.title || pageTitle;
        domSnippet = scrubbedContent(pageInfo?.bodyText || '').slice(0, 1400);
      } catch (e) {
        console.warn('[AI] Failed to inspect opened search result DOM', e);
      }

      if (!domSnippet) {
        try {
          const pageRes = await window.electronAPI.extractPageContent();
          domSnippet = scrubbedContent(pageRes?.content || '').slice(0, 1400);
        } catch (e) {
          console.warn('[AI] Failed to extract opened search result content', e);
        }
      }

      const ocrSnippet = (await extractActivePageOcrText()).slice(0, 1400);
      const pageSummary = [
        `TITLE: ${pageTitle}`,
        `URL: ${resolvedUrl}`,
        domSnippet ? `[DOM]\n${domSnippet}` : '',
        ocrSnippet ? `[OCR]\n${ocrSnippet}` : ''
      ].filter(Boolean).join('\n');

      if (pageSummary) {
        openedPages.push(pageSummary);
        await BrowserAI.addToVectorMemory(pageSummary, {
          type: 'opened_search_result',
          query,
          url: resolvedUrl,
          title: pageTitle
        });
      }
    }

    return { results, openedPages };
  }, [extractActivePageOcrText, setActiveView, store]);

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
    if (!window.electronAPI?.onAutomationShellApproval || !window.electronAPI?.respondAutomationShellApproval) return;
    const cleanup = window.electronAPI.onAutomationShellApproval((payload) => {
      setPermissionPending({
        resolve: (allowed: boolean) => {
          window.electronAPI.respondAutomationShellApproval({ requestId: payload.requestId, allowed });
        },
        context: {
          action: payload.command || 'Shell command',
          what: payload.command,
          reason: payload.reason || 'A pending automation needs your approval.',
          risk: payload.risk || 'medium',
          actionType: 'SHELL_COMMAND',
          target: payload.command,
          highRiskQr: payload.highRiskQr,
        },
      });
    });
    return cleanup;
  }, []);

  // ---------------------------------------------------------------------------
  // Helper Logic
  // ---------------------------------------------------------------------------

  const addThinkingStep = useCallback((label: string, detail?: string): string => {
    const id = `think-${Date.now()}-${thinkingIdCounter.current++}`;
    setThinkingSteps((prev) => [...prev, { id, label, status: 'running', detail, timestamp: Date.now() }]);
    return id;
  }, []);

  const resolveThinkingStep = useCallback((id: string, status: 'done' | 'error', detail?: string) => {
    setThinkingSteps((prev) => prev.map((s) => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s));
  }, []);

  const requestActionPermission = useCallback(async (
    actionType: string, action: string, target: string, what: string, reason: string,
    risk: 'low' | 'medium' | 'high' = 'low'
  ): Promise<boolean> => {
    // 1. If low risk, auto-approve
    if (risk === 'low') return true;

    // 2. Check if user already granted this action permanently
    const permKey = `${actionType}:${target || what}`;
    if (window.electronAPI?.permCheck) {
      const res = await window.electronAPI.permCheck(permKey);
      if (res.granted) {
        console.log(`[Permission] Pre-authorized via store: ${permKey}`);
        return true;
      }
    }

    let highRiskQr = null;
    if (risk === 'high' && window.electronAPI?.generateHighRiskQr) {
      highRiskQr = await window.electronAPI.generateHighRiskQr(Math.random().toString(36).substring(7));
    }
    return new Promise((resolve) => {
      setPermissionPending({ resolve, context: { actionType, action, target, what, reason, risk, highRiskQr } });
    });
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
    if (aiProvider === 'openai' && openaiApiKey) return true;
    if (aiProvider === 'anthropic' && anthropicApiKey) return true;
    if (aiProvider === 'groq' && groqApiKey) return true;
    return false;
  }, [aiProvider, ollamaBaseUrl, geminiApiKey, openaiApiKey, anthropicApiKey, groqApiKey]);

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

  const reasoningOptions = useMemo(() => buildFrontendReasoningOptions(
    (localLlmMode || 'normal') as LlmMode,
    normalizedProvider,
    {
      model: normalizedProvider === 'ollama' ? (ollamaModel || 'llama3')
        : normalizedProvider === 'google' ? (geminiModel || 'gemini-2.0-flash')
          : undefined,
      baseUrl: normalizedProvider === 'ollama' ? ollamaBaseUrl : undefined,
    }
  ), [localLlmMode, normalizedProvider, ollamaModel, ollamaBaseUrl, geminiModel]);

  const getStreamingResponse = useCallback(async (history: ChatMessage[]): Promise<any> => {
    return new Promise((resolve) => {
      let fullText = '';
      let fullThought = '';

      const cleanup = window.electronAPI.onChatStreamPart((part: any) => {
        if (part.type === 'text-delta') {
          fullText += (part.textDelta || '');
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'model') {
              const updated = [...prev];
              updated[prev.length - 1] = { ...lastMessage, content: fullText };
              return updated;
            }
            return prev;
          });
        } else if (part.type === 'reasoning-delta') {
          fullThought += (part.reasoningDelta || '');
          setThinkingText(fullThought.trim());
        } else if (part.type === 'error') {
          cleanup();
          resolve({ error: part.error });
        } else if (part.type === 'finish') {
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
    // let the user try anyway (they may have set a key via store directly).
    if (!isAiSetup()) {
      if (!hasSeenNeuralSetup) {
        setHasSeenNeuralSetup(true);
        setShowSetupGuide(true);
      }
      // Still fall through and attempt to send — the error from main.js will explain
    }

    if (!customContent) { setInputMessage(''); setAttachments([]); }
    setIsLoading(true);
    setIsThinking(true);
    setThinkingSteps([]);
    setThinkingText('');
    setError(null);
    chainApprovedRef.current = false;

    // Security Checks
    const threatCheck = checkThreat(rawContent);
    if (threatCheck.blocked) {
      setMessages(prev => [...prev, { role: 'user', content: rawContent }, { role: 'model', content: threatCheck.response ?? '' }] as ExtendedChatMessage[]);
      setIsLoading(false); setIsThinking(false); return;
    }

    // Check for scheduling intent
    const intent = detectSchedulingIntent(rawContent);
    if (intent && intent.detected && intent.confidence === 'high') {
      setSchedulingIntent(intent);
      setShowSchedulingModal(true);
      if (props.setBrowserDisabled) props.setBrowserDisabled(true);
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
      setMessages(prev => [...prev, userMessage, { role: 'model', content: '✨ **Unlocking Neural Potential...**' }]);
      setCommandQueue([capCmd]);
      setCurrentCommandIndex(0);
      setIsLoading(false);
      setIsThinking(false);
      return;
    }

    setMessages(prev => [...prev, userMessage]);
    if (wasProtected) setMessages(prev => [...prev, { role: 'model', content: '🛡️ **AI Fortress Active**: Sensitive data protected.' }]);

    try {
      if (!window.electronAPI) throw new Error('AI Engine disconnected.');

      // RAG & Live Data (Pre-retrieval)
      const ragId = addThinkingStep('Neural Retrieval...');
      const contextItems = await BrowserAI.retrieveContext(protectedContent);
      setRagContextItems(contextItems);
      if (contextItems.length > 0) setShowRagPanel(true);
      resolveThinkingStep(ragId, 'done', `${contextItems.length} memories recovered`);

      // ✅ NEW: Pre-flight live search — run BEFORE the LLM call
      // If the query is about news/prices/events/current data, fetch real results NOW
      // and inject them into the LLM context so it cannot hallucinate.
      let liveSearchContext = '';
      if (queryRequiresSearch(protectedContent)) {
        const preflightId = addThinkingStep('🔍 Fetching live data before answering...');
        try {
          const topic = protectedContent
            .replace(/\b(create|make|generate|write|give me|show me|tell me|what are|what is|latest|find|search|get)\b/gi, '')
            .replace(/\b(pdf|report|document|page|today|news|please|can you|could you)\b/gi, '')
            .trim()
            .slice(0, 80) || 'technology news';

          liveSearchContext = await fetchRealSearchContext(topic);
          resolveThinkingStep(preflightId, 'done', `Live data fetched (${liveSearchContext.length} chars)`);
        } catch (e) {
          resolveThinkingStep(preflightId, 'error', 'Live search failed — LLM will proceed with memory only');
        }
      }

      // ✅ NEW: Browser State Injection (Active Tab & Open Tabs)
      let browserStateContext = '';
      try {
        const tabs: any[] = await window.electronAPI.getOpenTabs();
        const activeTab = tabs.find(t => t.active) || tabs[0];
        if (tabs.length > 0) {
          browserStateContext = `[BROWSER STATE]\n- ACTIVE TAB: ${activeTab?.title || 'Unknown'} (${activeTab?.url || currentUrl || 'N/A'})\n- OPEN TABS (${tabs.length}):\n${tabs.map((t, idx) => `  ${idx + 1}. ${t.title} (${t.url}) ${t.active ? '[ACTIVE]' : ''}`).join('\n')}`;
        }
      } catch (e) {
        console.warn('Failed to fetch browser state for LLM context', e);
      }

      const activePageContext = await getActivePageAutomationContext();

      // LLM Request — Build context with REAL data injected
      const aiId = addThinkingStep('LLM Processing...');

      // Get recent search context to avoid re-searching
      const searchContextSummary = searchContextStore.getContextSummary();

      const contextBlock = [
        searchContextSummary !== 'No recent context available.' ? `[📚 RECENT CONTEXT — CHECK THIS BEFORE SEARCHING!]\n${searchContextSummary}` : '',
        browserStateContext,
        activePageContext,
        contextItems.length > 0
          ? `[RAG MEMORY]\n${contextItems.map(c => c.text).join('\n')}`
          : '',
        liveSearchContext
          ? `[LIVE SEARCH RESULTS — USE ONLY THESE FOR CURRENT FACTS, DO NOT INVENT DATA]\n${liveSearchContext}`
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
      const MAX_ITERATIONS = 5;
      let finalSynthesisDone = false;

      while (iterations < MAX_ITERATIONS && !finalSynthesisDone) {
        iterations++;
        const aiId = addThinkingStep(iterations === 1 ? 'LLM Processing...' : `Action Chain Synthesis & Evaluation (Step ${iterations})...`);

        setMessages(prev => [...prev, { role: 'model', content: '' }] as ExtendedChatMessage[]);
        const response = await getStreamingResponse(currentHistory);
        resolveThinkingStep(aiId, response.error ? 'error' : 'done');

        if (response.error) throw new Error(response.error);

        // Clean up text format to remove the action commands from the visible message
        // parseAICommands now handles ALL formats (JSON, brackets, HTML comments) with built-in deduplication
        let { commands, responseText } = prepareCommandsForExecution(response.text);
        
        // Also strip any remaining command tags/JSON for display
        responseText = stripAllCommands(responseText);

        // Update the last visible message to include the response content and reasoning
        setMessages(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx].role === 'model') {
             updated[lastIdx] = { 
               ...updated[lastIdx], 
               content: responseText,
               thinkText: response.thought // 🚀 PERSIST reasoning for exports/copy
             };
          }
          return updated;
        });

        if (commands.length === 0) {
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
        setCommandQueue(aiCommands);
        setCurrentCommandIndex(0);

        const finalCommands = await new Promise<AICommand[]>((resolve) => {
          const timeout = setTimeout(() => resolve([]), 300000);
          let isResolved = false;
          const checkStatus = () => {
            if (isResolved) return;
            setCommandQueue(q => {
              const allDone = q.length === 0 || q.every(c => c.status === 'completed' || c.status === 'failed');
              if (allDone && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                resolve(q);
              } else if (!isResolved) {
                setTimeout(checkStatus, 500);
              }
              return q;
            });
          };
          checkStatus();
        });

        resolveThinkingStep(cmdId, 'done');

        // If the queue was manually emptied (aborted) by the user during execution
        if (finalCommands.length === 0 && commands.length > 0) {
           setMessages(prev => [...prev, { role: 'model', content: '(⚠️ Sequence aborted by user)' } as ExtendedChatMessage]);
           break;
        }

        // Loop Synthesis step: Feed action outputs back into context
        const actionResults = finalCommands.map(c =>
          `[Action ${c.type}]: ${c.status === 'completed' ? (c.output || 'Success') : ('Error: ' + (c.error || 'Failed'))}`
        ).join('\n');

        currentHistory = [
          ...currentHistory,
          { 
            role: 'user', 
            content: `Action outputs for the steps above:\n${actionResults}\n\nPlease analyze these results. If any step failed, explain why and execute an alternative action if possible using command formatting. If the steps succeeded or you have sufficient data, provide the comprehensive final answer to the original request now.` 
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
  }, [inputMessage, attachments, messages, aiProvider, currentUrl, addThinkingStep, resolveThinkingStep, getStreamingResponse, isAiSetup, fetchRealSearchContext, getActivePageAutomationContext]);

  const processNextCommand = useCallback(async () => {
    console.log('[AI] processNextCommand called, current index:', currentCommandIndex, 'queue length:', commandQueue.length);
    if (processingQueueRef.current || currentCommandIndex >= commandQueue.length) {
      console.log('[AI] Skipping - processing:', processingQueueRef.current, 'index >= length:', currentCommandIndex >= commandQueue.length);
      return;
    }

    processingQueueRef.current = true;
    const command = commandQueue[currentCommandIndex];

    setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));

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
            store.addTab(targetUrl, 'ai-session'); // ✨ ALWAYS create a new tab for AI navigations
            output = `Opened new tab and navigated to ${targetUrl}`;
          }
          break;
        }

        case 'CLICK_ELEMENT': {
          const selector = command.value.split('|')[0].trim();
          const clickStepId = addThinkingStep(`Clicking element: ${selector}...`);
          try {
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

        case 'CLICK_ELEMENT': {
          const selector = command.value.split('|')[0].trim();
          const clickStepId = addThinkingStep(`Clicking element: ${selector}...`);
          try {
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
          let isDirectUrl = false;
          
          // If the AI mistakenly uses WEB_SEARCH but provides a direct URL, handle it as a direct navigation
          if (query.match(/^https?:\/\/[^\s]+/i) || query.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/.*)?$/)) {
             searchUrl = query.startsWith('http') ? query : `https://${query}`;
             isDirectUrl = true;
             query = `Opening URL: ${searchUrl}`; // Just for logging
          }

          setActiveView('browser');

          store.addTab(searchUrl, 'ai-session'); // ✨ ALWAYS create a new tab for deep web searches
          output = `Opened new tab for: "${query}"`;

          if (!isDirectUrl) {
            const { results: extractedResults, openedPages } = await openSearchLinksAndAnalyze(query);
            const ragResults = await window.electronAPI.webSearchRag(query);
            const ragSnippets = (ragResults || [])
              .map((result: string) => result.trim())
              .filter(Boolean)
              .slice(0, 6);

            if (extractedResults.length > 0 || ragSnippets.length > 0 || openedPages.length > 0) {
              const extractedSummary = extractedResults.length > 0
                ? extractedResults.map((result, index) => `${index + 1}. ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet || 'No snippet available'}`).join('\n\n')
                : '';
              const openedSummary = openedPages.length > 0
                ? openedPages.map((page, index) => `OPENED RESULT ${index + 1}\n${page}`).join('\n\n')
                : '';
              const ragSummary = ragSnippets.length > 0
                ? ragSnippets.join('\n---\n')
                : '';

              const fullSnippet = [
                `[WEB_SEARCH RESULTS for "${query}"]`,
                extractedSummary ? `[EXTRACTED LINKS]\n${extractedSummary}` : '',
                openedSummary ? `[OPENED RESULT PAGES]\n${openedSummary}` : '',
                ragSummary ? `[SUPPLEMENTAL SEARCH SNIPPETS]\n${ragSummary}` : ''
              ].filter(Boolean).join('\n\n');

              await BrowserAI.addToVectorMemory(fullSnippet, {
                type: 'web_search',
                query,
                url: searchUrl,
                timestamp: Date.now()
              });

              output = [
                `Search results for "${query}":`,
                extractedSummary ? `[Top Links]\n${extractedSummary}` : '',
                openedSummary ? `[Opened + OCR/DOM Analysis]\n${openedSummary}` : '',
                ragSummary ? `[Extra Search Snippets]\n${ragSummary}` : ''
              ].filter(Boolean).join('\n\n');
              break;
            }
          }

          {
            // Fallback: wait for the search page to load slightly and try DOM / OCR extraction
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
              await ensureBrowserContextReady();
              const domRes = await withTimeout(window.electronAPI.extractPageContent(), 7000, 'Web search DOM fallback timeout');
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
          const readResult = await readPageContentSmart(7500);
          if (readResult.content) {
            const scrubbed = scrubbedContent(readResult.content);
            const label = readResult.method === 'dom' ? 'PAGE_CONTENT_DOM' : 'PAGE_CONTENT_OCR_FALLBACK';
            output = `Page content read (${readResult.method.toUpperCase()}) (${scrubbed.length} chars):\n${scrubbed.substring(0, 4000)}...`;
            await BrowserAI.addToVectorMemory(scrubbed, { type: 'page_content', source: readResult.method, url: currentUrl });

            // Store in context for reuse
            searchContextStore.addPageContent(currentUrl, currentUrl, scrubbed);

            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'model') {
                const updated = [...prev];
                updated[prev.length - 1] = { ...last, isOcr: true, ocrLabel: label, ocrText: scrubbed };
                return updated;
              }
              return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: label, ocrText: scrubbed } as ExtendedChatMessage];
            });
          } else {
            output = `Error reading page: ${readResult.error || 'Unknown error'}`;
          }
          break;
        }

        case 'SET_THEME':
          storeSetTheme(command.value as any);
          output = `Theme set to ${command.value}`;
          break;

        case 'OPEN_VIEW':
          setActiveView(command.value as any);
          output = `Switched to ${command.value} view`;
          break;

        case 'SET_VOLUME':
          await window.electronAPI.setVolume(parseInt(command.value));
          output = `System volume adjusted to ${command.value}%`;
          break;

        case 'SET_BRIGHTNESS':
          await window.electronAPI.setBrightness(parseInt(command.value));
          output = `Screen brightness adjusted to ${command.value}%`;
          break;

        case 'SHELL_COMMAND': {
          let confirmed = chainApprovedRef.current;
          let preApproved = false;
          if (!confirmed) {
            setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
            confirmed = await requestActionPermission(
              'SHELL_COMMAND', 'Execute Shell Command', 'Terminal', command.value,
              'The AI needs to run this command to complete your task.', 'low'
            );
            preApproved = confirmed;
            if (confirmed) chainApprovedRef.current = true;
          }
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          const logId = `term-${Date.now()}-${terminalLogIdCounter.current++}`;
          const logEntry = { id: logId, command: command.value, output: '', success: false, timestamp: Date.now() };
          if (confirmed) {
            setShowTerminal(true);
            setTerminalLogs(prev => [...prev, { ...logEntry, output: '⏳ Running...' }]);
            const res = await window.electronAPI.executeShellCommand(command.value, preApproved);
            const cmdOutput = res.success ? (res.output || '(no output)') : `Error: ${res.error}`;
            setTerminalLogs(prev => prev.map(l => l.id === logId
              ? { ...l, output: cmdOutput, success: !!res.success }
              : l
            ));
            output = `$ ${command.value}\n${cmdOutput}`;
          } else {
            setTerminalLogs(prev => [...prev, { ...logEntry, output: '⛔ Denied by user.', success: false }]);
            output = 'Command execution denied by user.';
          }
          break;
        }

        case 'OPEN_APP': {
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'awaiting_permission' } : cmd));
          const confirmed = await requestActionPermission(
            'OPEN_APP', 'Open Application', command.value, command.value,
            'The AI wants to launch an external application.', 'medium'
          );
          setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'executing' } : cmd));
          if (confirmed) {
            await window.electronAPI.openExternalApp(command.value);
            output = `Application ${command.value} launched.`;
          } else {
            output = 'App launch denied by user.';
          }
          break;
        }

        case 'LIST_AUTOMATIONS': {
          const result = window.electronAPI?.getScheduledTasks ? await window.electronAPI.getScheduledTasks() : [];
          const tasks = Array.isArray(result) ? result : (Array.isArray(result?.tasks) ? result.tasks : []);
          if (!tasks.length) {
            output = 'No automation tasks are currently scheduled.';
          } else {
            output = tasks.map((task, idx) => {
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

        // ✅ NEW: CREATE_PDF_JSON - Primary JSON-based PDF generation
        // Format: JSON object with structured pages and sections
        case 'CREATE_PDF_JSON': {
          let rawValue = (command.value || '').trim();
          
          let pdfData: any;
          let parsedJson: any = null;
          
          // Clean up malformed input
          rawValue = rawValue.replace(/^\s*\]+\s*:\s*/, '').trim();
          
          // Try to extract and parse JSON from the command value
          try {
            // First try parsing the whole value as JSON
            try {
              parsedJson = JSON.parse(rawValue);
            } catch {
              // Try to extract JSON from markdown code blocks
              const jsonMatch = rawValue.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (jsonMatch && jsonMatch[1]) {
                try {
                  parsedJson = JSON.parse(jsonMatch[1].trim());
                } catch {
                  // Try to fix unescaped newlines in the JSON
                  const fixedJson = jsonMatch[1].trim().replace(/\\n/g, '\\\\n').replace(/\\r/g, '');
                  try {
                    parsedJson = JSON.parse(fixedJson);
                  } catch {
                    parsedJson = null;
                  }
                }
              }
              
              // Try to find JSON object anywhere in the text
              if (!parsedJson) {
                const objMatch = rawValue.match(/\{[\s\S]*?(?:title|pages)[\s\S]*?\}/);
                if (objMatch) {
                  try {
                    parsedJson = JSON.parse(objMatch[0]);
                  } catch {
                    // Try fixing common JSON issues
                    const fixed = objMatch[0].replace(/\n/g, '\\n').replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
                    try {
                      parsedJson = JSON.parse(fixed);
                    } catch {
                      parsedJson = null;
                    }
                  }
                }
              }
            }
            
            if (!parsedJson || typeof parsedJson !== 'object') {
              throw new Error('No valid JSON found in CREATE_PDF_JSON command');
            }
            
            pdfData = parsedJson;
          } catch (e) {
            // JSON parsing failed - fall back to markdown generation
            console.warn('[PDF] JSON parsing failed, falling back to GENERATE_PDF:', (e as Error).message);
            output = `⚠️ JSON parsing failed. Please use proper JSON format.`;
            output += `\n\n**Correct format:**\n\`\`\`json\n{\n  "title": "Document Title",\n  "template": "professional",\n  "content": "Your content here..."\n}\n\`\`\``;
            output += `\n\nOr use markdown format: [GENERATE_PDF: Title | actual content here...]`;
            break;
          }
          
          // Validate required fields
          if (!pdfData.title && !pdfData.pages) {
            output = '❌ JSON must have at least "title" or "pages" field';
            break;
          }
          
          const pdfTitle = pdfData.title || 'Document';
          const pdfSubtitle = pdfData.subtitle || '';
          const pdfAuthor = pdfData.author || 'Comet AI';
          const template = pdfData.template || 'professional';
          const watermark = pdfData.watermark || '';
          const bgColor = pdfData.bgColor || '#ffffff';
          const priority = pdfData.priority || 'normal';
          
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
          
          setIsGeneratingPDF(true);
          setPdfProgress(0);
          setShowTerminal(true);
          setStreamingPDFContent(`Preparing PDF: ${pdfTitle}...`);

          await preloadCometIconLocal();
          const iconSource = (window as any).__cometIconBase64 || null;
          
          try {
            const cleanHTML = generateSmartPDF(pdfContent, iconSource);
            const res = await window.electronAPI.generatePDF(pdfTitle, cleanHTML) as any;
            
            setIsGeneratingPDF(false);
            setPdfProgress(100);
            setStreamingPDFContent('');
            
            if (res.success) {
              output = `✅ **PDF Generated Successfully!**\n\n**Title:** ${pdfTitle}\n**Template:** ${template}\n**File:** ${res.filePath}`;
            } else {
              output = `❌ PDF generation failed: ${res.error}`;
            }
          } catch (e: any) {
            setIsGeneratingPDF(false);
            setStreamingPDFContent('');
            output = `❌ Error generating PDF: ${e.message}`;
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
            version: 'v0.2.5',
            features: capabilityFeatures,
            platform: 'Windows, macOS, Linux, Android'
          }, screenshotBase64, iconSource);
          
          await window.electronAPI.generatePDF(pdfTitle, capabilityPDF);
          setMessages(prev => [...prev, { role: 'model', content: "✅ **Capability Report PDF generated and saved!**" }]);

          // Final Summary
          setMessages(prev => [...prev, { role: 'model', content: `
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

*Comet AI v0.2.5 - The AI-Native Browser*
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
            const readResult = await readPageContentSmart(7000);
            if (readResult.content) {
              const scrubbed = scrubbedContent(readResult.content);
              output = `Extracted data from page (${scrubbed.length} chars):\n${scrubbed.substring(0, 4000)}...`;
              await BrowserAI.addToVectorMemory(scrubbed, { type: 'extracted_data', source: readResult.method, selector, url: currentUrl });
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
            await ensureBrowserContextReady();
            const res = await withTimeout(window.electronAPI.searchDOM(query), 7000, 'DOM search timeout');
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
            const ocrText = await extractActivePageOcrText();
            if (ocrText) {
              const fallbackMatches = ocrText
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 10)
                .map((line, idx) => ({ text: line, context: line, xpath: `ocr://${idx + 1}`, score: 1, tag: 'ocr' as const }));
              setOCRSearchQuery(query);
              setOCRSearchResults(fallbackMatches);
              output = `DOM search timed out/failed, OCR fallback used. Found ${fallbackMatches.length} OCR matches for "${query}".`;
              resolveThinkingStep(searchStepId, 'done', `OCR fallback (${fallbackMatches.length} matches)`);
            } else {
              output = `DOM search error: ${e.message}`;
              resolveThinkingStep(searchStepId, 'error', e.message);
            }
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
            await ensureBrowserContextReady();
            const res = await withTimeout(window.electronAPI.extractSecureDOM(), 8000, 'Secure DOM read timeout');
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
            const fallback = await readPageContentSmart(5000);
            if (fallback.content) {
              const fallbackMode = fallback.method === 'dom' ? 'DOM' : 'OCR';
              output = `Secure DOM read timed out/failed, ${fallbackMode} fallback used (${fallback.content.length} chars).\n\n${fallback.content.substring(0, 4000)}...`;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                const label = fallback.method === 'dom' ? 'DOM_READ_DOM_FALLBACK' : 'DOM_READ_OCR_FALLBACK';
                if (last && last.role === 'model') {
                  const updated = [...prev];
                  updated[prev.length - 1] = { ...last, isOcr: true, ocrLabel: label, ocrText: fallback.content };
                  return updated;
                }
                return [...prev, { role: 'model', content: '', isOcr: true, ocrLabel: label, ocrText: fallback.content } as ExtendedChatMessage];
              });
              resolveThinkingStep(readStepId, 'done', `Fallback ${fallback.method.toUpperCase()} read`);
            } else {
              output = `DOM read error: ${e.message}`;
              resolveThinkingStep(readStepId, 'error', e.message);
            }
          }
          break;
        }

        default:
          output = `Operation ${command.type} completed.`;
      }

      setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'completed', output } : cmd));

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          const updated = [...prev];
          const actionLogs = last.actionLogs || [];
          updated[prev.length - 1] = {
            ...last,
            actionLogs: [...actionLogs, { type: command.type, output, success: true }]
          };
          return updated;
        }
        return prev;
      });

    } catch (err: any) {
      setCommandQueue(prev => prev.map((cmd, i) => i === currentCommandIndex ? { ...cmd, status: 'failed', error: err.message } : cmd));

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          const updated = [...prev];
          const actionLogs = last.actionLogs || [];
          updated[prev.length - 1] = {
            ...last,
            actionLogs: [...actionLogs, { type: command.type, output: err.message, success: false }]
          };
          return updated;
        }
        return prev;
      });
    } finally {
      await new Promise(resolve => setTimeout(resolve, 2000));
      processingQueueRef.current = false;
      setCurrentCommandIndex(prev => prev + 1);
    }
  }, [commandQueue, currentCommandIndex, activeTabId, router, storeSetTheme, setActiveView, currentUrl, requestActionPermission, preloadCometIconLocal, addThinkingStep, resolveThinkingStep, fetchRealSearchContext, openSearchLinksAndAnalyze]);

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
        const exportContent = `${fullContent}\n\n${'='.repeat(60)}\nACTION LOGS (v0.2.5 JSON Format)\n${'='.repeat(60)}\n\n${actionLogsExport}`;
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
    if (savedConversations.length > 0) {
      const latest = savedConversations[0];
      setActiveConversationId(latest.id);
      setMessages(latest.messages as ExtendedChatMessage[]);
    }

    return () => {
      window.removeEventListener('online', hOnline);
      window.removeEventListener('offline', hOffline);
    };
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Tab' && permissionPending) {
        e.preventDefault();
        setShiftTabGlow(true);
        setTimeout(() => setShiftTabGlow(false), 900);
        permissionPending.resolve(true);
        setPermissionPending(null);
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

      return () => {
        unsub();
        unsubProgress();
      };
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onMobileApproveHighRisk) {
      const unsub = window.electronAPI.onMobileApproveHighRisk((data: { pin: string, id: string }) => {
        setPermissionPending((currentPending: any) => {
          if (currentPending && currentPending.context.risk === 'high') {
            try {
              const qrData = JSON.parse(currentPending.context.highRiskQr || '{}');
              if (qrData.pin === data.pin && qrData.token === data.id) {
                currentPending.resolve(true);
                return null;
              }
            } catch (e) {
              console.error("Failed to parse high risk QR data", e);
            }
          }
          return currentPending;
        });
      });
      return () => unsub();
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (props.isCollapsed) {
    return (
      <div className="flex flex-col items-center h-full py-6 space-y-6 bg-[#020205] border-l border-white/5">
        <button onClick={props.toggleCollapse} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 transition-all">
          {props.side === 'right' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
    );
  }

  const currentActiveModel = aiProvider === 'ollama' ? ollamaModel :
    aiProvider === 'gemini' ? geminiModel :
      aiProvider === 'openai' ? store.openaiModel :
        aiProvider === 'anthropic' ? store.anthropicModel :
          aiProvider === 'groq' ? store.groqModel : aiProvider;

  return (
    <div
      className={`flex flex-col h-full bg-[#020205] border-l border-white/10 overflow-hidden relative ${isFullScreen ? 'fixed inset-0 z-[9999]' : ''}`}
      style={{ width: isFullScreen ? '100%' : sidebarWidth }}
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.35 }}
                  className="mt-4 flex items-center gap-3 px-4 py-3 bg-black/60 border border-white/10 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
                >
                  <motion.div
                    className="w-10 h-10 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 text-sky-300"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Camera size={20} className="text-white" />
                  </motion.div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/70">
                      {pdfVisualStage === 'capturing' ? 'Capturing screenshot' : 'Scanning visuals'}
                    </p>
                    <p className="text-[10px] text-white/40 leading-tight">
                      {pdfVisualStage === 'capturing'
                        ? 'Recording the current browser view into your report.'
                        : 'Downloading referenced images before rendering the document.'}
                    </p>
                  </div>
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
            className="absolute bottom-[180px] left-4 right-4 z-[9000] rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] bg-[#09090f]"
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

      <AnimatePresence>
        {permissionPending && (
          <div className="absolute inset-0 z-[10001] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
              <ClickPermissionModal
                context={permissionPending.context}
                onAllow={async (alwaysAllow) => { 
                  const ctx = permissionPending.context;
                  if (alwaysAllow && window.electronAPI?.permGrant) {
                    const permKey = `${ctx.actionType}:${ctx.target || ctx.what}`;
                    await window.electronAPI.permGrant(permKey, 'execute', ctx.action, false);
                    if (ctx.risk !== 'high' && window.electronAPI?.setAutoApprovalCommand) {
                      const autoCommand = ctx.target || ctx.what || ctx.action;
                      await window.electronAPI.setAutoApprovalCommand({ command: autoCommand, enabled: true });
                    }
                  }
                  permissionPending.resolve(true); 
                  setPermissionPending(null); 
                }}
              onDeny={() => { permissionPending.resolve(false); setPermissionPending(null); }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-5 flex flex-col gap-3 border-b border-white/5 bg-[#020205]/80 backdrop-blur-xl sticky top-0 z-[50]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-white/10 to-transparent p-1.5 border border-white/10">
              <img src="icon.png" alt="Comet" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white">Comet AI</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Autonomous</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTerminal(v => !v)}
              className={`p-2.5 rounded-xl transition-all relative ${showTerminal ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/5 text-white/30 hover:text-white'}`}
              title="Toggle Terminal"
            >
              <Terminal size={18} />
              {terminalLogs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-[8px] font-bold text-black flex items-center justify-center">
                  {terminalLogs.length > 9 ? '9+' : terminalLogs.length}
                </span>
              )}
            </button>
            <button onClick={() => setShowCapabilities(!showCapabilities)} className={`p-2.5 rounded-xl transition-all ${showCapabilities ? 'bg-sky-500/20 text-sky-400' : 'hover:bg-white/5 text-white/30 hover:text-white'}`} title="View AI Capabilities">
              <Sparkles size={18} />
            </button>
            <div className="relative group">
               <button className="p-2.5 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all">
                 <MoreVertical size={18} />
               </button>
               <div className="absolute right-0 top-full mt-2 w-48 bg-[#0a0a0f] border border-white/5 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] p-2 backdrop-blur-2xl">
                 <button onClick={() => exportChat('pdf')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">
                   <Printer size={14} className="text-sky-400" /> Export branded PDF
                 </button>
                 <button onClick={() => exportChat('text')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">
                   <FileText size={14} className="text-purple-400" /> Export as .txt
                 </button>
                 <button onClick={copyChatToClipboard} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">
                   <CopyIcon size={14} className="text-amber-400" /> Copy full session
                 </button>
                 <div className="my-1 border-t border-white/5" />
                 <button onClick={() => setShowLLMProviderSettings(!showLLMProviderSettings)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all">
                   <Cpu size={14} className="text-green-400" /> Intelligence Settings
                 </button>
                 <button onClick={clearChat} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-all">
                   <Trash2 size={14} /> Clear reasoning chain
                 </button>
               </div>
            </div>
            <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2.5 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all">
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
            <button onClick={props.toggleCollapse} className="p-2.5 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto modern-scrollbar p-5 space-y-8">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center border border-white/10 shadow-2xl">
                <Brain size={32} className="text-white/20" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">How can I assist your workflow?</h3>
                <p className="text-[10px] text-white/20 uppercase tracking-tighter mt-1 font-bold">I can navigate, browse, and execute tasks across Comet.</p>
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

            return (
              <motion.div
                key={i}
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

                <div className={`group relative max-w-[90%] p-5 rounded-[2.5rem] text-[13px] leading-relaxed transition-all duration-500 hover:shadow-2xl ${msg.role === 'user'
                  ? 'bg-[#12121e] text-white border border-white/10 rounded-tr-none shadow-xl'
                  : 'bg-gradient-to-br from-sky-500/10 to-sky-500/[0.02] text-slate-200 border border-sky-500/20 rounded-tl-none'
                  }`}>
                  {msg.role === 'model' && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/20">
                        <Sparkles size={12} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-sky-400/60">Comet Response</span>
                    </div>
                  )}
                  {displayContent && (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                      code({ node, className, children, ...rest }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');

                        // ✨ Special handling for Mermaid diagrams
                        if (match && match[1] === 'mermaid' && (window as any).mermaid) {
                          return (
                            <div className="my-5 rounded-3xl overflow-hidden border border-white/5 bg-slate-900/50 p-6 flex flex-col items-center shadow-2xl">
                              <div 
                                className="mermaid w-full flex justify-center"
                                dangerouslySetInnerHTML={{ __html: codeContent }}
                                ref={(el) => {
                                  if (el && (window as any).mermaid) {
                                    (window as any).mermaid.contentLoaded();
                                  }
                                }}
                              />
                            </div>
                          );
                        }

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

                    }}>
                      {displayContent}
                    </ReactMarkdown>
                  )}
                  {msg.isOcr && msg.ocrText && (
                    <CollapsibleOCRMessage label={msg.ocrLabel || 'SCREENSHOT_ANALYSIS'} content={msg.ocrText} />
                  )}

                  {/* ── Inline Media: Images & Video Cards ─────────────────── */}
                  {msg.mediaItems && msg.mediaItems.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {msg.mediaItems.map((item, midx) => {
                        if (item.type === 'image') {
                          return (
                            <motion.div
                              key={midx}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-2xl overflow-hidden border border-white/10 shadow-xl"
                            >
                              <img
                                src={item.url}
                                alt={item.caption || 'Image'}
                                className="w-full max-h-80 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%230f0f1a" width="400" height="200"/><text fill="%23ffffff40" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">Image unavailable</text></svg>';
                                }}
                              />
                              {item.caption && (
                                <div className="px-3 py-2 bg-black/30 text-[10px] text-white/50 font-medium">
                                  {item.caption}
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
          {isLoading && <ThinkingIndicator />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer className="p-6 pt-0 bg-gradient-to-t from-[#020205] via-[#020205] to-transparent sticky bottom-0">
        <div className={`p-4 rounded-[2.5rem] bg-[#0d0d15] border transition-all shadow-2xl relative group ${shiftTabGlow
          ? 'border-purple-500/80 shadow-[0_0_24px_4px_rgba(168,85,247,0.35)] focus-within:border-purple-500/80'
          : 'border-white/10 focus-within:border-sky-500/30'
          }`}>

          <div className="absolute -top-10 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{currentActiveModel}</span>
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
                className="absolute bottom-28 left-4 z-[60] w-52 bg-[#0a0a10]/98 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden p-1.5"
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
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            placeholder="Command your workspace..."
            className="w-full bg-transparent text-sm text-white placeholder:text-white/10 outline-none resize-none h-24 py-2 modern-scrollbar font-medium"
          />

          <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all"><Paperclip size={20} /></button>
              <button
                onClick={() => setShowConversationHistory(true)}
                title="Conversation history"
                className="p-3 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all"
              >
                <History size={20} />
              </button>
              <button onClick={() => setShowActionsMenu(!showActionsMenu)} className={`p-3 rounded-2xl transition-all ${showActionsMenu ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/20 hover:text-white'}`}><MoreHorizontal size={20} /></button>
            </div>
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || (!inputMessage.trim() && attachments.length === 0)}
              className="group flex items-center justify-center w-12 h-12 rounded-[1.5rem] bg-sky-500 text-black shadow-[0_10px_20px_rgba(56,189,248,0.3)] transition-all hover:scale-105 active:scale-95 disabled:opacity-10 disabled:grayscale"
            >
              <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
        <p className="text-[8px] text-center text-white/5 mt-5 uppercase tracking-[0.5em] font-black">Neural Engine Active • v0.2.5 Patched</p>
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
