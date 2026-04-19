"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Clock,
  Camera,
  ArrowUp,
  Square,
  Plus,
  Bookmark,
  ChevronLeft,
  X,
  Image as ImageIcon,
  Copy,
  Check,
  Minimize2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  quotedText?: string;
  imagePaths?: string[];
  timestamp: Date;
  isStreaming?: boolean;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
  messages: ChatMessage[];
}

interface CommandItem {
  trigger: string;
  description: string;
  icon?: React.ReactNode;
}

const COMMANDS: CommandItem[] = [
  { trigger: '/screen', description: 'Capture screen and analyze', icon: <Camera size={12} /> },
  { trigger: '/think', description: 'Enable reasoning mode', icon: <Sparkles size={12} /> },
  { trigger: '/summarize', description: 'Summarize selected content', icon: <Sparkles size={12} /> },
  { trigger: '/search', description: 'Search the web', icon: <Sparkles size={12} /> },
  { trigger: '/rewrite', description: 'Rewrite selected text', icon: <Sparkles size={12} /> },
  { trigger: '/translate', description: 'Translate text', icon: <Sparkles size={12} /> },
  { trigger: '/explain', description: 'Explain code or concept', icon: <Sparkles size={12} /> },
];

const MAX_IMAGES = 3;
const OVERLAY_WIDTH = 600;
const COLLAPSED_HEIGHT = 80;
const MAX_CHAT_HEIGHT = 600;

interface ThukiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: string;
  onSendMessage?: (message: string, context?: string, images?: string[]) => void;
}

export default function ThukiAssistant({
  isOpen,
  onClose,
  initialContext,
  onSendMessage,
}: ThukiAssistantProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);
  const [commandPrefix, setCommandPrefix] = useState('');
  const [selectedContext, setSelectedContext] = useState<string | undefined>(initialContext);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [attachedImages, setAttachedImages] = useState<{ id: string; url: string; file?: File }[]>([]);
  const [windowHeight, setWindowHeight] = useState(COLLAPSED_HEIGHT);
  const [pendingNewConversation, setPendingNewConversation] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isChatMode = messages.length > 0 || isGenerating;

  const filteredCommands = useMemo(() => {
    if (!commandPrefix) return [];
    return COMMANDS.filter(cmd =>
      cmd.trigger.toLowerCase().startsWith(commandPrefix.toLowerCase())
    );
  }, [commandPrefix]);

  const canSubmit = query.trim().length > 0 || attachedImages.length > 0;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isChatMode && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatMode]);

  useEffect(() => {
    if (isChatMode) {
      setWindowHeight(Math.min(MAX_CHAT_HEIGHT, Math.max(COLLAPSED_HEIGHT, messages.length * 80 + 150)));
    } else {
      setWindowHeight(COLLAPSED_HEIGHT);
    }
  }, [isChatMode, messages.length]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    
    const words = value.trim().split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('/')) {
      setCommandPrefix(lastWord.slice(1));
      setShowCommandSuggestions(true);
      setHighlightedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setCommandPrefix('');
    }
  }, []);

  const selectCommand = useCallback((trigger: string) => {
    const words = query.split(/\s+/);
    words[words.length - 1] = trigger + ' ';
    setQuery(words.join(' '));
    setShowCommandSuggestions(false);
    setCommandPrefix('');
    inputRef.current?.focus();
  }, [query]);

  const handleTurnComplete = useCallback((userMsg: ChatMessage, assistantMsg: ChatMessage) => {
    const conversationId = `conv-${Date.now()}`;
    setConversations(prev => [{
      id: conversationId,
      title: userMsg.content.slice(0, 50) || 'New conversation',
      updatedAt: new Date(),
      messages: [...messages, userMsg, assistantMsg],
    }, ...prev]);
  }, [messages]);

  const submitQuery = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery && attachedImages.length === 0) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuery,
      quotedText: selectedContext,
      imagePaths: attachedImages.map(img => img.url),
      timestamp: new Date(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setQuery('');
    setSelectedContext(undefined);
    setAttachedImages([]);
    setShowCommandSuggestions(false);
    setIsGenerating(true);
    setWindowHeight(Math.min(MAX_CHAT_HEIGHT, windowHeight + 100));

    if (onSendMessage) {
      onSendMessage(trimmedQuery, selectedContext, attachedImages.map(img => img.url));
    }

    try {
      if (window.electronAPI?.sendChatMessage) {
        const response = await window.electronAPI.sendChatMessage({
          message: trimmedQuery,
          context: selectedContext,
          images: attachedImages.map(img => img.url),
        });
        
        if (response?.content) {
          setMessages(prev => prev.map(m => 
            m.id === assistantId 
              ? { ...m, content: response.content, isStreaming: false }
              : m
          ));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setMessages(prev => prev.map(m => 
          m.id === assistantId 
            ? { ...m, content: `I received your message. This is Comet AI - your intelligent assistant.`, isStreaming: false }
            : m
        ));
      }
    } catch (error) {
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
          : m
      ));
    } finally {
      setIsGenerating(false);
      handleTurnComplete(userMessage, { ...assistantMessage, content: '', isStreaming: false });
    }
  }, [query, selectedContext, attachedImages, onSendMessage, windowHeight, handleTurnComplete]);

  const cancelGeneration = useCallback(() => {
    setIsGenerating(false);
    setMessages(prev => prev.filter(m => !m.isStreaming));
  }, []);

  const startNewConversation = useCallback(() => {
    if (messages.length > 0 && !conversations.find(c => c.messages.length === messages.length)) {
      setPendingNewConversation(true);
      setIsHistoryOpen(true);
      return;
    }
    setMessages([]);
    setQuery('');
    setAttachedImages([]);
    setSelectedContext(undefined);
    setSessionId(prev => prev + 1);
  }, [messages, conversations]);

  const loadConversation = useCallback((conv: ConversationSummary) => {
    setMessages(conv.messages);
    setIsHistoryOpen(false);
    setPendingNewConversation(false);
    setSessionId(prev => prev + 1);
  }, []);

  const saveConversation = useCallback(() => {
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'w')) {
      e.preventDefault();
      onClose();
      return;
    }

    if (showCommandSuggestions && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedCommandIndex(prev =>
          (prev + 1) % filteredCommands.length
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedCommandIndex(prev =>
          (prev - 1 + filteredCommands.length) % filteredCommands.length
        );
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && highlightedCommandIndex < filteredCommands.length)) {
        e.preventDefault();
        selectCommand(filteredCommands[highlightedCommandIndex].trigger);
        return;
      }
      if (e.key === 'Escape') {
        setShowCommandSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery();
    }
  }, [showCommandSuggestions, filteredCommands, highlightedCommandIndex, selectCommand, submitQuery, onClose]);

  const handleScreenshot = useCallback(() => {
    if (window.electronAPI?.captureScreen) {
      window.electronAPI.captureScreen().then((result: { success: boolean; path?: string; error?: string }) => {
        if (result.success && result.path) {
          const newImage = {
            id: `img-${Date.now()}`,
            url: `file://${result.path}`,
          };
          setAttachedImages(prev => [...prev, newImage]);
        }
      });
    }
  }, []);

  const handleImageAttach = useCallback((files: FileList | null) => {
    if (!files || attachedImages.length >= MAX_IMAGES) return;
    
    const remaining = MAX_IMAGES - attachedImages.length;
    const newImages: { id: string; url: string; file?: File }[] = [];
    
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          id: `img-${Date.now()}-${i}`,
          url: URL.createObjectURL(file),
          file,
        });
      }
    }
    
    setAttachedImages(prev => [...prev, ...newImages]);
  }, [attachedImages.length]);

  const removeImage = useCallback((id: string) => {
    setAttachedImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.url) URL.revokeObjectURL(img.url);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const copyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleImageAttach(e.dataTransfer?.files ?? null);
  }, [handleImageAttach]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-[600px] px-4"
      style={{ height: windowHeight }}
    >
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`thuki-container h-full flex flex-col bg-[rgba(20,20,20,0.85)] backdrop-blur-2xl border border-white/10 overflow-hidden transition-all duration-300 ${
          isChatMode ? 'rounded-xl shadow-2xl' : 'rounded-2xl shadow-xl'
        }`}
      >
        {!isChatMode && (
          <div className="flex-1 flex flex-col justify-end p-4">
            <div className="max-w-md mx-auto w-full space-y-3">
              {selectedContext && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 bg-white/5 rounded-xl text-sm italic text-white/60"
                >
                  &ldquo;{selectedContext.slice(0, 200)}&rdquo;
                </motion.div>
              )}

              {attachedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {attachedImages.map(img => (
                    <div key={img.id} className="relative shrink-0">
                      <img src={img.url} alt="Attached" className="w-14 h-14 object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {showCommandSuggestions && filteredCommands.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black/40 rounded-xl overflow-hidden border border-white/10"
                  >
                    {filteredCommands.map((cmd, index) => (
                      <button
                        key={cmd.trigger}
                        onClick={() => selectCommand(cmd.trigger)}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                          index === highlightedCommandIndex ? 'bg-white/10' : ''
                        }`}
                      >
                        <span className="text-white/60">{cmd.icon}</span>
                        <span className="font-mono text-sm text-white">{cmd.trigger}</span>
                        <span className="text-sm text-white/50">{cmd.description}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Sparkles size={18} className="text-purple-400" />
                </div>

                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Clock size={14} />
                </button>

                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Comet anything..."
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 resize-none"
                  style={{ caretColor: '#a855f7' }}
                />

                <button
                  onClick={handleScreenshot}
                  disabled={attachedImages.length >= MAX_IMAGES}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  <Camera size={14} />
                </button>

                <motion.button
                  onClick={isGenerating ? cancelGeneration : submitQuery}
                  disabled={!canSubmit && !isGenerating}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    isGenerating
                      ? 'bg-red-500/10 text-red-400'
                      : canSubmit
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {isGenerating ? <Square size={14} /> : <ArrowUp size={14} />}
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {isChatMode && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              >
                <Minimize2 size={14} className="text-white/60" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Clock size={14} className="text-white/60" />
                </button>
                <button
                  onClick={startNewConversation}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Plus size={14} className="text-white/60" />
                </button>
                <button
                  onClick={saveConversation}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Bookmark size={14} className="text-white/60" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onCopy={copyMessage}
                  copiedId={copiedMessageId}
                />
              ))}

              {isGenerating && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-purple-400 rounded-full"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  <span className="text-white/50">Comet is thinking...</span>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-white/10">
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Sparkles size={14} className="text-purple-400" />
                </div>

                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply..."
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 resize-none"
                  style={{ caretColor: '#a855f7' }}
                />

                <button
                  onClick={isGenerating ? cancelGeneration : submitQuery}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                    isGenerating ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                >
                  {isGenerating ? <Square size={12} /> : <ArrowUp size={12} />}
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 overflow-hidden"
            >
              <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                {pendingNewConversation && (
                  <div className="p-3 bg-amber-500/10 rounded-lg text-xs text-amber-400 mb-2">
                    Save current conversation first?
                  </div>
                )}
                {conversations.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4">No conversations yet</p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors"
                    >
                      <p className="text-sm text-white truncate">{conv.title}</p>
                      <p className="text-xs text-white/40">
                        {conv.updatedAt.toLocaleDateString()} • {conv.messages.length} messages
                      </p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface ChatBubbleProps {
  message: ChatMessage;
  onCopy: (id: string, content: string) => void;
  copiedId: string | null;
}

function ChatBubble({ message, onCopy, copiedId }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-purple-400" />
        </div>
      )}

      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
        {message.quotedText && (
          <div className="px-3 py-1.5 bg-white/5 rounded-lg text-xs italic text-white/50">
            &ldquo;{message.quotedText}&rdquo;
          </div>
        )}

        {message.imagePaths && message.imagePaths.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {message.imagePaths.map((path, i) => (
              <img key={i} src={path} alt="Attachment" className="max-w-32 max-h-32 object-cover rounded-lg" />
            ))}
          </div>
        )}

        <div className={`group relative px-4 py-2.5 rounded-2xl text-sm ${
          isUser
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md'
            : 'bg-white/10 text-white rounded-bl-md'
        }`}>
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
          )}
          
          {!isStreaming && message.content && (
            <button
              onClick={() => onCopy(message.id, message.content)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
            >
              {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <ImageIcon size={14} className="text-white/60" />
        </div>
      )}
    </motion.div>
  );
}

export { ThukiAssistant };
