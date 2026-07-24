export type MessageRole = 'system' | 'user' | 'assistant' | 'model';

export interface CompactedMessage {
  role: MessageRole;
  content: string;
}

export interface CompactionOptions {
  maxTokens: number;
  preserveSystem: boolean;
  preserveRecentCount: number;
  summarizationThreshold: number;
}

const DEFAULT_OPTIONS: CompactionOptions = {
  maxTokens: 128000,
  preserveSystem: true,
  preserveRecentCount: 6,
  summarizationThreshold: 4000,
};

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      tokens += code <= 32 || code > 126 ? 0.25 : 0.4;
    } else if (code < 2048) {
      tokens += 0.6;
    } else {
      tokens += 0.8;
    }
  }
  return Math.ceil(tokens);
}

export function estimateMessagesTokens(
  messages: { role: string; content: string }[]
): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    total += 4;
  }
  return total;
}

function compactConversationMidSection(
  messages: CompactedMessage[],
  recentCount: number
): string {
  const middle = messages.slice(0, messages.length - recentCount);
  if (middle.length === 0) return '';

  const summaries: string[] = [];
  let currentBlock: CompactedMessage[] = [];
  let blockTokens = 0;

  for (const msg of middle) {
    const msgTokens = estimateTokens(msg.content) + 4;
    if (blockTokens + msgTokens > 2000 && currentBlock.length > 0) {
      summaries.push(summarizeBlock(currentBlock));
      currentBlock = [msg];
      blockTokens = msgTokens;
    } else {
      currentBlock.push(msg);
      blockTokens += msgTokens;
    }
  }
  if (currentBlock.length > 0) {
    summaries.push(summarizeBlock(currentBlock));
  }

  const compacted = `[COMPRESSED CONVERSATION HISTORY — earlier messages summarized below]\n${summaries.join('\n')}\n[END OF COMPRESSED HISTORY]\n\nThe following are the most recent messages in full:`;

  if (estimateTokens(compacted) > estimateTokens(
    middle.map(m => `${m.role}: ${m.content}`).join('\n')
  )) {
    return middle.map(m => m.content).join('\n\n');
  }

  return compacted;
}

function summarizeBlock(block: CompactedMessage[]): string {
  const userMsgs = block.filter(m => m.role === 'user').map(m => m.content);
  const assistantMsgs = block.filter(m => m.role === 'assistant' || m.role === 'model').map(m => m.content);

  const parts: string[] = [];
  if (userMsgs.length > 0) {
    const lastUserMsg = userMsgs[userMsgs.length - 1];
    const truncated = lastUserMsg.length > 300 ? lastUserMsg.slice(0, 300) + '...' : lastUserMsg;
    parts.push(`User asked: "${truncated}"`);
  }
  if (assistantMsgs.length > 0) {
    const lastAsstMsg = assistantMsgs[assistantMsgs.length - 1];
    const truncated = lastAsstMsg.length > 300 ? lastAsstMsg.slice(0, 300) + '...' : lastAsstMsg;
    const preview = truncated.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    parts.push(`AI responded: "${preview.slice(0, 200)}"`);
  }
  if (parts.length === 0) return '[Empty exchange]';
  return `- ${parts.join(' → ')}`;
}

export function compactMessages(
  messages: { role: string; content: string }[],
  options: Partial<CompactionOptions> = {}
): CompactedMessage[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (messages.length === 0) return [];

  const totalTokens = estimateMessagesTokens(messages);
  if (totalTokens <= opts.maxTokens) {
    return messages as CompactedMessage[];
  }

  const systemMessages: CompactedMessage[] = [];
  const nonSystem: CompactedMessage[] = [];

  for (const msg of messages) {
    if (opts.preserveSystem && msg.role === 'system') {
      systemMessages.push(msg as CompactedMessage);
    } else {
      nonSystem.push(msg as CompactedMessage);
    }
  }

  if (nonSystem.length <= opts.preserveRecentCount + 1) {
    return messages as CompactedMessage[];
  }

  const recentMessages = nonSystem.slice(-opts.preserveRecentCount);
  const compactedContent = compactConversationMidSection(nonSystem, opts.preserveRecentCount);

  if (compactedContent.startsWith('[COMPRESSED CONVERSATION HISTORY')) {
    const compactedMessages: CompactedMessage[] = [
      ...systemMessages,
      { role: 'system', content: compactedContent },
      ...recentMessages,
    ];

    if (estimateMessagesTokens(compactedMessages) <= opts.maxTokens) {
      return compactedMessages;
    }

    return truncateMessages(compactedMessages, opts.maxTokens);
  }

  return messages as CompactedMessage[];
}

function truncateMessages(
  messages: CompactedMessage[],
  maxTokens: number
): CompactedMessage[] {
  const result: CompactedMessage[] = [];
  let total = 0;

  for (const msg of messages) {
    const tokens = estimateTokens(msg.content) + 4;
    if (total + tokens > maxTokens) {
      const available = maxTokens - total - 4;
      if (available > 100) {
        result.push({
          ...msg,
          content: msg.content.slice(0, Math.floor(available * 4)) + '\n\n[TRUNCATED]',
        });
      }
      break;
    }
    result.push(msg);
    total += tokens;
  }

  return result;
}
