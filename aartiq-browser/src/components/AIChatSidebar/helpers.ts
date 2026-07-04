import type { ExtendedChatMessage } from './types';
import type { AICommand } from '../AICommandQueue';

export const buildConversationTitle = (messages: ExtendedChatMessage[]): string => {
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

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

export const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const areCommandsSettled = (commands: AICommand[]): boolean => (
  commands.length === 0
  || commands.every((command) => command.status === 'completed' || command.status === 'failed')
);

export const getCommandAttemptSignature = (command: Pick<AICommand, 'type' | 'value'>): string => (
  `${command.type}:${`${command.value || ''}`.replace(/\s+/g, ' ').trim().toLowerCase()}`
);
