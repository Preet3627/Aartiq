/// <reference path="../types/electron.d.ts" />
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BrowserAI } from '@/lib/BrowserAI';
import { AnimatePresence, motion } from 'framer-motion';
import { detectSchedulingIntent, type SchedulingIntent } from '@/components/ai/SchedulingIntentDetector';
import {
  ShoppingBag, FileText, Globe, Plus, Bookmark, ChevronLeft, ChevronRight,
  RotateCw, AlertTriangle, ShieldCheck, DownloadCloud, ShoppingCart, Copy as CopyIcon,
  Terminal, Settings as GhostSettings, FolderOpen, Sparkles, ScanLine, Search, X,
  Puzzle, Code2, Briefcase, Image as ImageIcon, User as UserIcon, Maximize2, Minimize2, RefreshCcw, Download as DownloadIcon,
  Layout, MoreVertical, MoreHorizontal, CreditCard, ArrowRight, Languages, Share2, Lock, Shield, Volume2, Square, Music2, Waves, Presentation, Package,
  Zap, Check, Paperclip, MousePointer2
} from 'lucide-react';
import AIChatSidebar from '@/components/AIChatSidebar';
import LandingPage from '@/components/LandingPage';
import { StartupSetupUI } from '@/components/StartupSetupUI';
import WebStore from '@/components/WebStore';
import PDFWorkspace from '@/components/PDFWorkspace';
import CodingDashboard from '@/components/CodingDashboard';
import ClipboardManager from '@/components/ClipboardManager';
import PhoneCamera from '@/components/PhoneCamera';
import { GoogleAuthProvider } from 'firebase/auth';
import SettingsPanel from '@/components/SettingsPanel';
import { searchEngines } from '@/components/SearchEngineSettings';
import UnifiedCartPanel from '@/components/UnifiedCartPanel';
import WorkspaceDashboard from '@/components/WorkspaceDashboard';
import MediaStudio from '@/components/MediaStudio';
import Documentation from '@/components/Documentation';
import PresentonStudio from '@/components/PresentonStudio';
import PasswordManager from '@/components/PasswordManager';
import ProxyFirewallManager from '@/components/ProxyFirewallManager';
import P2PSyncManager from '@/components/P2PSyncManager';
import WelcomeScreen from '@/components/WelcomeScreen';
import SpotlightSearchOverlay from '@/components/SpotlightSearchOverlay';
import SchedulingModal from '@/components/ai/SchedulingModal';
import DownloadsPanel, { type DownloadItem } from '@/components/DownloadsPanel';
import ExtensionManager from '@/components/ExtensionManager';

import CloudSyncConsent from "@/components/CloudSyncConsent";
import NoNetworkGame from "@/components/DinoGame";
import AIAssistOverlay from "@/components/AIAssistOverlay";

import { firebaseSyncService } from "@/lib/FirebaseSyncService";
import firebaseService from '@/lib/FirebaseService';
import { firebaseConfigStorage } from '@/lib/firebaseConfigStorage';
import { QuickNavOverlay } from '@/components/QuickNavOverlay';
import TitleBar from '@/components/TitleBar';
import { useOptimizedTabs } from '@/hooks/useOptimizedTabs';
import { VirtualizedTabBar } from '@/components/VirtualizedTabBar';
import { TabSwitcherOverlay } from '@/components/TabSwitcherOverlay';

type AiOverviewSource = { text: string; metadata: any };
interface AiOverviewState {
  query: string;
  result: string | null;
  sources: AiOverviewSource[] | null;
  isLoading: boolean;
  provider: string;
  model: string;
  statusMessage?: string;
  durationMs?: number;
  error?: string;
}
import { fetchAiOverview } from '@/lib/aiManager';
import type { AiOverviewResponse } from '@/lib/aiManager';
import { getRecommendedGeminiModel } from '@/lib/modelRegistry';

function normalizeOverviewQuery(rawQuery: string) {
  return rawQuery.trim().replace(/\s+/g, ' ').toLowerCase();
}

const SidebarIcon = ({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) => (
  <button
    onClick={onClick}
    className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${active ? 'bg-accent text-white shadow-[0_0_25px_rgba(56,189,248,0.4)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
  >
    {icon}
    {collapsed && (
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-primary-bg border border-border-color rounded-lg text-[10px] font-black uppercase tracking-widest text-primary-text opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-[100] shadow-2xl">
        {label}
      </div>
    )}
    {!collapsed && (
      <span className="absolute left-full ml-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {label}
      </span>
    )}
  </button>
);

const MusicVisualizer = ({ color = 'rgb', isPlaying = false }: { color?: string, isPlaying: boolean }) => {
  if (!isPlaying) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 'auto', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="flex items-center gap-1.5 px-2 py-1 bg-deep-space-accent-neon/5 backdrop-blur-sm rounded-lg border border-deep-space-accent-neon/20 h-7 group hover:bg-deep-space-accent-neon/10 transition-all duration-300 cursor-pointer"
      title="Audio playing"
    >
      <div className="flex gap-[2px] items-center h-3.5">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              height: [3, 12, 5, 10, 3],
              backgroundColor: color === 'rgb'
                ? ['#38bdf8', '#818cf8', '#38bdf8']
                : [color, color, color]
            }}
            transition={{
              duration: 0.5 + Math.random() * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1,
            }}
            className="w-[2px] rounded-full"
          />
        ))}
      </div>
      <Music2 size={12} className="text-deep-space-accent-neon/60" />
    </motion.div>
  );
};

export default function Home() {
  const store = useAppStore();
  const { shouldRenderTab, isTabSuspended } = useOptimizedTabs();
  const [showClipboard, setShowClipboard] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState('profile');

  // Helper to open settings and disable browser
  const openSettingsPanel = (section: string = 'profile') => {
    setSettingsSection(section);
    setShowSettings(true);
    setIsBrowserDisabled(true);
  };

  const [showCart, setShowCart] = useState(false);
  const [urlPrediction, setUrlPrediction] = useState<string | null>(null); // Changed to string | null
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]); // New state for additional suggestions
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, visible: boolean } | null>(null);
  const [aiOverview, setAiOverview] = useState<AiOverviewState | null>(null);
  const lastAutoAiOverviewQueryRef = useRef<string>('');
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [railVisible, setRailVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<{ x: number, y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [aiPickColor, setAiPickColor] = useState('rgb'); // 'rgb' or a hex string
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'in_progress' | 'completed' | 'failed'>('idle');
  const [showDownloads, setShowDownloads] = useState(false);
  const [showExtensionsPopup, setShowExtensionsPopup] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeManager, setActiveManager] = useState<string | null>(null);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);

  // Helper to close translate dialog and re-enable browser
  const closeTranslateDialog = () => {
    setShowTranslateDialog(false);
    setIsBrowserDisabled(false);
    window.electronAPI?.showAllViews();
  };

  // Helper to open translate dialog
  const openTranslateDialog = () => {
    setShowTranslateDialog(true);
    setIsBrowserDisabled(true);
    window.electronAPI?.hideAllViews();
  };

  const [translateMethod, setTranslateMethod] = useState<'google' | 'chrome-ai'>('google');
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(false);
  const [inputValue, setInputValue] = useState(store.currentUrl); // New state for input field's raw value
  const [showSpotlightSearch, setShowSpotlightSearch] = useState(false); // New state for global spotlight search
  const [activeExtensions, setActiveExtensions] = useState<any[]>([]);
  const [isBrowserDisabled, setIsBrowserDisabled] = useState(false);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [schedulingIntent, setSchedulingIntent] = useState<SchedulingIntent | null>(null);
  const panelQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('panel') : null;
  const isPopupWindow = Boolean(panelQuery);
  const clientId = store.clientId;
  const hasSeenWelcomePage = store.hasSeenWelcomePage;
  const currentUser = store.user;

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
    setSettingsSection('profile');
    setIsBrowserDisabled(false);
  }, []);

  // Synchronize inputValue with store.currentUrl
  useEffect(() => {
    setInputValue(store.currentUrl);
  }, [store.currentUrl]);

  // Mirror tabs/history state for Raycast integration
  useEffect(() => {
    if (window.electronAPI?.updateRaycastState) {
      const tabsSnapshot = store.tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: tab.id === store.activeTabId,
        isLoading: tab.isLoading || false,
      }));
      const historySnapshot = store.history.slice(-50).reverse().map(entry => ({
        title: entry.title,
        url: entry.url,
        timestamp: entry.timestamp,
      }));
      window.electronAPI.updateRaycastState({
        tabs: tabsSnapshot,
        history: historySnapshot,
      });
    }
  }, [store.tabs, store.activeTabId, store.history]);

  // Sidebar items configuration
  const sidebarItems = [
    { icon: <Globe size={20} />, label: 'Browser', view: 'browser' },
    { icon: <Briefcase size={20} />, label: 'Workspace', view: 'workspace' },
    { icon: <ShoppingBag size={20} />, label: 'Web Store', view: 'webstore' },
    { icon: <FileText size={20} />, label: 'PDF Tools', view: 'pdf' },
    { icon: <Code2 size={20} />, label: 'Coding', view: 'coding' },
    { icon: <ImageIcon size={20} />, label: 'Media Studio', view: 'media' },
    { icon: <Presentation size={20} />, label: 'Presenton', view: 'presenton' },
    { icon: <Lock size={20} />, label: 'Passwords', manager: 'password' },
    { icon: <Shield size={20} />, label: 'Firewall', manager: 'firewall' },
    { icon: <Share2 size={20} />, label: 'P2P Sync', manager: 'p2p' },
    // Redundant items integrated into header or settings
  ];

  // Handle sidebar item clicks - now mostly using local panels
  const handleSidebarClick = (item: any) => {
    if (item.view) {
      store.setActiveView(item.view);
      setActiveManager(null);
      setShowClipboard(false);
      setShowSettings(false);
    } else if (item.manager) {
      setActiveManager(item.manager);
      store.setActiveView('browser');
      setShowClipboard(false);
      setShowSettings(false);
    } else if (item.popup) {
      switch (item.popup) {
        case 'plugins': setShowExtensionsPopup(true); break;
        case 'settings': openSettingsPanel(); break;
        case 'clipboard': setShowClipboard(true); break;
        case 'translate': openTranslateDialog(); break;
        case 'search': setShowSpotlightSearch(true); break;
        case 'downloads': setShowDownloads(true); break;
        case 'cart': setShowCart(true); break;
      }
    }
  };

  useEffect(() => {
    const settingsPanels = ['settings', 'profile', 'history', 'performance', 'sync', 'account'];
    if (panelQuery && settingsPanels.includes(panelQuery)) {
      setSettingsSection(panelQuery === 'settings' ? 'profile' : panelQuery);
    }
  }, [panelQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || panelQuery !== 'ai-overview') return;

    let active = true;
    window.electronAPI.getAiOverviewData?.().then((data) => {
      if (active && data) {
        setAiOverview(data);
      }
    });

    const cleanup = window.electronAPI.on('ai-overview-data', (data: AiOverviewState | null) => {
      if (active) {
        setAiOverview(data);
      }
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [panelQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || panelQuery !== 'downloads') return;

    let active = true;
    window.electronAPI.getDownloadPanelData?.().then((data) => {
      if (active && Array.isArray(data)) {
        setDownloads(data);
      }
    });

    const cleanup = window.electronAPI.on('download-panel-data', (data: DownloadItem[]) => {
      if (active && Array.isArray(data)) {
        setDownloads(data);
      }
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [panelQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || isPopupWindow) return;

    const cleanupOverview = window.electronAPI.on('ai-overview-closed', () => {
      if (aiOverview?.query) {
        lastAutoAiOverviewQueryRef.current = normalizeOverviewQuery(aiOverview.query);
      }
      setAiOverview(null);
    });

    const cleanupPopupClosed = window.electronAPI.on('popup-closed', (type: string) => {
      if (type === 'downloads') setShowDownloads(false);
      if (type === 'clipboard') setShowClipboard(false);
      if (type === 'search' || type === 'search-apps') setShowSpotlightSearch(false);
      if (type === 'extensions' || type === 'plugins') setShowExtensionsPopup(false);
      if (type === 'unified-cart' || type === 'cart') setShowCart(false);
    });

    return () => {
      cleanupOverview?.();
      cleanupPopupClosed?.();
    };
  }, [aiOverview?.query, isPopupWindow, normalizeOverviewQuery]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanStart = window.electronAPI.on('download-started', ({ name, path }: { name: string, path?: string }) => {
      setDownloads(prev => {
        if (prev.some(d => d.name === name)) return prev;
        return [{ name, status: 'downloading', progress: 0, path }, ...prev].slice(0, 5);
      });
      setIsDownloading(true);
      setDownloadStatus('in_progress');
      setShowDownloads(true);
    });

    const cleanProgress = window.electronAPI.on('download-progress', ({ name, progress }: { name: string, progress: number }) => {
      setDownloads(prev => prev.map(d => d.name === name ? { ...d, progress } : d));
    });

    const cleanDone = window.electronAPI.on('download-complete', ({ name, path }: { name: string, path?: string }) => {
      setDownloads(prev => prev.map(d => d.name === name ? { ...d, status: 'completed', progress: 100, path } : d));
      setIsDownloading(false);
      setDownloadStatus('completed');
    });

    const cleanFail = window.electronAPI.on('download-failed', (name: string) => {
      setDownloads(prev => prev.map(d => d.name === name ? { ...d, status: 'failed' } : d));
      setIsDownloading(false);
      setDownloadStatus('failed');
    });

    return () => {
      cleanStart();
      cleanProgress();
      cleanDone();
      cleanFail();
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      const cleanExtInstalled = window.electronAPI.on('extension-installed', ({ name, id }: { name: string, id: string }) => {
        const providerId = store.aiProvider || 'ollama';
        const modelName = resolveProviderModel(providerId);
        setAiOverview({ query: `Extension Installed: ${name}`, result: `Successfully installed extension ${name}. You can manage it in settings.`, sources: null, isLoading: false, provider: providerId, model: modelName });
      });

      const cleanTheme = window.electronAPI.on('apply-theme', (theme: any) => {
        if (theme && theme.colors) {
          const colors = theme.colors;
          const root = document.documentElement;
          // Map Chrome theme colors to our CSS variables
          if (colors.frame) root.style.setProperty('--primary-bg', `rgb(${colors.frame.join(',')})`);
          if (colors.toolbar) root.style.setProperty('--navbar-bg', `rgb(${colors.toolbar.join(',')})`);
          if (colors.tab_text) root.style.setProperty('--primary-text', `rgb(${colors.tab_text.join(',')})`);
          // Add more mappings as needed
          const providerId = store.aiProvider || 'ollama';
          const modelName = resolveProviderModel(providerId);
          setAiOverview({ query: `Theme Applied`, result: `Successfully applied Chrome theme.`, sources: null, isLoading: false, provider: providerId, model: modelName });
        }
      });

      const cleanTranslation = window.electronAPI.on('trigger-translation-dialog', () => {
        setShowTranslateDialog(true);
        window.electronAPI?.bringWindowToTop();
      });

      return () => {
        cleanExtInstalled();
        cleanTheme();
        cleanTranslation();
      };
    }
  }, []);

  const toggleFullscreen = () => {
    window.electronAPI?.toggleFullscreen();
  };

  const handleReadAloud = async () => {
    if (isReadingAloud) {
      window.speechSynthesis.cancel();
      setIsReadingAloud(false);
      return;
    }

    if (window.electronAPI) {
      let text = await window.electronAPI.getSelectedText();

      if (!text || text.trim().length === 0) {
        // Fallback to full page content if no selection
        const pageContent = await window.electronAPI.extractPageContent();
        if (pageContent && pageContent.content) {
          text = pageContent.content.substring(0, 5000); // Limit to reasonable length
        }
      }

      const pageText = text || "No readable content found on this page.";

      const utterance = new SpeechSynthesisUtterance(pageText);
      const voices = window.speechSynthesis.getVoices();

      // Language code to Name mapping for better matching
      const langMap: Record<string, string> = {
        'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu', 'bn': 'Bengali', 'ml': 'Malayalam', 'kn': 'Kannada'
      };

      const targetLang = store.selectedLanguage;
      const voice = voices.find(v => v.lang.startsWith(targetLang) || (langMap[targetLang] && v.name.includes(langMap[targetLang]))) || voices[0];

      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onend = () => setIsReadingAloud(false);
      utterance.onerror = () => setIsReadingAloud(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsReadingAloud(true);
    }
  };

  const handleMusicUpload = async () => {
    if (window.electronAPI) {
      const filePath = await window.electronAPI.selectLocalFile({
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile', 'openDirectory']
      });
      if (filePath) {
        store.setAmbientMusicUrl(`media://${filePath}`);
      }
    }
  };

  const handlePopSearch = async () => {
    if (window.electronAPI) {
      const selectedText = await window.electronAPI.getSelectedText();
      await window.electronAPI.popSearchShowAtCursor(selectedText || '');
    }
  };

  // Ambient Music Control
  useEffect(() => {
    const shouldPlay = () => {
      if (!store.enableAmbientMusic) return false;
      switch (store.ambientMusicMode) {
        case 'always':
          return true;
        case 'google':
          return store.currentUrl.includes('google.com/search');
        case 'idle':
          // TODO: Implement idle detection
          return false;
        case 'off':
        default:
          return false;
      }
    };

    if (shouldPlay()) {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.play().catch(e => console.log("Autoplay blocked", e));
        setIsAmbientPlaying(true);
      }
    } else {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        setIsAmbientPlaying(false);
      }
    }
  }, [store.currentUrl, store.enableAmbientMusic, store.ambientMusicMode]);

  // Ambient Music Volume Control
  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = store.ambientMusicVolume;
    }
  }, [store.ambientMusicVolume]);

  // Translation Trigger
  useEffect(() => {
    if (window.electronAPI) {
      const clean = window.electronAPI.onTriggerTranslationDialog(() => {
        setShowTranslateDialog(true);
        window.electronAPI?.bringWindowToTop();
      });
      return clean;
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleWindowLayoutChange = (payload?: { isFullScreen?: boolean }) => {
      setIsFullscreen(Boolean(payload?.isFullScreen));
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    const cleanup = window.electronAPI.on('window-layout-changed', handleWindowLayoutChange);
    return () => cleanup?.();
  }, []);

  const rightClickTimerRef = useRef<any>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) { // Right click
      rightClickTimerRef.current = setTimeout(() => {
        handlePopSearch();
      }, 500); // 500ms hold
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (rightClickTimerRef.current) {
      clearTimeout(rightClickTimerRef.current);
      rightClickTimerRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const menuWidth = 192;
    const menuHeight = 250;
    const padding = 16;
    let x = e.clientX;
    let y = e.clientY;
    if (e.clientX + menuWidth + padding > window.innerWidth) x = window.innerWidth - menuWidth - padding;
    if (e.clientY + menuHeight + padding > window.innerHeight) y = window.innerHeight - menuHeight - padding;
    setShowContextMenu({ x, y });
  };

  const handleTranslate = async () => {
    setShowContextMenu(null);
    if (window.electronAPI) {
      const selectedText = await window.electronAPI.getSelectedText();
      const textToTranslate = selectedText || store.currentUrl;
      const targetLang = store.selectedLanguage || 'English';

      const providerId = store.aiProvider || 'ollama';
      const modelName = resolveProviderModel(providerId);

      setAiOverview({ query: `Translating: ${textToTranslate.substring(0, 30)}...`, result: null, sources: null, isLoading: true, provider: providerId, model: modelName });

      const translated = await BrowserAI.translateText(textToTranslate, targetLang);
      setAiOverview({ query: `Neural Translation (to ${targetLang})`, result: translated, sources: null, isLoading: false, provider: providerId, model: modelName });
    }
  };

  const isBookmarked = store.bookmarks.some(b => b.url === store.currentUrl);

  const handleBookmark = () => {
    const activeTab = store.tabs.find(t => t.id === store.activeTabId);
    if (activeTab) {
      if (isBookmarked) {
        store.removeBookmark(activeTab.url);
      } else {
        store.addBookmark({ url: activeTab.url, title: activeTab.title || activeTab.url });
      }
    }
  };

  // Tab Switching logic (Alt + Tab and Alt + Scroll)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        setShowTabSwitcher(true);
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          window.electronAPI?.changeZoom(-1);
        } else if (e.key === '-') {
          e.preventDefault();
          window.electronAPI?.changeZoom(1);
        } else if (e.key === '0') {
          e.preventDefault();
          window.electronAPI?.resetZoom();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setShowTabSwitcher(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (window.electronAPI) {
          window.electronAPI.changeZoom(e.deltaY);
        }
      } else if (e.altKey) {
        e.preventDefault();
        if (e.deltaY > 0) store.nextTab();
        else store.prevTab();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [store]);

  const resolveProviderModel = useCallback((providerId: string) => {
    switch (providerId) {
      case 'google-flash':
        return getRecommendedGeminiModel('google-flash');
      case 'google':
        return store.geminiModel || getRecommendedGeminiModel('google');
      case 'openai':
        return store.openaiModel || 'gpt-4o';
      case 'anthropic':
        return store.anthropicModel || 'claude-3-5-sonnet-latest';
      case 'xai':
        return store.xaiModel || 'grok-2-latest';
      case 'groq':
        return store.groqModel || 'llama-3.3-70b-versatile';
      case 'ollama':
        return store.ollamaModel;
      default:
        return providerId;
    }
  }, [
    store.anthropicModel,
    store.geminiModel,
    store.groqModel,
    store.openaiModel,
    store.xaiModel,
    store.ollamaModel,
  ]);

  const runAiOverview = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query || !store.enableAiOverview) return null;
    const providerId = store.aiProvider || 'ollama';
    const modelName = resolveProviderModel(providerId);

    setAiOverview({
      query,
      result: null,
      sources: null,
      isLoading: true,
      provider: providerId,
      model: modelName,
      statusMessage: 'Gathering context…',
    });

    const contextItems = await BrowserAI.retrieveContext(query);
    setAiOverview(prev => prev ? { ...prev, statusMessage: `${contextItems.length} context items ready` } : prev);

    const contextString = contextItems.map((c) => c.text).join('\n\n');
    const prompt = `Synthesize a comprehensive, Perplexity-style answer for: "${query}". 
    Include:
    1. A clear direct answer (2 paragraphs max).
    2. 3 deep insights.
    3. Contextual relevance to the user's local data.
    Format with HTML bolding and clear sections.`;

    const startTime = Date.now();
    let response: AiOverviewResponse;
    try {
      response = await fetchAiOverview({
        query: prompt,
        context: contextString,
        provider: providerId,
        model: modelName,
        baseUrl: store.ollamaBaseUrl,
        localLlmMode: store.localLlmMode,
        extraInstructions: 'Use HTML bolding for highlights and number the insights.',
      });
    } catch (error: any) {
      const message = error?.message || 'Overview failed';
      setAiOverview({
        query,
        result: null,
        sources: contextItems,
        isLoading: false,
        provider: providerId,
        model: modelName,
        statusMessage: message,
        durationMs: Date.now() - startTime,
        error: message,
      });
      return { error: message, provider: providerId, model: modelName, durationMs: Date.now() - startTime };
    }

    const statusMsg = response.error
      ? `Error: ${response.error}`
      : `Delivered in ${response.durationMs ?? (Date.now() - startTime)}ms | ${contextItems.length} contexts`;

    setAiOverview({
      query,
      result: response.text || response.error || null,
      sources: contextItems,
      isLoading: false,
      provider: providerId,
      model: modelName,
      statusMessage: statusMsg,
      durationMs: response.durationMs,
      error: response.error,
    });

    return response;
  }, [
    resolveProviderModel,
    store.enableAiOverview,
    store.aiProvider,
    store.localLlmMode,
  ]);

  const runAutoAiOverviewIfNew = useCallback((rawQuery: string) => {
    const normalizedQuery = normalizeOverviewQuery(rawQuery);
    if (!normalizedQuery || !store.enableAiOverview) return;
    if (normalizedQuery === lastAutoAiOverviewQueryRef.current) return;
    lastAutoAiOverviewQueryRef.current = normalizedQuery;
    runAiOverview(rawQuery);
  }, [runAiOverview, store.enableAiOverview]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || isPopupWindow) return;

    const isBrowserOverlayMode = store.activeView === 'browser';
    if (!isBrowserOverlayMode) {
      window.electronAPI.closePopupWindow('ai-overview');
      return;
    }

    if (aiOverview) {
      window.electronAPI.openPopupWindow('ai-overview', {
        width: 500,
        height: 720,
        x: Math.max(40, window.screenX + window.innerWidth - 540),
        y: Math.max(80, window.screenY + 88),
        frame: false,
        transparent: true,
        resizable: true,
        closeOnBlur: true,
      });
      window.electronAPI.sendAiOverviewData(aiOverview);
    } else {
      window.electronAPI.closePopupWindow('ai-overview');
    }
  }, [aiOverview, isPopupWindow, store.activeView]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || isPopupWindow) return;

    if (store.activeView !== 'browser') {
      window.electronAPI.closePopupWindow('downloads');
      return;
    }

    if (showDownloads) {
      window.electronAPI.openPopupWindow('downloads', {
        width: 408,
        height: 588,
        x: Math.max(40, window.screenX + window.innerWidth - 436),
        y: Math.max(80, window.screenY + 92),
        frame: false,
        transparent: true,
        resizable: true,
        closeOnBlur: true,
      });
      window.electronAPI.sendDownloadPanelData(downloads);
    } else {
      window.electronAPI.closePopupWindow('downloads');
    }
  }, [downloads, isPopupWindow, showDownloads, store.activeView]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI || isPopupWindow) return;

    if (store.activeView !== 'browser') {
      ['clipboard', 'search', 'unified-cart', 'extensions'].forEach((type) => window.electronAPI.closePopupWindow(type));
      return;
    }

    if (showClipboard) {
      window.electronAPI.openPopupWindow('clipboard', {
        width: 470,
        height: 680,
        x: Math.max(40, window.screenX + window.innerWidth - 500),
        y: Math.max(80, window.screenY + 92),
        frame: false,
        transparent: true,
        resizable: true,
        closeOnBlur: true,
      });
    } else {
      window.electronAPI.closePopupWindow('clipboard');
    }

    if (showSpotlightSearch) {
      window.electronAPI.openPopupWindow('search', {
        width: 900,
        height: 520,
        frame: false,
        transparent: true,
        resizable: false,
        x: Math.max(40, window.screenX + Math.round((window.innerWidth - 900) / 2)),
        y: Math.max(80, window.screenY + 96),
        closeOnBlur: true,
      });
    } else {
      window.electronAPI.closePopupWindow('search');
    }

    if (showCart) {
      window.electronAPI.openPopupWindow('unified-cart', {
        width: 600,
        height: 540,
        frame: false,
        transparent: true,
        resizable: true,
        x: Math.max(40, window.screenX + window.innerWidth - 640),
        y: Math.max(80, window.screenY + 92),
        closeOnBlur: true,
      });
    } else {
      window.electronAPI.closePopupWindow('unified-cart');
    }

    if (showExtensionsPopup) {
      window.electronAPI.openPopupWindow('extensions', {
        width: 1120,
        height: 820,
        frame: false,
        transparent: true,
        x: Math.max(40, window.screenX + Math.round((window.innerWidth - 1120) / 2)),
        y: Math.max(70, window.screenY + 60),
        closeOnBlur: true,
      });
    } else {
      window.electronAPI.closePopupWindow('extensions');
    }
  }, [isPopupWindow, showCart, showClipboard, showExtensionsPopup, showSpotlightSearch, store.activeView]);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (store.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(store.theme);
    }
  }, [store.theme]);

  // Init Browser Intelligence
  useEffect(() => {
    BrowserAI.initURLPredictor();
    BrowserAI.loadVectorMemory();
  }, []);

  // AI Query Interception
  useEffect(() => {
    if (window.electronAPI && store.enableAiOverview) {
      const cleanup = window.electronAPI.onAiQueryDetected((query: any) => {
        runAutoAiOverviewIfNew(String(query || ''));
      });
      return cleanup;
    }
  }, [store.enableAiOverview, runAutoAiOverviewIfNew]);

  // Automatic Sidebar & AI Scaling
  useEffect(() => {
    const handleSmartScaling = () => {
      const width = window.innerWidth;
      if (width < 1200) {
        if (store.sidebarWidth > 350) store.setSidebarWidth(350);
      } else if (width > 1800) {
        if (store.sidebarWidth < 500) store.setSidebarWidth(500);
      }
    };

    window.addEventListener('resize', handleSmartScaling);
    handleSmartScaling(); // Initial call
    return () => window.removeEventListener('resize', handleSmartScaling);
  }, [store.sidebarWidth]);

  // PWA Service Worker Registration
  useEffect(() => {
    // Disable SW in development to prevent stale caches with Turbopack chunks
    if (process.env.NODE_ENV === 'development') return;

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('SW registered:', reg);
        }).catch((err) => {
          console.log('SW reg failed:', err);
        });
      });
    }
  }, []);

  // Fetch initial online status and listen for changes
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getIsOnline().then((onlineStatus) => {
        store.setIsOnline(onlineStatus);
        console.log("Initial online status:", onlineStatus);
      });

      // Sync Adblocker state on startup
      if (store.enableAdblocker) {
        window.electronAPI.toggleAdblocker(true);
      }
    }
  }, []);

  const addClipboardItem = useAppStore(state => state.addClipboardItem);

  // Clipboard sync
  useEffect(() => {
    if (window.electronAPI) {
      console.log("[Renderer] Setting up clipboard listener");
      const clean = window.electronAPI.on('clipboard-changed', (text: string) => {
        if (text) {
          console.log("[Renderer] Received clipboard update:", text.substring(0, 20));
          addClipboardItem(text);
        }
      });
      return clean;
    }
  }, [addClipboardItem]);

  // Debounced Predictor and Suggestions Fetcher
  useEffect(() => {
    const timer = setTimeout(async () => {
      const suggestionQuery = extractSuggestionQuery(inputValue);

      if (isTyping && suggestionQuery.length > 1) { // Trigger on 2+ chars
        // Fetch URL prediction
        const preds = /^https?:\/\//i.test(inputValue.trim())
          ? []
          : await BrowserAI.predictUrl(suggestionQuery, store.history.map(h => h.url));
        setUrlPrediction(preds[0] || null);

        // Fetch additional suggestions
        if (window.electronAPI) {
          const webSuggestions = await window.electronAPI.getSuggestions(suggestionQuery);
          const appSearch = await window.electronAPI.searchApplications(suggestionQuery);
          const appSuggestions = appSearch.success ? appSearch.results.map((app: any) => ({
            type: 'app',
            text: app.name,
            url: app.path, // Use URL field for path for simplicity
            icon: <Briefcase size={14} />
          })) : [];

          setSuggestions([...webSuggestions, ...appSuggestions]);
        }
      } else {
        setUrlPrediction(null);
        setSuggestions([]); // Clear suggestions when not typing or input is too short
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [inputValue, isTyping, store.history]); // Depend on inputValue

  const inputRef = useRef<HTMLInputElement>(null); // New ref for the input element

  // Active Time Tracker
  useEffect(() => {
    if (store.user && store.activeStartTime) {
      const interval = setInterval(() => {
        store.updateActiveTime();
      }, 30000); // Pulse every 30 seconds

      return () => clearInterval(interval);
    }
  }, [store.user, store.activeStartTime]);

  useEffect(() => {
    if (store.cloudSyncConsent) {
      console.log("Cloud sync consented. Initializing sync...");
      firebaseSyncService.syncClipboard();
      firebaseSyncService.syncHistory();
      firebaseSyncService.syncApiKeys();
    }
  }, [store.cloudSyncConsent]);

  // Audio Playback Listener
  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onAudioStatusChanged((isPlaying) => {
        setIsAudioPlaying(isPlaying);

        // "AI" Color Picker - select a premium color when audio starts
        if (isPlaying) {
          const premiumColors = ['rgb', '#00E5FF', '#FF00E5', '#7000FF', '#00FF94', '#FFD600'];
          const randomColor = premiumColors[Math.floor(Math.random() * premiumColors.length)];
          setAiPickColor(randomColor);
        }
      });
      return cleanup;
    }
  }, []);

  // Download Status Listener
  useEffect(() => {
    if (window.electronAPI) {
      const cleanupStarted = window.electronAPI.onDownloadStarted((filename: string) => {
        console.log(`Download started: ${filename}`);
        setDownloadStatus('in_progress');
        setIsDownloading(true);
      });

      const cleanupComplete = window.electronAPI.on('download-complete', (filename: string) => {
        console.log(`Download completed: ${filename}`);
        setDownloadStatus('completed');
        setIsDownloading(false);
        setTimeout(() => setDownloadStatus('idle'), 3000); // Reset status after 3 seconds
      });

      const cleanupFailed = window.electronAPI.on('download-failed', (filename: string) => {
        console.error(`Download failed: ${filename}`);
        setDownloadStatus('failed');
        setIsDownloading(false);
        setTimeout(() => setDownloadStatus('idle'), 3000); // Reset status after 3 seconds
      });

      return () => {
        cleanupStarted();
        cleanupComplete();
        cleanupFailed();
      };
    }
  }, []);

  // Handle Global Shortcuts from Main Process
  useEffect(() => {
    if (window.electronAPI) {
      const cleanupShortcuts = window.electronAPI.onShortcut((action: string) => {
        switch (action) {
          case 'new-tab': store.addTab(); break;
          case 'close-tab': store.removeTab(store.activeTabId); break;
          case 'next-tab': store.nextTab(); break;
          case 'prev-tab': store.prevTab(); break;
          case 'toggle-sidebar': store.toggleSidebar(); break;
          case 'open-settings': setShowSettings(true); break;
          case 'new-incognito-tab': store.addIncognitoTab(); break;
          case 'toggle-spotlight': setShowSpotlightSearch(prev => !prev); break;
          case 'zoom-in': window.electronAPI?.changeZoom(-1); break;
          case 'zoom-out': window.electronAPI?.changeZoom(1); break;
          case 'zoom-reset': window.electronAPI?.resetZoom(); break;
        }
      });

      // Handle settings section changes from main process
      const cleanupSettings = window.electronAPI.on('set-settings-section', (section: string) => {
        setSettingsSection(section);
        setShowSettings(true);
      });

      return () => {
        cleanupShortcuts();
        cleanupSettings();
      };
    }
  }, [store.addTab, store.removeTab, store.activeTabId, store.nextTab, store.prevTab, store.toggleSidebar]);

  // Fetch extensions when popup is opened
  useEffect(() => {
    if (showExtensionsPopup && window.electronAPI) {
      window.electronAPI.getExtensions().then((exts: any) => {
        setActiveExtensions(exts);
      });
    }
  }, [showExtensionsPopup]);

  // Dynamic Ollama Model Fetch
  useEffect(() => {
    if (window.electronAPI && store.aiProvider === 'ollama') {
      window.electronAPI.ollamaListModels().then((res: any) => {
        if (res.models) {
          store.setOllamaModelsList(res.models);
          console.log('Loaded Ollama models:', res.models);
        } else if (res.error) {
          console.error('Failed to load Ollama models:', res.error);
        }
      });
    }
  }, [store.aiProvider]);

  const handleGo = (urlToNavigate?: string, options?: { newTab?: boolean; active?: boolean }) => { // Accept optional URL and options
    const { newTab = false, active = true } = options || {};
    let url = urlToNavigate || inputValue.trim(); // Use inputValue if no specific URL provided
    if (!url) return;

    if (url.startsWith('>>')) {
      if (window.electronAPI) {
        window.electronAPI.wifiSyncBroadcast({ type: 'agent-task', task: url.substring(2).trim() });
        setInputValue('');
        return;
      } else {
        // Fallback for when electronAPI is not available
        console.warn("Electron API not available for agent task");
        return;
      }
    }

    const isAuthUrl = (testUrl: string) => {
      try {
        const hostname = new URL(testUrl).hostname;
        return hostname.includes('accounts.google.com') || hostname.includes('accounts.youtube.com') || hostname.includes('browser.ponsrischool.in');
      } catch {
        return false;
      }
    };

    if (isAuthUrl(url) && window.electronAPI) {
      window.electronAPI.openAuthWindow(url);
      return;
    }

    // Enhanced Calculator
    const mathChars = /^[0-9+\-*/().\s^%|&!~<>]+$/;
    const mathFuncs = /(Math\.(abs|acos|asin|atan|atan2|ceil|cos|exp|floor|log|max|min|pow|random|round|sin|sqrt|tan|PI|E))/g;
    if (mathChars.test(url) || mathFuncs.test(url)) {
      try {
        // Safe evaluation context
        const result = new Function(`return ${url.replace(/\^/g, '**')}`)();
        if (typeof result === 'number' && !isNaN(result)) {
          const searchUrl = `${searchEngines[store.selectedEngine as keyof typeof searchEngines].url}${encodeURIComponent(url + " = " + result)}`;
          if (window.electronAPI) {
            window.electronAPI.navigateBrowserView({ tabId: store.activeTabId, url: searchUrl });
          }
          return;
        }
      } catch (e) { }
    }

    if (url.startsWith('/')) {
      // ... command logic
    }

    if (url.includes('.') && !url.includes(' ') && !url.startsWith('http')) {
      url = `https://${url}`;
    } else if (!url.startsWith('http')) {
      const aiQuery = url.trim();
      url = `${searchEngines[store.selectedEngine as keyof typeof searchEngines].url}${encodeURIComponent(url)}`;
      if (store.enableAiOverview && aiQuery) runAutoAiOverviewIfNew(aiQuery);
    }

    if (newTab) {
      store.addTab(url);
    } else {
      store.setCurrentUrl(url); // Ensure global state is updated
      if (window.electronAPI) {
        window.electronAPI.navigateBrowserView({ tabId: store.activeTabId, url });
      }
    }
  };

  // New function to handle suggestion clicks
  const handleSuggestionClick = (suggestion: any) => {
    if (suggestion.type === 'app') {
      if (window.electronAPI && suggestion.url) {
        window.electronAPI.openExternalApp(suggestion.url);
      }
    } else {
      handleGo(suggestion.url);
    }
    setSuggestions([]); // Clear suggestions after selection
    setIsTyping(false); // Stop typing state
  };

  const formatSuggestionMeta = (suggestion: any) => {
    if (!suggestion?.url) return '';

    if (suggestion.type === 'app') {
      return suggestion.url;
    }

    try {
      const parsed = new URL(suggestion.url);
      const readablePath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
      return `${parsed.hostname}${readablePath}`;
    } catch {
      return suggestion.url;
    }
  };

  const getSuggestionLabel = (type: string) => {
    if (type === 'search') return 'Search';
    if (type === 'history') return 'History';
    if (type === 'bookmark') return 'Bookmark';
    if (type === 'app') return 'App';
    return 'Result';
  };

  const getSuggestionTitle = (suggestion: any) => {
    if (!suggestion) return '';
    if (suggestion.type === 'search') return `Search ${store.selectedEngine.charAt(0).toUpperCase()}${store.selectedEngine.slice(1)}`;
    if (suggestion.type === 'history') return 'Recent Page';
    if (suggestion.type === 'bookmark') return 'Saved Bookmark';
    return suggestion.text;
  };

  const getSuggestionDescription = (suggestion: any) => {
    if (!suggestion) return '';
    if (suggestion.type === 'search') return extractSuggestionQuery(inputValue);
    return formatSuggestionMeta(suggestion);
  };

  const extractSuggestionQuery = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return '';

    try {
      const parsed = new URL(trimmedValue);
      return parsed.searchParams.get('q') || parsed.searchParams.get('query') || trimmedValue;
    } catch {
      return trimmedValue;
    }
  };


  const handleOfflineSave = async () => {
    if (!window.electronAPI) return;
    const html = await window.electronAPI.capturePageHtml();
    const activeTab = store.tabs.find(t => t.id === store.activeTabId);
    if (activeTab) {
      await window.electronAPI.saveOfflinePage({ url: activeTab.url, title: activeTab.title, html });
      store.savePageOffline(activeTab.url, activeTab.title, html);
    }
  };

  const handleCreateShortcut = async () => {
    if (!window.electronAPI) return;
    const activeTab = store.tabs.find(t => t.id === store.activeTabId);
    if (activeTab) {
      const result = await (window.electronAPI as any).createDesktopShortcut({ url: activeTab.url, title: activeTab.title });
      if (result.success) {
        alert(`Shortcut created on Desktop: ${activeTab.title}`);
      } else {
        alert(`Failed to create shortcut: ${result.error}`);
      }
    }
  };

  const handleCartScan = async () => {
    if (!window.electronAPI) return;
    setShowCart(true);
    try {
      const result = await window.electronAPI.executeJavaScript(`
        (function() {
          const items = [];
          const priceRegex = /\\$[0-9,]+(\\.[0-9]{2})?/;
          
          document.querySelectorAll('h1, h2, .product-title, .product-name').forEach(el => {
            const text = el.innerText.trim();
            if (text.length > 5 && text.length < 100) {
              const priceMatch = document.body.innerText.match(priceRegex);
              items.push({
                id: Math.random().toString(36).substr(2, 9),
                item: text,
                site: window.location.hostname,
                price: priceMatch ? priceMatch[0] : '$???'
              });
            }
          });
          return items.slice(0, 5); // Just take the most prominent ones
        })()
      `);
      if (result && result.length > 0) {
        result.forEach((item: any) => store.addToUnifiedCart(item));
      }
    } catch (e) {
      console.error("Cart scan failed:", e);
    }
  };

  const calculateBounds = useCallback(() => {
    if (!store.hasCompletedStartupSetup) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const railWidth = railVisible ? 70 : 0;
    const aiSidebarWidth = !store.sidebarOpen ? 0 : (store.isSidebarCollapsed ? 70 : store.sidebarWidth);
    // Reserve only the exact strip needed for the URL suggestions dropdown instead of hiding the whole page.
    const suggestionPanelHeight = store.activeView === 'browser' && isTyping && suggestions.length > 0
      ? Math.min(suggestions.length, 6) * 40 + 12
      : 0;
    const headerHeight = 40 + 56 + suggestionPanelHeight;

    let x = 0;
    if (store.sidebarSide === 'left') {
      x = railWidth + aiSidebarWidth;
    } else {
      x = railWidth;
    }

    const width = window.innerWidth - railWidth - aiSidebarWidth;
    const height = window.innerHeight - headerHeight;

    return {
      x: Math.round(x),
      y: Math.round(headerHeight),
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height))
    };
  }, [store.sidebarOpen, store.isSidebarCollapsed, store.sidebarWidth, store.sidebarSide, railVisible, store.hasCompletedStartupSetup, store.activeView, isTyping, suggestions.length]);

  const syncBrowserViewBounds = useCallback(() => {
    if (!window.electronAPI || isPopupWindow || store.activeView !== 'browser') return;

    const bounds = calculateBounds();
    window.electronAPI.setBrowserViewBounds(bounds);

    if (store.activeTabId) {
      window.electronAPI.activateView({ tabId: store.activeTabId, bounds });
    }
  }, [calculateBounds, isPopupWindow, store.activeTabId, store.activeView]);

  useEffect(() => {
    if (!window.electronAPI || isPopupWindow) return;

    syncBrowserViewBounds();
    window.addEventListener('resize', syncBrowserViewBounds);
    return () => window.removeEventListener('resize', syncBrowserViewBounds);
  }, [isPopupWindow, syncBrowserViewBounds]);

  // Reliability: when returning from non-browser views, force a quick re-sync so
  // DOM extraction/search IPC always targets a live active BrowserView.
  useEffect(() => {
    if (!window.electronAPI || isPopupWindow) return;
    if (store.activeView !== 'browser' || !store.activeTabId) return;

    window.electronAPI.showAllViews();
    syncBrowserViewBounds();
    const timer = window.setTimeout(() => {
      syncBrowserViewBounds();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isPopupWindow, store.activeTabId, store.activeView, syncBrowserViewBounds]);

  // View Management Effects
  useEffect(() => {
    if (!window.electronAPI || isPopupWindow) return;

    if (window.electronAPI) {
      store.tabs.forEach(tab => {
        window.electronAPI.createView({ tabId: tab.id, url: tab.url });
      });

      if (store.activeTabId) {
        syncBrowserViewBounds();
      }
    }
  }, [isPopupWindow, store.activeTabId, store.tabs, syncBrowserViewBounds]);

  useEffect(() => {
    if (!window.electronAPI || isPopupWindow) return;

    if (window.electronAPI) {
      const usesNativeUtilityPopups = store.activeView === 'browser';
      // Only hide BrowserView for full-screen overlays that completely cover the page
      // Small overlays (context menu, AI overview, etc.) will use z-[9999] to appear on top
      const hasFullScreenOverlay = !store.hasSeenWelcomePage || !store.hasCompletedStartupSetup || showSettings || activeManager !== null || showCamera || (!usesNativeUtilityPopups && showDownloads) || (!usesNativeUtilityPopups && showCart) || (!usesNativeUtilityPopups && showExtensionsPopup) || (!usesNativeUtilityPopups && showClipboard) || (!usesNativeUtilityPopups && showSpotlightSearch) || showTranslateDialog || showSchedulingModal;

      if (hasFullScreenOverlay) {
        window.electronAPI.hideAllViews();
        return;
      }

      // Keep BrowserView visible for browser mode, small overlays will layer on top
      if (store.activeView === 'browser' && store.activeTabId) {
        syncBrowserViewBounds();
      } else {
        window.electronAPI.hideAllViews();
      }
    }
  }, [
    isPopupWindow,
    store.activeTabId,
    store.activeView,
    showSettings,
    activeManager,
    showCamera,
    showDownloads,
    showCart,
    showExtensionsPopup,
    showClipboard,
    showSpotlightSearch,
    isTyping,
    suggestions.length,
    store.hasSeenWelcomePage,
    store.hasCompletedStartupSetup,
    showTranslateDialog,
    showSchedulingModal,
    syncBrowserViewBounds
  ]);

  useEffect(() => {
    if (window.electronAPI) {
      const cleanUrl = window.electronAPI.onBrowserViewUrlChanged(({ tabId, url }) => {
        if (store.tabs.find(t => t.id === tabId)) {
          store.updateTab(tabId, { url });
          if (tabId === store.activeTabId) {
            store.setCurrentUrl(url);
            // Add to history for URL predictor
            if (url && url !== 'about:blank' && !url.startsWith('file:') && !url.includes('google.com/search')) {
              store.addToHistory({ url, title: url });
            }
          }
        }
      });

      const cleanTitle = window.electronAPI.onBrowserViewTitleChanged(({ tabId, title }) => {
        if (store.tabs.find(t => t.id === tabId)) {
          store.updateTab(tabId, { title });
        }
      });

      const cleanLoading = window.electronAPI.onTabLoadingStatus(({ tabId, isLoading }) => {
        if (store.tabs.find(t => t.id === tabId)) {
          store.updateTab(tabId, { isLoading });
        }
      });

      return () => {
        cleanUrl();
        cleanTitle();
        cleanLoading();
      };
    }
  }, [store.activeTabId, store.tabs]);



  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onAddNewTab((url: string) => {
        store.addTab(url);
      });
      const cleanupNav = window.electronAPI.on('navigate-to-url', (url: string) => {
        handleGo(url);
      });
      return () => {
        cleanup();
        cleanupNav();
      };
    }
  }, [store, handleGo]);

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn("electronAPI is not available. Running outside of Electron or preload script failed.");
      return; // Exit early if electronAPI is not available
    }

    const cleanup = window.electronAPI.onAuthCallback(async (event: any, url: string) => {
      console.log("Auth callback received in ClientOnlyPage:", url);
      try {
        const parsed = new URL(url);

        // === CASE 1: Google OAuth Code Flow (Authorization Code returned) ===
        const code = parsed.searchParams.get("code");
        if (code) {
          console.log('[Auth] Received OAuth code — exchanging for tokens...');
          const clientId = store.clientId || '601898745585-8g9t0k72gq4q1a4s1o4d1t6t7e5v4c4g.apps.googleusercontent.com';
          const clientSecret = store.clientSecret || '';
          const redirectUri = store.redirectUri || 'https://browser.ponsrischool.in/oauth2callback';

          if (!clientSecret) {
            console.error('[Auth] No clientSecret available — cannot exchange code for token.');
            return;
          }

          // Exchange code → tokens
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }),
          });

          if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            console.error('[Auth] Token exchange failed:', errBody);
            return;
          }

          const tokens = await tokenRes.json();
          console.log('[Auth] Token exchange successful');

          // Persist refresh token for Gmail service
          if (tokens.refresh_token && window.electronAPI) {
            window.electronAPI.saveGoogleConfig({ clientId, clientSecret, redirectUri });
          }

          // Fetch user profile from Google
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          const profile = await profileRes.json();

          // Sign in to Firebase with the id_token
          if (tokens.id_token) {
            try {
              const { GoogleAuthProvider } = await import('firebase/auth');
              const credential = GoogleAuthProvider.credential(tokens.id_token);
              await firebaseService.signInWithCredential(credential);
              console.log('[Auth] Firebase sign-in successful');
            } catch (firebaseErr) {
              console.warn('[Auth] Firebase sign-in skipped (non-critical):', firebaseErr);
            }
          }

          // Set the user in the store
          store.setUser({
            uid: profile.sub,
            email: profile.email || '',
            displayName: profile.name || profile.email?.split('@')[0] || '',
            photoURL: profile.picture || '',
          });
          if (profile.email?.endsWith('@ponsrischool.in')) store.setAdmin(true);
          store.setHasSeenWelcomePage(true);
          store.setActiveView('browser');
          store.startActiveSession();
          console.log('[Auth] User signed in:', profile.email);
          return;
        }

        // === CASE 2: Legacy deep-link flow (uid/email passed directly in URL) ===
        const status = parsed.searchParams.get("auth_status");
        const token = parsed.searchParams.get("id_token") || parsed.searchParams.get("token");
        const uid = parsed.searchParams.get("uid");
        const email = parsed.searchParams.get("email");
        const name = parsed.searchParams.get("name");
        const photo = parsed.searchParams.get("photo");
        const configParam = parsed.searchParams.get("firebase_config");

        if (status === "success" && uid && email) {
          if (configParam) {
            try {
              const config = JSON.parse(atob(configParam));
              firebaseConfigStorage.save(config);
              store.setCustomFirebaseConfig(config);
              firebaseService.reinitialize();
            } catch (e) {
              console.error("Failed to parse returned firebase config:", e);
            }
          }

          if (token) {
            const credential = GoogleAuthProvider.credential(token);
            try {
              await firebaseService.signInWithCredential(credential);
              console.log("Firebase signed in successfully via deep link");
            } catch (e) {
              console.error("Firebase sign-in failed:", e);
            }
          }

          store.setUser({
            uid,
            email,
            displayName: name || email.split('@')[0],
            photoURL: photo || "",
          });

          if (email.endsWith("@ponsrischool.in")) store.setAdmin(true);

          store.setHasSeenWelcomePage(true);
          store.setActiveView('browser');
          store.startActiveSession();
        }
      } catch (e) {
        console.error("Error processing auth callback:", e);
      }
    });

    return cleanup;
  }, [store]);

  // Auto-trigger Google Login if no user and not already seen welcome page
  // Auto-trigger Google Login - Use Store Config
  useEffect(() => {
    if (isPopupWindow) return;

    // 1. Fetch App Config first
    if (!clientId) {
      store.fetchAppConfig();
    }

    // 2. Auto-login if conditions met (commented out by default to prevent spam, but logic is ready)
    /*
    if (!store.user && !store.hasSeenWelcomePage && window.electronAPI && store.googleClientId) {
      const clientId = store.googleClientId;
      const redirectUri = store.googleRedirectUri;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=code&` +
        `scope=email profile openid&` +
        `access_type=offline&` +
        `prompt=consent`;

      window.electronAPI.openAuthWindow(authUrl);
      store.setHasSeenWelcomePage(true);
    }
    */
  }, [isPopupWindow, currentUser, hasSeenWelcomePage, clientId]);

  // Early return for standalone popup windows
  if (isPopupWindow) {
    const panel = panelQuery;
    const closePopupWindow = () => window.close();
    const shellClassName = panel === 'search' || panel === 'apps'
      ? 'h-screen w-full bg-transparent flex items-start justify-center p-2 overflow-hidden'
      : 'h-screen w-full bg-transparent flex items-start justify-end p-2 overflow-hidden';
    const renderPopupShell = (content: React.ReactNode, panelClassName = 'w-full h-full') => (
      <div className={shellClassName} onMouseDown={closePopupWindow}>
        <div className={`${panelClassName} rounded-[22px] overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(14,20,30,0.74),rgba(7,10,18,0.48))] backdrop-blur-3xl shadow-[0_24px_64px_rgba(0,0,0,0.32)]`} onMouseDown={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );

    return (
      <>
        {panel === 'clipboard' && renderPopupShell(<ClipboardManager />, 'w-full h-full max-w-[470px]')}
        {panel === 'cart' && renderPopupShell(<UnifiedCartPanel onClose={closePopupWindow} onScan={handleCartScan} popupMode={true} />, 'w-full h-full max-w-[560px]')}
        {panel === 'downloads' && renderPopupShell(<DownloadsPanel downloads={downloads} onClose={closePopupWindow} />, 'w-full max-w-[400px] self-start')}
        {(panel === 'search' || panel === 'apps') && renderPopupShell(<SpotlightSearchOverlay show={true} onClose={closePopupWindow} mode="window" />, 'w-full h-full max-w-[900px]')}
        {panel === 'extensions' && (
          renderPopupShell(
            <div className="h-full w-full p-6 bg-[#070812]/95 relative border border-white/10 rounded-[28px] shadow-2xl overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-14 drag-region" />
              <button onClick={closePopupWindow} className="absolute top-4 right-4 z-10 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all no-drag-region">
                <X size={16} />
              </button>
              <ExtensionManager />
            </div>,
            'w-full h-full max-w-[1120px]'
          )
        )}
        {panel === 'context-menu' && renderPopupShell(
          <div className="w-full h-full bg-transparent py-1.5 flex flex-col">
            <button onClick={() => { window.electronAPI?.reload(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <RotateCw size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Reload</span>
            </button>
            <button onClick={() => { window.electronAPI?.goBack(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <ChevronLeft size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
            </button>
            <button onClick={() => { window.electronAPI?.goForward(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <ChevronRight size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Forward</span>
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button onClick={() => { window.electronAPI?.openTranslatePopup(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <Languages size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Translate</span>
            </button>
            <button onClick={() => { window.electronAPI?.toggleFullscreen(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <Maximize2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Fullscreen</span>
            </button>
            <button onClick={() => { window.electronAPI?.openDevTools(); window.close(); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-sky-500/10 text-white/60 hover:text-sky-400 transition-all text-left">
              <Code2 size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Inspect</span>
            </button>
          </div>,
          'w-full h-full max-w-[280px]'
        )}
        {panel === 'translate' && (
          renderPopupShell(
          <div className="h-full w-full p-6 flex flex-col items-center justify-center relative drag-region bg-transparent">
            <button onClick={() => window.close()} className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all no-drag-region">
              <X size={16} />
            </button>
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">Neural Translation</h3>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm overflow-y-auto max-h-[400px] custom-scrollbar no-drag-region">
              {store.availableLanguages.map(langCode => (
                <button
                  key={langCode}
                  onClick={async () => {
                    if (window.electronAPI) {
                      await window.electronAPI.translateWebsite({ targetLanguage: langCode });
                      window.close();
                    }
                  }}
                  className="p-4 bg-white/5 hover:bg-accent/10 border border-white/5 rounded-xl transition-all"
                >
                  <span className="text-sm font-bold text-white tracking-widest uppercase">{langCode}</span>
                </button>
              ))}
            </div>
          </div>,
          'w-full h-full max-w-[520px]'
          )
        )}
        {panel === 'ai-overview' && aiOverview && (
          renderPopupShell(
          <AIAssistOverlay
            query={aiOverview.query}
            result={aiOverview.result}
            sources={aiOverview.sources}
            isLoading={aiOverview.isLoading}
            provider={aiOverview.provider}
            model={aiOverview.model}
            statusMessage={aiOverview.statusMessage}
            durationMs={aiOverview.durationMs}
            onRefresh={() => runAiOverview(aiOverview.query)}
            availableOllamaModels={store.ollamaModelsList}
            selectedOllamaModel={store.ollamaModel}
            onOllamaModelSelect={(modelName) => store.setOllamaModel(modelName)}
            onOllamaModelsUpdate={(models) => store.setOllamaModelsList(models)}
            onClose={() => window.electronAPI?.closeAiOverview()}
            mode="window"
          />,
          'w-full h-full max-w-[560px]'
          )
        )}
        {(panel === 'settings' || panel === 'profile') && (
          renderPopupShell(
            <SettingsPanel onClose={() => window.close()} defaultSection={settingsSection} popupMode={true} />,
            'w-full h-full max-w-[1240px]'
          )
        )}
      </>
    );
  }

  return (
    <div className={`flex flex-col h-screen w-full bg-deep-space overflow-hidden relative font-sans text-primary-text transition-all duration-700`}>
      <TitleBar
        onToggleSpotlightSearch={() => setShowSpotlightSearch(prev => !prev)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {!store.hasSeenWelcomePage ? (
        <WelcomeScreen />
      ) : (
        !store.hasCompletedStartupSetup && (
          <StartupSetupUI onComplete={() => store.setHasCompletedStartupSetup(true)} />
        )
      )}

      <div
        className={`flex flex-1 overflow-hidden relative pt-10 bg-[#020205]`}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {/* Navigation Sidebar (Rail) */}
        <AnimatePresence>
          {railVisible && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 70, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col items-center py-6 gap-5 z-40 bg-black/40 backdrop-blur-2xl shadow-[10px_0_30px_rgba(0,0,0,0.5)] border-r border-white/5 no-drag-region"
            >
              {sidebarItems.map((item, idx) => (
                <SidebarIcon
                  key={idx}
                  icon={item.icon}
                  label={item.label}
                  active={!!(item.view && store.activeView === item.view) || !!(item.manager && activeManager === item.manager)}
                  onClick={() => handleSidebarClick(item)}
                  collapsed={true}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {store.sidebarOpen && (
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(e, info) => {
                if (info.offset.x > 100 && store.sidebarSide === 'left') store.setSidebarSide('right');
                if (info.offset.x < -100 && store.sidebarSide === 'right') store.setSidebarSide('left');
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: store.isSidebarCollapsed ? 70 : store.sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }} // Faster transition
              className={`relative h-full border-r border-border-color cursor-grab active:cursor-grabbing ${store.sidebarSide === 'left' ? 'order-first' : 'order-last'} no-drag-region bg-black/20`}
              onUpdate={() => {
                // Trigger resize during animation to keep BrowserView in sync
                if (window.electronAPI) window.dispatchEvent(new Event('resize'));
              }}
            >
              {/* Manual Resize Handle */}
              {!store.isSidebarCollapsed && (
                <div
                  className={`absolute top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-deep-space-accent-neon/30 transition-colors ${store.sidebarSide === 'left' ? 'right-0' : 'left-0'}`}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startWidth = store.sidebarWidth;

                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const delta = store.sidebarSide === 'left'
                        ? moveEvent.clientX - startX
                        : startX - moveEvent.clientX;
                      const newWidth = Math.max(280, Math.min(600, startWidth + delta));
                      store.setSidebarWidth(newWidth);
                    };

                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                />
              )}
              <AIChatSidebar
                studentMode={store.studentMode}
                toggleStudentMode={() => store.setStudentMode(!store.studentMode)}
                isCollapsed={store.isSidebarCollapsed}
                toggleCollapse={() => {
                  store.toggleSidebarCollapse();
                  setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                }}
                selectedEngine={store.selectedEngine}
                setSelectedEngine={store.setSelectedEngine}
                theme={store.theme}
                setTheme={store.setTheme}
                backgroundImage=""
                setBackgroundImage={() => { }}
                backend={store.backendStrategy}
                setBackend={store.setBackendStrategy}
                mysqlConfig={store.customMysqlConfig}
                setMysqlConfig={store.setCustomMysqlConfig}
                side={store.sidebarSide}
                setShowSettings={setShowSettings}
                setSettingsSection={setSettingsSection}
                setBrowserDisabled={setIsBrowserDisabled}
                showSchedulingModal={showSchedulingModal}
                setShowSchedulingModal={setShowSchedulingModal}
                schedulingIntent={schedulingIntent}
                setSchedulingIntent={setSchedulingIntent}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <main className="flex-1 flex flex-col relative overflow-hidden bg-black/5 min-w-0">
          {store.activeView === 'browser' && (
            <header className="h-[56px] flex-shrink-0 flex items-center px-4 gap-4 border-b border-white/5 bg-black/40 backdrop-blur-3xl z-40 no-drag-region">
              <div className="flex items-center gap-1">
                <button onClick={() => setRailVisible(!railVisible)} className={`p-2 rounded-xl transition-all ${railVisible ? 'text-secondary-text' : 'bg-accent text-primary-bg'}`} title="Toggle Tools Rail">
                  <Layout size={18} />
                </button>
                <button onClick={async () => {
                  if (window.electronAPI) {
                    const selectedText = await window.electronAPI.getSelectedText();
                    if (selectedText) {
                      window.electronAPI.sendToAIChatInput(selectedText);
                    }
                  }
                  store.toggleSidebar();
                }} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="AI Analyst">
                  <Sparkles size={18} />
                </button>
                <div className="w-[1px] h-4 bg-border-color mx-1" />
                <button onClick={() => window.electronAPI?.goBack()} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="Go Back"><ChevronLeft size={18} /></button>
                <button onClick={() => window.electronAPI?.goForward()} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="Go Forward"><ChevronRight size={18} /></button>
                <button onClick={() => window.electronAPI?.reload()} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="Reload Page"><RotateCw size={18} /></button>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="w-full max-w-2xl relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search size={14} className="text-secondary-text group-focus-within:text-primary-text transition-colors" />
                  </div>
                  <input
                    ref={inputRef} // Add ref
                    type="text"
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setIsTyping(true); }}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onKeyDown={(e) => {
                      // Shift+Enter: Insert new line (for multi-line queries)
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const start = input.selectionStart || inputValue.length;
                        const newValue = inputValue.slice(0, start) + '\n' + inputValue.slice(start);
                        setInputValue(newValue);
                        setTimeout(() => {
                          input.setSelectionRange(start + 1, start + 1);
                        }, 0);
                        return;
                      }
                      // Ctrl+Enter or Cmd+Enter: Search in new tab
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleGo(inputValue, { newTab: true, active: true });
                        return;
                      }
                      // Alt+Enter: Open in background tab
                      if (e.key === 'Enter' && e.altKey) {
                        e.preventDefault();
                        handleGo(inputValue, { newTab: true, active: false });
                        return;
                      }
                      // Regular Enter: Navigate
                      if (e.key === 'Enter') handleGo(inputValue);
                      if (e.key === 'Tab' && urlPrediction && isTyping) {
                        e.preventDefault();
                        setInputValue(urlPrediction); // Update input value with prediction
                        setUrlPrediction(null);
                        handleGo(urlPrediction); // Navigate to the predicted URL
                      }
                    }}
                    placeholder={`Search with ${store.selectedEngine} or enter URL...`}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-2 pl-11 pr-60 text-xs text-primary-text placeholder:text-secondary-text focus:outline-none focus:ring-1 focus:ring-accent/50 focus:bg-white/[0.07] transition-all font-medium backdrop-blur-md relative z-10"
                  />
                  {urlPrediction && isTyping && (
                    <div className="absolute inset-y-0 left-11 right-4 flex items-center pointer-events-none text-xs text-white/20 font-medium z-0">
                      <span>{inputValue}</span>
                      <span className="opacity-100">{urlPrediction.substring(inputValue.length)}</span>
                    </div>
                  )}
                  {store.tabs.find(t => t.id === store.activeTabId)?.isLoading && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden pointer-events-none rounded-t-2xl">
                      <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="w-1/2 h-full gradient-progressbar"
                      />
                    </div>
                  )}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 no-drag-region z-20 flex items-center gap-1.5">
                    <button
                      onClick={() => setShowDownloads(!showDownloads)}
                      className={`p-1.5 rounded-lg transition-all 
                                   ${isDownloading ? 'text-accent animate-pulse' : ''}
                                   ${downloadStatus === 'completed' ? 'text-green-400' : ''}
                                   ${downloadStatus === 'failed' ? 'text-red-400' : ''}
                                   ${downloadStatus === 'idle' ? 'text-secondary-text hover:text-sky-400' : ''}
                                   ${showDownloads ? 'bg-sky-500/10 text-sky-400' : ''}
                                   hover:bg-white/5`}
                      title="Downloads"
                    >
                      <DownloadCloud size={14} />
                    </button>
                    <button onClick={() => setShowClipboard(!showClipboard)} className={`p-1.5 rounded-lg transition-all ${showClipboard ? 'text-accent bg-sky-500/10' : 'text-secondary-text hover:text-sky-400'} hover:bg-white/5`} title="Clipboard">
                      <CopyIcon size={14} />
                    </button>
                    <button onClick={() => setShowCart(!showCart)} className={`p-1.5 rounded-lg transition-all ${showCart ? 'text-accent bg-sky-500/10' : 'text-secondary-text hover:text-sky-400'} hover:bg-white/5`} title="Unified Cart">
                      <ShoppingCart size={14} />
                    </button>
                    <button onClick={() => setShowTranslateDialog(true)} className={`p-1.5 rounded-lg transition-all ${showTranslateDialog ? 'text-accent bg-sky-500/10' : 'text-secondary-text hover:text-sky-400'} hover:bg-white/5`} title="Translate Page">
                      <Languages size={14} />
                    </button>
                    <button onClick={() => setShowExtensionsPopup(!showExtensionsPopup)} className={`p-1.5 rounded-lg transition-all ${showExtensionsPopup ? 'text-accent bg-sky-500/10' : 'text-secondary-text hover:text-sky-400'} hover:bg-white/5`} title="Extensions">
                      <Puzzle size={14} />
                    </button>
                    <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
                    <button onClick={handlePopSearch} className="p-1.5 rounded-lg hover:bg-white/10 text-white/20 hover:text-sky-400 transition-all" title="Quick Search">
                      <Search size={12} />
                    </button>
                  </div>
                  {isTyping && suggestions.length > 0 && (
                    <div
                      className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-[22px] border border-sky-400/15 bg-[linear-gradient(180deg,rgba(18,32,48,0.72),rgba(9,14,24,0.58))] shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-3xl max-h-[276px] overflow-y-auto custom-scrollbar"
                      style={{ width: inputRef.current ? inputRef.current.offsetWidth : 'auto' }}
                    >
                      {suggestions.map((s, index) => (
                        <div
                          key={index}
                          className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${index !== suggestions.length - 1 ? 'border-b border-white/6' : ''} hover:bg-sky-400/[0.08]`}
                          onClick={() => {
                            handleSuggestionClick(s);
                          }}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-white/55 group-hover:text-sky-300 group-hover:border-sky-400/20">
                            {s.type === 'search' && <Search size={14} />}
                            {s.type === 'history' && <RefreshCcw size={14} />}
                            {s.type === 'bookmark' && <Bookmark size={14} />}
                            {s.type === 'app' && s.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">{getSuggestionTitle(s)}</span>
                              <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                                {getSuggestionLabel(s.type)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/35 truncate">{getSuggestionDescription(s)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => { setSettingsSection('history'); setShowSettings(true); }} className="p-1.5 rounded-lg text-secondary-text hover:text-primary-text transition-all" title="History">
                  <RefreshCcw size={14} />
                </button>
                <button onClick={handleReadAloud} className={`p-1.5 rounded-lg transition-all ${isReadingAloud ? 'text-accent animate-pulse' : 'text-secondary-text hover:text-primary-text'}`} title="Read Aloud">
                  {isReadingAloud ? <Square size={14} /> : <Volume2 size={14} />}
                </button>

                <div className="w-[1px] h-6 bg-border-color mx-1" />

                <button onClick={toggleFullscreen} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="Toggle Fullscreen">
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button onClick={() => setShowSettings(true)} className="p-1 rounded-2xl hover:scale-110 transition-all outline-none border border-white/10 bg-white/5 overflow-hidden">
                  {(store.user?.photoURL || store.localPhotoURL) ? (
                    <img
                      src={store.user?.photoURL || store.localPhotoURL || ''}
                      alt="Profile"
                      className="w-6 h-6 rounded-full object-cover shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(store.user?.displayName || 'User')}&background=0D8ABC&color=fff`;
                      }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary-bg/5 border border-border-color flex items-center justify-center text-secondary-text">
                      <UserIcon size={14} />
                    </div>
                  )}
                </button>

                <button onClick={(e) => handleContextMenu(e as any)} className="p-2 rounded-xl hover:bg-primary-bg/10 text-secondary-text hover:text-primary-text transition-all" title="More">
                  <MoreVertical size={18} />
                </button>
              </div>
            </header>
          )}

          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              {store.activeView === 'landing-page' && (
                <motion.div key="landing-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205] overflow-auto custom-scrollbar">
                  <LandingPage />
                </motion.div>
              )}
              {store.activeView === 'workspace' && (
                <motion.div key="workspace" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <WorkspaceDashboard />
                </motion.div>
              )}

              {store.activeView === 'browser' && (
                <motion.div key="browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                  <div className={`h-full flex ${store.studentMode ? 'p-4 gap-4' : 'p-2'}`}>
                    <div className={`flex-[3] relative bg-[radial-gradient(circle_at_top,rgba(34,92,138,0.22),rgba(2,2,5,0.96)_34%)] shadow-[0_0_100px_rgba(0,0,0,0.5)] ${store.studentMode ? 'rounded-3xl' : 'rounded-2xl'} overflow-hidden border border-white/5`}>
                      {!store.isOnline && (
                        <div className="absolute inset-0 z-[100] bg-[#0a0a0f]">
                          <NoNetworkGame />
                        </div>
                      )}
                      {isBrowserDisabled && (
                        <div className="absolute inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                          <div className="text-center">
                            <Sparkles size={48} className="mx-auto mb-4 text-deep-space-accent-neon animate-pulse" />
                            <p className="text-white text-lg font-bold">Automation in Progress</p>
                            <p className="text-white/50 text-sm mt-2">Browser is paused while task is being configured</p>
                          </div>
                        </div>
                      )}
                      {/* This area is now intentionally blank. The BrowserView is managed by the main process. */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-sky-500/20 to-transparent pointer-events-none" />
                    </div>
                    {store.studentMode && (
                      <div className="flex-1 glass-vibrant shadow-3xl rounded-3xl p-6 flex flex-col border border-border-color bg-primary-bg/5">
                        <div className="flex items-center gap-3 mb-6">
                          <Sparkles size={20} className="text-accent" />
                          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-secondary-text">Context Intelligence</h3>
                        </div>
                        <textarea
                          className="flex-1 bg-transparent text-primary-text text-sm leading-relaxed resize-none focus:outline-none placeholder:text-secondary-text custom-scrollbar font-medium"
                          placeholder="Insights reflect current tab content..."
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              {store.activeView === 'webstore' && (
                <motion.div key="webstore" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <WebStore onClose={() => store.setActiveView('browser')} />
                </motion.div>
              )}

              {store.activeView === 'pdf' && (
                <motion.div key="pdf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <PDFWorkspace />
                </motion.div>
              )}

              {store.activeView === 'coding' && (
                <motion.div key="coding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <CodingDashboard />
                </motion.div>
              )}

              {store.activeView === 'media' && (
                <motion.div key="media" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <MediaStudio />
                </motion.div>
              )}

              {store.activeView === 'documentation' && (
                <motion.div key="documentation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute inset-0 z-[100] bg-[#020205] overflow-auto custom-scrollbar">
                  <Documentation />
                </motion.div>
              )}

              {store.activeView === 'presenton' && (
                <motion.div key="presenton" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[60] bg-[#020205]">
                  <PresentonStudio />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Feature Overlays */}
            <AnimatePresence>
              {showSettings && (
                <SettingsPanel
                  onClose={handleSettingsClose}
                  defaultSection={settingsSection}
                />
              )}

              {/* Standalone popups are now handled externally via separate windows */}

              {/* Standalone popups are now handled via separate BrowserWindows */}

              {/* Manager Overlays */}
              {activeManager === 'password' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="w-full max-w-4xl h-[80vh] bg-[#020205] rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                    <button
                      onClick={() => setActiveManager(null)}
                      className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all"
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                    <PasswordManager />
                  </div>
                </motion.div>
              )}

              {activeManager === 'firewall' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="w-full max-w-4xl h-[80vh] bg-[#020205] rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                    <button
                      onClick={() => setActiveManager(null)}
                      className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all"
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                    <ProxyFirewallManager />
                  </div>
                </motion.div>
              )}

              {activeManager === 'p2p' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="w-full max-w-4xl h-[80vh] bg-[#020205] rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
                    <button
                      onClick={() => setActiveManager(null)}
                      className="absolute top-4 right-4 z-50 p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-all"
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                    <P2PSyncManager />
                  </div>
                </motion.div>
              )}

              {showCamera && (
                <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center">
                  <div className="relative w-[800px] h-[600px] bg-black rounded-3xl overflow-hidden border border-white/20">
                    <button onClick={() => setShowCamera(false)} className="absolute top-4 right-4 z-50 text-white" title="Close Camera"><X /></button>
                    <PhoneCamera onClose={() => setShowCamera(false)} />
                  </div>
                </div>
              )}

              {showTabSwitcher && (
                <TabSwitcherOverlay visible={showTabSwitcher} />
              )}
            </AnimatePresence>

            {/* Neural Context Overlay */}
            <AnimatePresence>
              {aiOverview && !(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
                <AIAssistOverlay
                  query={aiOverview.query}
                  result={aiOverview.result}
                  sources={aiOverview.sources}
                  isLoading={aiOverview.isLoading}
                  provider={aiOverview.provider}
                  model={aiOverview.model}
                  statusMessage={aiOverview.statusMessage}
                  durationMs={aiOverview.durationMs}
                  onRefresh={() => runAiOverview(aiOverview.query)}
                  availableOllamaModels={store.ollamaModelsList}
                  selectedOllamaModel={store.ollamaModel}
                  onOllamaModelSelect={(modelName) => store.setOllamaModel(modelName)}
                  onOllamaModelsUpdate={(models) => store.setOllamaModelsList(models)}
                  onClose={() => setAiOverview(null)}
                />
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showContextMenu && (
          <>
            <div className="fixed inset-0 z-[1000]" onClick={() => setShowContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setShowContextMenu(null); }} />
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[1001] w-48 bg-primary-bg/95 backdrop-blur-2xl border border-border-color rounded-xl shadow-2xl overflow-hidden py-1.5"
              style={{ left: showContextMenu.x, top: showContextMenu.y }}
            >
              <button onClick={() => { window.electronAPI?.reload(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <RefreshCcw size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Reload</span>
              </button>
              <button onClick={() => { window.electronAPI?.goBack(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <ChevronLeft size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Back</span>
              </button>
              <button onClick={() => { window.electronAPI?.goForward(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <ChevronRight size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Forward</span>
              </button>
              <button onClick={() => { setShowTranslateDialog(true); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <Languages size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Translate Website</span>
              </button>
              <div className="h-[1px] bg-border-color my-1" />
              <button onClick={() => { handleOfflineSave(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <DownloadIcon size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Save Page</span>
              </button>
              <button onClick={() => { toggleFullscreen(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <Maximize2 size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Fullscreen</span>
              </button>
              <button onClick={() => { window.electronAPI?.openDevTools(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <Code2 size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Inspect</span>
              </button>
              <button onClick={() => { handleCreateShortcut(); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <Plus size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Create Shortcut</span>
              </button>
              <button onClick={async () => {
                setShowContextMenu(null);
                if (window.electronAPI) {
                  const selectedText = await window.electronAPI.getSelectedText();
                  if (selectedText) {
                    runAiOverview(selectedText);
                  } else {
                    runAiOverview(store.currentUrl);
                  }
                }
              }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <Sparkles size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Search with AI</span>
              </button>
              <button onClick={() => { setShowSettings(true); setShowContextMenu(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent/10 text-secondary-text hover:text-accent transition-all">
                <GhostSettings size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Settings</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTranslateDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm max-h-[80vh] bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-3xl overflow-hidden flex flex-col">
              <div className="flex-shrink-0 p-6 pb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4 text-center">TRANSLATE SITE</h3>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setTranslateMethod('google')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${translateMethod === 'google' ? 'bg-accent/20 border-accent/40 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                  >
                    Google
                  </button>
                  <button
                    onClick={() => setTranslateMethod('chrome-ai')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${translateMethod === 'chrome-ai' ? 'bg-accent/20 border-accent/40 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}
                  >
                    Chrome AI
                  </button>
                </div>
                <p className="text-[10px] text-white/30 text-center">
                  {translateMethod === 'google'
                    ? 'Google: Fast, relies on Google servers'
                    : 'Chrome AI: On-device, private, requires Chrome 144+'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2">
                  {store.availableLanguages.map((langCode) => {
                    const names: Record<string, string> = {
                      en: 'English', hi: 'Hindi', bn: 'Bengali', te: 'Telugu',
                      mr: 'Marathi', ta: 'Tamil', gu: 'Gujarati', ur: 'Urdu',
                      kn: 'Kannada', or: 'Odia', ml: 'Malayalam', pa: 'Punjabi',
                      as: 'Assamese', mai: 'Maithili', sat: 'Santali', ks: 'Kashmiri',
                      ne: 'Nepali', kok: 'Konkani', sd: 'Sindhi', doi: 'Dogri',
                      mni: 'Manipuri', sa: 'Sanskrit', brx: 'Bodo',
                      es: 'Spanish', fr: 'French', de: 'German',
                      ja: 'Japanese', zh: 'Chinese', ru: 'Russian',
                      pt: 'Portuguese', it: 'Italian', ko: 'Korean'
                    };
                    return (
                      <button
                        key={langCode}
                        onClick={async () => {
                          if (window.electronAPI) {
                            await window.electronAPI.translateWebsite({ targetLanguage: langCode, method: translateMethod });
                          }
                          setShowTranslateDialog(false);
                        }}
                        className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/40 rounded-xl transition-all group"
                      >
                        <span className="text-sm font-black text-white group-hover:text-accent transition-colors">{names[langCode] || langCode}</span>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">{langCode}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setShowTranslateDialog(false)} className="w-full mt-6 py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white">Close</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={ambientAudioRef} src={store.ambientMusicUrl} loop hidden />
      <AnimatePresence>
        {showSettings && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-10"
            onPointerDown={() => setShowSettings(false)}
          >
            <div className="w-full max-w-4xl" onPointerDown={(event) => event.stopPropagation()}>
              <SettingsPanel onClose={() => setShowSettings(false)} defaultSection={settingsSection} />
            </div>
          </div>
        )}
        {showDownloads && !(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
          <div className="fixed inset-0 z-[9998]" onPointerDown={() => setShowDownloads(false)}>
            <div
              className="fixed top-24 right-10 z-[9999] w-[400px] h-[600px]"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <DownloadsPanel downloads={downloads} onClose={() => setShowDownloads(false)} />
            </div>
          </div>
        )}
        {showClipboard && !(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
          <div className="fixed inset-0 z-[9998]" onPointerDown={() => setShowClipboard(false)}>
            <div
              className="fixed top-24 right-10 z-[9999] w-[450px] h-[650px] overflow-hidden"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <ClipboardManager onClose={() => setShowClipboard(false)} />
            </div>
          </div>
        )}
        {showCart && !(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-md" onPointerDown={() => setShowCart(false)}>
            <div className="w-full max-w-[900px]" onPointerDown={(event) => event.stopPropagation()}>
              <UnifiedCartPanel onClose={() => setShowCart(false)} onScan={handleCartScan} />
            </div>
          </div>
        )}
        {showExtensionsPopup && !(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-md p-10" onPointerDown={() => setShowExtensionsPopup(false)}>
            <div
              className="w-full max-w-4xl h-full max-h-[800px] glass-dark rounded-[40px] border border-white/10 shadow-2xl p-8 overflow-hidden flex flex-col"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-400/20 flex items-center justify-center text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                    <Puzzle size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Extension Forge</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/60">Manage your neural plugins</p>
                  </div>
                </div>
                <button onClick={() => setShowExtensionsPopup(false)} className="p-3 hover:bg-white/10 rounded-full transition-all group">
                  <X size={20} className="text-white/40 group-hover:text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-10">
                <div className="grid grid-cols-2 gap-6">
                  {activeExtensions.length === 0 ? (
                    <div className="col-span-2 py-20 text-center opacity-20">
                      <Puzzle size={64} className="mx-auto mb-6" />
                      <p className="text-sm font-black uppercase tracking-[0.3em]">No Extensions Installed</p>
                    </div>
                  ) : (
                    activeExtensions.map(ext => (
                      <div key={ext.id} className="p-6 bg-white/5 rounded-3xl border border-white/10 hover:border-sky-400/30 transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-black/40 rounded-xl flex items-center justify-center overflow-hidden border border-white/5">
                              {ext.icon ? <img src={ext.icon} className="w-full h-full object-cover" /> : <Puzzle size={20} className="text-white/20" />}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white">{ext.name}</h4>
                              <p className="text-[10px] text-white/40">{ext.id}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => window.electronAPI?.toggleExtension(ext.id)} className={`p-2 rounded-lg transition-all ${ext.enabled ? 'bg-sky-500/10 text-sky-400' : 'bg-white/5 text-white/20'}`}>
                              <Zap size={14} />
                            </button>
                            <button onClick={() => window.electronAPI?.uninstallExtension(ext.id)} className="p-2 hover:bg-red-500/10 hover:text-red-400 text-white/20 rounded-lg transition-all">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
      {!(typeof window !== 'undefined' && window.electronAPI && store.activeView === 'browser') && (
        <SpotlightSearchOverlay show={showSpotlightSearch} onClose={() => setShowSpotlightSearch(false)} />
      )}
      {showSchedulingModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <SchedulingModal 
            isOpen={showSchedulingModal} 
            onClose={() => {
              setShowSchedulingModal(false);
              setIsBrowserDisabled(false);
            }}
            onConfirm={async (config) => {
              // Get scheduling intent from store or default
              if (window.electronAPI?.scheduleTask) {
                await window.electronAPI.scheduleTask({
                  name: 'Scheduled Task',
                  type: 'ai-prompt',
                  cronExpression: config.schedule,
                  prompt: schedulingIntent?.taskName || 'Run AI task',
                  outputPath: config.outputPath,
                  enabled: config.enabled,
                });
              }
              setShowSchedulingModal(false);
              setIsBrowserDisabled(false);
            }}
            taskDetails={{
              taskName: schedulingIntent?.taskName || 'Scheduled Task',
              taskType: schedulingIntent?.taskType || 'ai-prompt',
              schedule: schedulingIntent?.schedule.expression || '0 8 * * *',
              description: schedulingIntent?.schedule.description || 'Configure your scheduled task',
            }}
          />
        </div>
      )}
    </div>
  );
}
