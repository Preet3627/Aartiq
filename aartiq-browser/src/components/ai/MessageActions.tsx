import React, { memo } from 'react';
import { CopyIcon, Check, Share2 } from 'lucide-react';

interface MessageActionsProps {
  content: string;
  index: number;
  copiedIndex: number | null;
  onCopy: (content: string, index: number) => void;
  onShare: (content: string) => void;
}

const MessageActions = memo(function MessageActions({
  content,
  index,
  copiedIndex,
  onCopy,
  onShare,
}: MessageActionsProps) {
  const isCopied = copiedIndex === index;
  return (
    <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onCopy(content, index)}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        title={isCopied ? 'Copied!' : 'Copy message'}
      >
        {isCopied ? <Check size={14} /> : <CopyIcon size={14} />}
      </button>
      <button
        onClick={() => onShare(content)}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        title="Share message"
      >
        <Share2 size={14} />
      </button>
    </div>
  );
});

export default MessageActions;
