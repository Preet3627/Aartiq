/**
 * Comet AI Hook - Custom hook for AI interactions
 * Adapted from Thuki by Logan Nguyen (Apache 2.0)
 * Modified to work with Comet AI instead of Ollama/Tauri
 */

import { useState, useCallback } from 'react';

export type OllamaErrorKind = 'NotRunning' | 'ModelNotFound' | 'Other';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  quotedText?: string;
  imagePaths?: string[];
  errorKind?: OllamaErrorKind;
  thinkingContent?: string;
}

export type StreamChunk =
  | { type: 'Token'; data: string }
  | { type: 'ThinkingToken'; data: string }
  | { type: 'Done' }
  | { type: 'Cancelled' }
  | { type: 'Error'; data: { kind: OllamaErrorKind; message: string } };

/**
 * Custom hook for Comet AI sidebar interactions.
 * Manages message history, streaming state, and Electron IPC communication.
 */
export function useCometAI(
  onTurnComplete?: (userMsg: Message, assistantMsg: Message) => void,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const ask = useCallback(
    async (
      displayContent: string,
      quotedText?: string,
      imagePaths?: string[],
      think?: boolean,
    ) => {
      if (
        (!displayContent.trim() && (!imagePaths || imagePaths.length === 0)) ||
        isGenerating
      )
        return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: displayContent,
        quotedText,
        imagePaths:
          imagePaths && imagePaths.length > 0 ? imagePaths : undefined,
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsGenerating(true);

      try {
        if (window.electronAPI?.sendChatMessage) {
          const response = await window.electronAPI.sendChatMessage({
            message: displayContent,
            context: quotedText,
            images: imagePaths,
            think,
          });

          if (response?.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: response.content }
                  : m,
              ),
            );
            onTurnComplete?.(userMsg, { ...assistantMsg, content: response.content });
          } else if (response?.error) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${response.error}`, errorKind: 'Other' as const }
                  : m,
              ),
            );
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const response = `This is Comet AI - your intelligent assistant. I received your message: "${displayContent}"`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: response } : m,
            ),
          );
          onTurnComplete?.(userMsg, { ...assistantMsg, content: response });
        }
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong. Please try again.', errorKind: 'Other' as const }
              : m,
          ),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [isGenerating, onTurnComplete],
  );

  const cancel = useCallback(async () => {
    if (!isGenerating) return;
    if (window.electronAPI?.cancelChat) {
      await window.electronAPI.cancelChat();
    }
    setMessages((prev) => prev.filter(m => m.role === 'user'));
    setIsGenerating(false);
  }, [isGenerating]);

  const reset = useCallback(() => {
    setMessages([]);
    setIsGenerating(false);
  }, []);

  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
    setIsGenerating(false);
  }, []);

  return {
    messages,
    ask,
    cancel,
    isGenerating,
    reset,
    loadMessages,
  };
}
