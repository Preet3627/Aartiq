/**
 * Comet AI Sidebar - Thuki-inspired floating assistant
 * Adapted from Thuki by Logan Nguyen (Apache 2.0)
 * Modified for Comet AI / Electron
 */

import { motion, AnimatePresence } from 'framer-motion';
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useCometAI } from './useCometAI';
import type { Message } from './useCometAI';
import { AskBarView, MAX_IMAGES } from './AskBarView';
import { ConversationView } from './ConversationView';
import { HistoryPanel } from './HistoryPanel';
import { ImagePreviewModal } from './ImagePreviewModal';
import type { AttachedImage } from './image';
import { quote } from './config';
import { COMMANDS, SCREEN_CAPTURE_PLACEHOLDER } from './commands';
import './App.css';

const OVERLAY_WIDTH = 600;
const COLLAPSED_WINDOW_HEIGHT = 80;
const MAX_CHAT_WINDOW_HEIGHT = 648;
const HIDE_COMMIT_DELAY_MS = 350;

export function parseCommands(text: string): {
  found: Set<string>;
  strippedMessage: string;
} {
  const words = text.trim().split(/\s+/);
  const triggerSet = new Set(COMMANDS.map((c) => c.trigger));
  const found = new Set<string>();
  const remaining: string[] = [];
  for (const word of words) {
    if (triggerSet.has(word)) {
      found.add(word);
    } else {
      remaining.push(word);
    }
  }
  return { found, strippedMessage: remaining.join(' ') };
}

type OverlayState = 'visible' | 'hidden' | 'hiding';

interface CometSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
  initialSelectedText?: string;
}

export function CometSidebar({
  isOpen,
  onClose,
  initialContext,
  initialSelectedText,
}: CometSidebarProps) {
  const [query, setQuery] = useState('');
  const [overlayState, setOverlayState] = useState<OverlayState>('hidden');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [pendingNewConversation, setPendingNewConversation] = useState(false);
  const morphingContainerNodeRef = useRef<HTMLDivElement | null>(null);

  const [conversations, setConversations] = useState<{
    id: string;
    title: string;
    updatedAt: Date;
    messages: Message[];
  }[]>([]);

  const handleTurnComplete = useCallback(
    (userMsg: Message, assistantMsg: Message) => {
      const title = userMsg.content.slice(0, 50) || 'New conversation';
      setConversations((prev) => [{
        id: `conv-${Date.now()}`,
        title,
        updatedAt: new Date(),
        messages: [...prev.flatMap(c => c.messages), userMsg, assistantMsg],
      }, ...prev]);
    },
    [],
  );

  const { messages, ask, cancel, isGenerating, reset, loadMessages } =
    useCometAI(handleTurnComplete);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const pendingSubmitRef = useRef<{
    query: string;
    context: string | undefined;
    think: boolean;
  } | null>(null);
  const [isSubmitPending, setIsSubmitPending] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const screenCapturePendingRef = useRef(false);
  const screenCaptureInputSnapshotRef = useRef<{
    query: string;
    context: string | undefined;
  } | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);

  const [sessionId, setSessionId] = useState(0);
  const [selectedContext, setSelectedContext] = useState<string | null>(
    initialSelectedText || null
  );
  const [growsUpward, setGrowsUpward] = useState(false);

  const isChatMode = messages.length > 0 || isGenerating || isSubmitPending;
  const previousIsChatModeRef = useRef(isChatMode);
  const canSave = !isGenerating && messages.some((m) => m.role === 'assistant');
  const shouldRenderOverlay = overlayState === 'visible';
  const observerRef = useRef<ResizeObserver | null>(null);
  const growsUpwardRef = useRef(false);
  const windowPosRef = useRef({ x: 0, bottomY: 0 });
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = isGenerating;
  const maxHeightRef = useRef(0);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    morphingContainerNodeRef.current = node;

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      const observer = new ResizeObserver((entries) => {
        requestAnimationFrame(() => {
          for (const entry of entries) {
            const rect = entry.target.getBoundingClientRect();
            let targetHeight = Math.ceil(rect.height) + 48;

            if (isGeneratingRef.current) {
              if (targetHeight > maxHeightRef.current) {
                maxHeightRef.current = targetHeight;
              } else {
                targetHeight = maxHeightRef.current;
              }
            }

            if (growsUpwardRef.current) {
              const { x, bottomY } = windowPosRef.current;
              const newY = Math.max(0, bottomY - targetHeight);
              window.posRef.current?.style.setProperty('transform', `translateY(${newY}px)`);
            }
          }
        });
      });

      observer.observe(node);
      observerRef.current = observer;
    }
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      maxHeightRef.current = 0;
    }
  }, [isGenerating]);

  const replayEntranceAnimation = useCallback(
    (context: string | null) => {
      setSessionId((id) => id + 1);
      setQuery('');
      setSelectedContext(context);
      setIsHistoryOpen(false);
      setAttachedImages((prev) => {
        for (const img of prev) URL.revokeObjectURL(img.blobUrl);
        return [];
      });
      pendingSubmitRef.current = null;
      screenCapturePendingRef.current = false;
      screenCaptureInputSnapshotRef.current = null;
      setIsSubmitPending(false);
      setPendingUserMessage(null);
      setCaptureError(null);
      reset();
      setOverlayState('visible');
    },
    [reset],
  );

  const requestHideOverlay = useCallback(() => {
    cancel();
    growsUpwardRef.current = false;
    setGrowsUpward(false);
    screenCapturePendingRef.current = false;
    screenCaptureInputSnapshotRef.current = null;
    setSelectedContext(null);
    setPreviewImageUrl(null);
    setAttachedImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.blobUrl);
      return [];
    });
    setOverlayState((currentState) => {
      if (currentState === 'hidden' || currentState === 'hiding') {
        return currentState;
      }
      return 'hiding';
    });
  }, [cancel]);

  const historyDropdownRef = useRef<HTMLDivElement>(null);

  const handleHistoryToggle = useCallback(() => {
    setIsHistoryOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!(isChatMode && isHistoryOpen)) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        historyDropdownRef.current?.contains(target) ||
        target.closest?.('[data-history-toggle]')
      ) {
        return;
      }
      setIsHistoryOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isChatMode, isHistoryOpen]);

  const prevHistoryOpenRef = useRef(isHistoryOpen);
  const prevHeightRef = useRef<number>(COLLAPSED_WINDOW_HEIGHT);
  if (prevHistoryOpenRef.current && !isHistoryOpen) {
    setPendingNewConversation(false);
  }
  prevHistoryOpenRef.current = isHistoryOpen;

  const handleSave = useCallback(async () => {
    if (messages.length === 0) return;
    const title = messages[0]?.content?.slice(0, 50) || 'Conversation';
    const existingIndex = conversations.findIndex(c => 
      c.messages.length === messages.length
    );
    if (existingIndex >= 0) {
      setConversations(prev => prev.filter((_, i) => i !== existingIndex));
    }
    setConversations(prev => [{
      id: `conv-${Date.now()}`,
      title,
      updatedAt: new Date(),
      messages: [...messages],
    }, ...prev]);
  }, [messages, conversations]);

  const handleLoadConversation = useCallback(
    async (id: string) => {
      const conv = conversations.find(c => c.id === id);
      if (conv) {
        loadMessages(conv.messages);
      }
      setIsHistoryOpen(false);
    },
    [conversations, loadMessages],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      setConversations(prev => prev.filter(c => c.id !== id));
    },
    [],
  );

  const resetForNewConversation = useCallback(() => {
    reset();
    setQuery('');
    setAttachedImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.blobUrl);
      return [];
    });
    pendingSubmitRef.current = null;
    screenCapturePendingRef.current = false;
    screenCaptureInputSnapshotRef.current = null;
    setIsSubmitPending(false);
    setPendingUserMessage(null);
  }, [reset]);

  const handleNewConversation = useCallback(() => {
    if (messages.length > 0) {
      setPendingNewConversation(true);
      setIsHistoryOpen(true);
      return;
    }
    resetForNewConversation();
  }, [messages.length, resetForNewConversation]);

  const handleSaveAndNew = useCallback(async () => {
    handleSave();
    resetForNewConversation();
  }, [handleSave, resetForNewConversation]);

  const handleJustNew = useCallback(() => {
    resetForNewConversation();
  }, [resetForNewConversation]);

  const handleImagesAttached = useCallback((files: File[]) => {
    const newImages: AttachedImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      blobUrl: URL.createObjectURL(file),
      filePath: null,
    }));

    setAttachedImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (attachedImages.length >= MAX_IMAGES) return;
    
    if (window.electronAPI?.captureScreen) {
      try {
        const result = await window.electronAPI.captureScreen();
        if (result?.success && result.path) {
          const response = await fetch(`file://${result.path}`);
          const blob = await response.blob();
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          handleImagesAttached([file]);
        }
      } catch (e) {
        setCaptureError('Screenshot capture failed');
      }
    }
  }, [attachedImages.length, handleImagesAttached]);

  const handleImageRemove = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.blobUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleAskBarImagePreview = useCallback((id: string) => {
    setPreviewImageUrl(attachedImages.find((i) => i.id === id)?.blobUrl ?? null);
  }, [attachedImages]);

  const handleChatImagePreview = useCallback((path: string) => {
    setPreviewImageUrl(path.startsWith('blob:') ? path : `file://${path}`);
  }, []);

  const executeSubmit = useCallback(
    (submitQuery: string, context: string | undefined, think?: boolean) => {
      const readyPaths = attachedImages
        .filter((img) => img.filePath !== null)
        .map((img) => img.filePath as string);
      const images = readyPaths.length > 0 ? readyPaths : undefined;
      ask(submitQuery, context, images, think);
      setSelectedContext(null);
      setQuery('');
      for (const img of attachedImages) {
        URL.revokeObjectURL(img.blobUrl);
      }
      setAttachedImages([]);
      if (inputRef.current) inputRef.current.style.height = 'auto';
    },
    [ask, attachedImages],
  );

  const handleScreenSubmit = useCallback(
    async (fullQuery: string, think?: boolean) => {
      const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
      const sanitized = selectedContext
        ?.replace(CONTROL_CHARS, '')
        .slice(0, quote.maxContextLength);
      const context = sanitized?.trim() ? sanitized : undefined;

      const existingDisplayPaths = attachedImages.map(
        (img) => img.filePath ?? img.blobUrl,
      );

      screenCaptureInputSnapshotRef.current = { query: fullQuery, context };
      screenCapturePendingRef.current = true;
      setIsSubmitPending(true);
      setPendingUserMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: fullQuery,
        quotedText: context,
        imagePaths: [...existingDisplayPaths, SCREEN_CAPTURE_PLACEHOLDER],
      });
      setQuery('');
      setSelectedContext(null);
      if (inputRef.current) inputRef.current.style.height = 'auto';

      try {
        const result = await window.electronAPI?.captureFullScreen();
        if (result?.success && result.path) {
          const response = await fetch(`file://${result.path}`);
          const blob = await response.blob();
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          const newImage: AttachedImage = {
            id: crypto.randomUUID(),
            blobUrl: URL.createObjectURL(file),
            filePath: result.path,
          };
          setAttachedImages(prev => [...prev, newImage]);
          readyPaths.push(result.path);
        }
      } catch (e) {
        screenCapturePendingRef.current = false;
        screenCaptureInputSnapshotRef.current = null;
        setIsSubmitPending(false);
        setPendingUserMessage(null);
        setQuery(fullQuery);
        setSelectedContext(context ?? null);
        setCaptureError('Screen capture failed');
        return;
      }

      const wasCancelled = !screenCapturePendingRef.current;
      screenCapturePendingRef.current = false;
      screenCaptureInputSnapshotRef.current = null;
      if (wasCancelled) return;

      setCaptureError(null);
      setIsSubmitPending(false);
      setPendingUserMessage(null);

      ask(fullQuery, context, readyPaths, think);
      for (const img of attachedImages) {
        URL.revokeObjectURL(img.blobUrl);
      }
      setAttachedImages([]);
    },
    [selectedContext, attachedImages, ask],
  );

  const handleSubmit = useCallback(() => {
    if (
      (query.trim().length === 0 && attachedImages.length === 0) ||
      isGenerating
    ) return;

    setCaptureError(null);

    const trimmedQuery = query.trim();
    const { found, strippedMessage } = parseCommands(trimmedQuery);
    const hasScreen = found.has('/screen');
    const hasThink = found.has('/think');

    if (!strippedMessage && attachedImages.length === 0 && !hasScreen) return;

    if (hasScreen) {
      void handleScreenSubmit(trimmedQuery, hasThink);
      return;
    }

    const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
    const sanitized = selectedContext
      ?.replace(CONTROL_CHARS, '')
      .slice(0, quote.maxContextLength);
    const context = sanitized?.trim() ? sanitized : undefined;

    const hasPendingImages = attachedImages.some(
      (img) => img.filePath === null,
    );
    if (!hasPendingImages) {
      executeSubmit(trimmedQuery, context, hasThink || undefined);
      return;
    }

    pendingSubmitRef.current = { query: trimmedQuery, context, think: hasThink };
    setIsSubmitPending(true);

    setPendingUserMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmedQuery,
      quotedText: context,
      imagePaths: attachedImages.map((img) => img.filePath ?? img.blobUrl),
    });

    setQuery('');
    setSelectedContext(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [query, isGenerating, executeSubmit, handleScreenSubmit, selectedContext, attachedImages]);

  useEffect(() => {
    if (!pendingSubmitRef.current) return;
    if (attachedImages.length === 0) {
      const { query: savedQuery, context: savedContext } = pendingSubmitRef.current;
      pendingSubmitRef.current = null;
      setIsSubmitPending(false);
      setPendingUserMessage(null);
      setQuery(savedQuery);
      setSelectedContext(savedContext ?? null);
      return;
    }
    const allReady = attachedImages.every((img) => img.filePath !== null);
    if (!allReady) return;

    const { query: pendingQuery, context, think } = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    setIsSubmitPending(false);
    setPendingUserMessage(null);

    const images = attachedImages.map((img) => img.filePath as string);
    void ask(pendingQuery, context, images, think || undefined);
    setSelectedContext(null);
    for (const img of attachedImages) {
      URL.revokeObjectURL(img.blobUrl);
    }
    setAttachedImages([]);
  }, [attachedImages, ask]);

  const handleCancel = useCallback(() => {
    if (isSubmitPending && pendingSubmitRef.current) {
      setQuery(pendingSubmitRef.current.query);
      setSelectedContext(pendingSubmitRef.current.context ?? null);
      pendingSubmitRef.current = null;
      setIsSubmitPending(false);
      setPendingUserMessage(null);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    if (isSubmitPending) {
      screenCapturePendingRef.current = false;
      const snapshot = screenCaptureInputSnapshotRef.current;
      screenCaptureInputSnapshotRef.current = null;
      setIsSubmitPending(false);
      setPendingUserMessage(null);
      if (snapshot) {
        setQuery(snapshot.query);
        setSelectedContext(snapshot.context ?? null);
      }
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    cancel();
  }, [isSubmitPending, cancel]);

  const handleCloseOverlay = useCallback(() => {
    requestHideOverlay();
    onClose();
  }, [requestHideOverlay, onClose]);

  useEffect(() => {
    if (isOpen) {
      replayEntranceAnimation(initialContext ?? null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialContext]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (((e.metaKey || e.ctrlKey) && e.key === 'w') || e.key === 'Escape') {
        e.preventDefault();
        handleCloseOverlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCloseOverlay]);

  useEffect(() => {
    if (overlayState === 'hiding') {
      const timer = setTimeout(() => {
        setOverlayState('hidden');
      }, HIDE_COMMIT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [overlayState]);

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col items-center ${growsUpward ? 'justify-end' : 'justify-start'} h-screen w-screen px-3 pt-2 pb-6 bg-transparent overflow-visible fixed inset-0 z-[9999]`}
    >
      <AnimatePresence mode="wait">
        {shouldRenderOverlay ? (
          <motion.div
            key={`overlay-${sessionId}`}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-2xl px-4 overflow-visible"
          >
            <div className="relative">
              <div
                ref={setContainerRef}
                style={{
                  transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className={`morphing-container relative flex flex-col bg-surface-base backdrop-blur-2xl border border-surface-border max-h-[600px] overflow-hidden ${
                  isChatMode ? 'rounded-xl shadow-chat' : 'rounded-2xl shadow-bar'
                }`}
              >
                <AnimatePresence>
                  {isChatMode ? (
                    <ConversationView
                      messages={pendingUserMessage ? [...messages, pendingUserMessage] : messages}
                      isGenerating={isGenerating || isSubmitPending}
                      onClose={handleCloseOverlay}
                      onSave={handleSave}
                      isSaved={false}
                      canSave={canSave}
                      onNewConversation={handleNewConversation}
                      onHistoryOpen={handleHistoryToggle}
                      onImagePreview={handleChatImagePreview}
                    />
                  ) : null}
                </AnimatePresence>

                {!isChatMode && (
                  <AnimatePresence>
                    {isHistoryOpen ? (
                      <motion.div
                        key="ask-bar-history"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ height: { duration: 0.3, ease: [0.33, 1, 0.68, 1] }, opacity: { duration: 0.2, delay: 0.08 } }}
                        style={{ overflow: 'hidden' }}
                        className="border-t border-surface-border"
                      >
                        <HistoryPanel
                          listConversations={conversations}
                          onLoadConversation={handleLoadConversation}
                          onSaveAndLoad={() => {}}
                          onDeleteConversation={handleDeleteConversation}
                          hasCurrentMessages={false}
                          showNewConversation={false}
                          currentConversationId={null}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                )}

                {captureError && (
                  <div className="px-4 py-2 border-t border-red-900/30">
                    <p className="text-red-400 text-xs leading-relaxed">{captureError}</p>
                  </div>
                )}

                <AskBarView
                  query={query}
                  setQuery={setQuery}
                  isChatMode={isChatMode}
                  isGenerating={isGenerating}
                  isSubmitPending={isSubmitPending}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                  inputRef={inputRef}
                  selectedText={selectedContext ?? undefined}
                  onHistoryOpen={handleHistoryToggle}
                  attachedImages={attachedImages}
                  onImagesAttached={handleImagesAttached}
                  onImageRemove={handleImageRemove}
                  onImagePreview={handleAskBarImagePreview}
                  onScreenshot={handleScreenshot}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {previewImageUrl && (
        <ImagePreviewModal
          imageUrl={previewImageUrl}
          onClose={() => setPreviewImageUrl(null)}
        />
      )}
    </div>
  );
}

export default CometSidebar;
