/**
 * PDF Generation Manager Hook
 * Manages PDF generation state and provides a clean API for the AI to trigger PDFs
 */

import { useState, useCallback } from 'react';
import { robustJSONParse } from '../components/ai/RobustParsers';

export interface PDFGenerationRequest {
  title: string;
  content: string;
  subtitle?: string;
  author?: string;
  screenshot?: boolean;
  attachments?: boolean;
  liveData?: boolean;
  slides?: boolean;
}

export interface PDFGenerationState {
  isGenerating: boolean;
  request: PDFGenerationRequest | null;
  progress: number;
  stage: string;
  message: string;
  result: { success: boolean; filePath?: string; error?: string } | null;
}

let globalPDFCallback: ((request: PDFGenerationRequest) => void) | null = null;

export function setGlobalPDFCallback(callback: (request: PDFGenerationRequest) => void) {
  globalPDFCallback = callback;
}

export function triggerPDFGeneration(request: PDFGenerationRequest) {
  if (globalPDFCallback) {
    globalPDFCallback(request);
  }
}

// Legacy format parser - converts [GENERATE_PDF: ...] to structured request
export function parsePDFCommand(commandString: string): PDFGenerationRequest | null {
  try {
    // Try JSON format first
    const robustResult = robustJSONParse(commandString);
    if (robustResult.success) {
      const parsed = robustResult.data;
      if (parsed.type === 'PDF' || parsed.command === 'GENERATE_PDF') {
        return {
          title: parsed.options?.title || parsed.title || 'Document',
          content: parsed.options?.content || parsed.content || '',
          subtitle: parsed.options?.subtitle,
          author: parsed.options?.author,
          screenshot: parsed.options?.screenshot || parsed.screenshot,
          attachments: parsed.options?.attachments,
          liveData: parsed.options?.liveData,
          slides: parsed.options?.slides,
        };
      }
    }

    // Parse tag format: [GENERATE_PDF: title | key:value | key:value | content...]
    const match = commandString.match(/\[GENERATE_PDF\s*:\s*([^\]]+)\]/i);
    if (!match) return null;

    const content = match[1];
    const parts = content.split('|').map(p => p.trim());
    
    const request: PDFGenerationRequest = {
      title: 'Document',
      content: '',
    };

    for (const part of parts) {
      const keyValueMatch = part.match(/^(\w+)\s*:\s*(.+)$/i);
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch;
        const lowerKey = key.toLowerCase();
        const boolValue = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
        
        switch (lowerKey) {
          case 'title':
            request.title = value;
            break;
          case 'subtitle':
            request.subtitle = value;
            break;
          case 'author':
            request.author = value;
            break;
          case 'screenshot':
            request.screenshot = boolValue;
            break;
          case 'attachments':
            request.attachments = boolValue;
            break;
          case 'livedata':
            request.liveData = boolValue;
            break;
          case 'slides':
            request.slides = boolValue;
            break;
        }
      } else if (!request.content && part.length > 0) {
        // First non-key-value part is likely the title or content
        if (!request.title || request.title === 'Document') {
          request.title = part;
        } else {
          request.content = part;
        }
      }
    }

    // If content is still empty, use a placeholder
    if (!request.content) {
      request.content = `[Content will be generated from web search results]`;
    }

    return request;
  } catch {
    return null;
  }
}

export function usePDFGenerationManager() {
  const [state, setState] = useState<PDFGenerationState>({
    isGenerating: false,
    request: null,
    progress: 0,
    stage: 'idle',
    message: '',
    result: null,
  });

  const startGeneration = useCallback((request: PDFGenerationRequest) => {
    setState({
      isGenerating: true,
      request,
      progress: 0,
      stage: 'parsing',
      message: 'Parsing content...',
      result: null,
    });
  }, []);

  const updateProgress = useCallback((stage: string, progress: number, message: string) => {
    setState(prev => ({
      ...prev,
      stage,
      progress,
      message,
    }));
  }, []);

  const completeGeneration = useCallback((result: { success: boolean; filePath?: string; error?: string }) => {
    setState(prev => ({
      ...prev,
      isGenerating: false,
      progress: 100,
      stage: result.success ? 'complete' : 'error',
      message: result.success ? 'PDF Generated Successfully!' : result.error || 'Generation Failed',
      result,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      request: null,
      progress: 0,
      stage: 'idle',
      message: '',
      result: null,
    });
  }, []);

  return {
    state,
    startGeneration,
    updateProgress,
    completeGeneration,
    reset,
    triggerPDF: startGeneration,
  };
}
