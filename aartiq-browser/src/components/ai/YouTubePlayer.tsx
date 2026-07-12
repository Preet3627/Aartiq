import React, { useRef, useState, useEffect, memo } from 'react';
import { Play, X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

const YouTubePlayer = memo(function YouTubePlayer({ videoId, title, onClose, autoPlay = true }: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
  }, [videoId]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError(true);
  };

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}&rel=0&modestbranding=1`;

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-black/50 ${isExpanded ? 'fixed inset-4 z-[9999] flex items-center justify-center' : ''}`}>
      <div className={`relative ${isExpanded ? 'w-full max-w-5xl mx-auto' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">YouTube</span>
            {title && (
              <span className="text-xs text-white/50 truncate ml-1">{title}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.electronAPI?.createView?.({ tabId: `yt-${Date.now()}`, url: watchUrl })}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title="Open in browser"
            >
              <ExternalLink size={14} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Player */}
        <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-red-500/50 border-t-red-500 rounded-full animate-spin" />
                <span className="text-xs text-white/40">Loading player...</span>
              </div>
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                <Play size={24} className="text-red-400 ml-1" />
              </div>
              <p className="text-sm text-white/60">Failed to load video</p>
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white/10 text-xs text-white/80 hover:bg-white/20 transition-colors"
              >
                Open on YouTube instead
              </a>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={embedUrl}
              className="w-full h-full"
              style={{ aspectRatio: '16/9' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={title || 'YouTube Video'}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default YouTubePlayer;
