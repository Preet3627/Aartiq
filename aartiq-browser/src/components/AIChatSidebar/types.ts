import type { ChatMessage } from '../ai/ConversationHistoryPanel';
import type { ThinkingStep } from '../ai/ThinkingPanel';

export type { ChatMessage, Conversation } from '../ai/ConversationHistoryPanel';
export type { ThinkingStep } from '../ai/ThinkingPanel';

export type MediaItem = {
  id?: string;
  type: 'image';
  url: string;
  caption?: string;
  title?: string;
  description?: string;
  downloadPath?: string;
} | {
  type: 'video';
  videoUrl: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  source: 'youtube' | 'other';
  videoId?: string;
} | {
  type: 'mermaid';
  diagramId: string;
  code: string;
} | {
  type: 'flowchart';
  diagramId: string;
  code: string;
} | {
  type: 'chart';
  chartId: string;
  data: {
    labels?: string[];
    datasets: Array<{
      label?: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
    }>;
  };
  options?: {
    type?: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
    title?: string;
    colors?: string[];
  };
};

export type ExtendedChatMessage = ChatMessage & {
  timestamp?: number;
  attachments?: string[];
  isOcr?: boolean;
  ocrLabel?: string;
  ocrText?: string;
  thinkingSteps?: ThinkingStep[];
  thinkText?: string;
  actionLogs?: { type: string, output: string, success: boolean }[];
  mediaItems?: MediaItem[];
};

export type VisualStage = 'idle' | 'fetching' | 'capturing';

export interface Attachment {
  type: 'image' | 'pdf';
  data: string;
  ocrText?: string;
  filename: string;
}

export interface FileAttachment {
  file: File;
  preview?: string;
  ocrText?: string;
}

export type MessageSource = 'user' | 'ai' | 'system';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AIChatState {
  messages: ExtendedChatMessage[];
  input: string;
  isLoading: boolean;
  error: string | null;
  showCapabilities: boolean;
  showHistory: boolean;
  showSettings: boolean;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: unknown;
}

export interface ParsedAICommand {
  command: string;
  params: Record<string, unknown>;
  confidence: number;
}

export interface SchedulingOptions {
  time: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  model?: string;
  outputPath?: string;
  notifyDesktop?: boolean;
  notifyMobile?: boolean;
}

export interface DOMClickTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  tagName: string;
  textContent?: string;
  attributes?: Record<string, string>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PermissionRequest {
  command: string;
  riskLevel: RiskLevel;
  description: string;
  requiresConfirmation: boolean;
}

export type RefusedIntent = 'credential_login' | 'session_export' | 'file_exfiltration';
export interface RefusedIntentRecord {
  intent: RefusedIntent;
  site?: string;
  timestamp: number;
}
