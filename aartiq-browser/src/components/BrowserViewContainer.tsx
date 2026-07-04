"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowserViewContainerProps {
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
  omnibarUrl: string;
}

const BrowserViewContainer: React.FC<BrowserViewContainerProps> = ({ initialUrl = 'https://www.google.com', onUrlChange, omnibarUrl }) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    if (window.electronAPI) {
      setIsElectron(true);
      window.electronAPI.navigateTo(initialUrl);

      // Event-based URL monitoring instead of polling
      const removeUrlListener = window.electronAPI.onBrowserViewUrlChanged(({ url }: { url: string }) => {
        if (isMounted.current && url && url !== currentUrl) {
          setCurrentUrl(url);
          onUrlChange?.(url);

          // Neural Indexing - Debounced to ensure page stability
          // Clearing previous timeout is implied by local closure
          setTimeout(async () => {
            if (window.electronAPI) {
              const extraction = await window.electronAPI.extractPageContent();
              if (extraction.content) {
                const { BrowserAI } = await import('@/lib/BrowserAI');
                await BrowserAI.addToVectorMemory(extraction.content, {
                  url,
                  timestamp: Date.now(),
                  type: 'page_content'
                });
                console.log(`[Neural Index] Synchronized: ${url}`);
              }
            }
          }, 3000);
        }
      });

      setTimeout(() => setIsLoading(false), 800);
      return () => {
        isMounted.current = false;
        removeUrlListener();
      };
    } else {
      // Web Fallback
      setIsElectron(false);
      setIsLoading(false);
      setCurrentUrl(initialUrl);
    }
  }, [initialUrl, onUrlChange]);

  const prevOmnibarUrl = useRef(omnibarUrl);

  const normalizeUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin + u.pathname + (u.search || '');
    } catch (e) {
      return url.replace(/\/$/, '');
    }
  };

  useEffect(() => {
    const normalizedOmni = normalizeUrl(omnibarUrl);
    const normalizedCurrent = normalizeUrl(currentUrl);

    if (omnibarUrl && normalizedOmni !== normalizedCurrent && omnibarUrl !== prevOmnibarUrl.current) {
      prevOmnibarUrl.current = omnibarUrl;
      console.log(`[BrowserView] Omnibar Navigation: ${omnibarUrl}`);
      if (window.electronAPI) {
        window.electronAPI.navigateTo(omnibarUrl);
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 800);
      } else {
        setCurrentUrl(omnibarUrl);
      }
    }
  }, [omnibarUrl, currentUrl]);

return (
    <div className="w-full h-full relative overflow-hidden bg-[#050510] z-[1]">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] text-deep-space-text"
          >
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-deep-space-accent-neon/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-deep-space-accent-neon rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-medium tracking-widest uppercase animate-pulse">Navigating</p>
          </motion.div>
        )}
      </AnimatePresence>

      {isElectron ? (
        <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none opacity-10">
          <span className="text-6xl mb-4">🖥️</span>
          <p className="text-white/40 text-sm font-light">Desktop View Rendering...</p>
        </div>
      ) : (
        <iframe
          src={currentUrl}
          className="w-full h-full border-0 bg-white"
          title="Browser Content"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      )}
    </div>
  );
};

export default BrowserViewContainer;
