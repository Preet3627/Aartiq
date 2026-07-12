"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, X, ExternalLink, Copy, Check, Terminal, Settings, FolderOpen, Download, Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface McpSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

type Platform = 'mac' | 'win' | 'linux' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const p = navigator.platform || '';
  if (p.includes('Mac')) return 'mac';
  if (p.includes('Win')) return 'win';
  if (p.includes('Linux')) return 'linux';
  return 'unknown';
}

function getConfigPath(platform: Platform): string {
  switch (platform) {
    case 'mac': return '~/Library/Application Support/Claude/claude_desktop_config.json';
    case 'win': return '%APPDATA%\\Claude\\claude_desktop_config.json';
    case 'linux': return '~/.config/Claude/claude_desktop_config.json';
    default: return '~/.claude/claude_desktop_config.json';
  }
}

const McpSetupGuide = ({ isOpen, onClose }: McpSetupGuideProps) => {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [autoStatus, setAutoStatus] = useState<'idle' | 'writing' | 'done' | 'error'>('idle');
  const [autoResult, setAutoResult] = useState<string>('');
  useEffect(() => {
    if (isOpen) {
      setPlatform(detectPlatform());
      setAutoStatus('idle');
      setAutoResult('');
    }
  }, [isOpen]);

  const configPath = getConfigPath(platform);

  const handleAutoConfigure = useCallback(async () => {
    setAutoStatus('writing');
    setAutoResult('');
    try {
      if (window.electronAPI?.autoConfigureClaudeMcp) {
        const res = await window.electronAPI.autoConfigureClaudeMcp();
        if (res.success) {
          setAutoStatus('done');
          setAutoResult(`Config written to:\n${res.path}`);
        } else {
          setAutoStatus('error');
          setAutoResult(res.error || 'Unknown error');
        }
      } else {
        setAutoStatus('error');
        setAutoResult('electronAPI not available');
      }
    } catch (e: any) {
      setAutoStatus('error');
      setAutoResult(e.message || 'Failed to auto-configure');
    }
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'var(--overlay-bg, rgba(0,0,0,0.75))' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-auto overflow-hidden rounded-[2.5rem] border shadow-2xl max-h-[90vh] flex flex-col"
            style={{
              background: 'color-mix(in srgb, var(--primary-bg) 88%, transparent)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              borderColor: 'var(--border-color)',
              boxShadow: '0 25px 80px var(--shadow-color)',
            }}
          >
            <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none" style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 50%, color-mix(in srgb, var(--accent-light) 3%, transparent))',
            }} />

            <div className="relative p-6 sm:p-8 overflow-y-auto flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
                  >
                    <Server size={22} style={{ color: 'var(--accent)' }} />
                  </motion.div>
                  <div>
                    <motion.h2
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-lg font-bold"
                      style={{ color: 'var(--primary-text)' }}
                    >
                      Claude Desktop Setup
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-xs mt-0.5"
                      style={{ color: 'var(--secondary-text)' }}
                    >
                      Connect Claude to control Aartiq Browser
                    </motion.p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-xl transition-all shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--border-color) 50%, transparent)', color: 'var(--secondary-text)' }}
                >
                  <X size={16} />
                </motion.button>
              </div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="grid grid-cols-2 gap-3 mb-6"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.electronAPI?.openExternalUrl('https://claude.ai/download')}
                  className="flex items-center gap-2.5 p-4 rounded-2xl border transition-all text-left"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
                  }}
                >
                  <Download size={18} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div className="text-xs font-bold" style={{ color: 'var(--primary-text)' }}>Download</div>
                    <div className="text-[9px] mt-0.5" style={{ color: 'var(--secondary-text)' }}>Claude Desktop</div>
                  </div>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const dirs: Record<string, string> = {
                      mac: '~/Library/Application Support/Claude',
                      win: '%APPDATA%\\Claude',
                      linux: '~/.config/Claude',
                    };
                    window.electronAPI?.openExternalUrl?.('https://claude.ai/download');
                  }}
                  className="flex items-center gap-2.5 p-4 rounded-2xl border transition-all text-left"
                  style={{
                    background: 'color-mix(in srgb, var(--border-color) 30%, transparent)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <FolderOpen size={18} style={{ color: 'var(--secondary-text)' }} />
                  <div>
                    <div className="text-xs font-bold" style={{ color: 'var(--primary-text)' }}>Open Folder</div>
                    <div className="text-[9px] mt-0.5" style={{ color: 'var(--secondary-text)' }}>Config directory</div>
                  </div>
                </motion.button>
              </motion.div>

              {/* Platform Info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-2xl mb-4"
                style={{
                  background: 'color-mix(in srgb, var(--primary-bg) 50%, black)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={12} style={{ color: 'var(--secondary-text)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--secondary-text)' }}>Detected Platform</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    color: 'var(--accent)',
                  }}>
                    {platform === 'mac' ? 'macOS' : platform === 'win' ? 'Windows' : platform === 'linux' ? 'Linux' : 'Unknown'}
                  </span>
                </div>
                <p className="text-xs font-mono truncate" style={{ color: 'var(--accent)' }}>
                  {configPath}
                </p>
              </motion.div>

              {/* Auto-Configure Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-4"
              >
                <motion.button
                  whileHover={autoStatus === 'idle' ? { scale: 1.01 } : {}}
                  whileTap={autoStatus === 'idle' ? { scale: 0.98 } : {}}
                  onClick={handleAutoConfigure}
                  disabled={autoStatus === 'writing'}
                  className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl border text-sm font-bold transition-all disabled:opacity-70"
                  style={{
                    background: autoStatus === 'done'
                      ? 'color-mix(in srgb, #22c55e 15%, transparent)'
                      : autoStatus === 'error'
                        ? 'color-mix(in srgb, #ef4444 15%, transparent)'
                        : 'var(--accent)',
                    borderColor: autoStatus === 'done'
                      ? 'color-mix(in srgb, #22c55e 30%, transparent)'
                      : autoStatus === 'error'
                        ? 'color-mix(in srgb, #ef4444 30%, transparent)'
                        : 'transparent',
                    color: autoStatus === 'done' ? '#22c55e' : autoStatus === 'error' ? '#ef4444' : 'var(--primary-bg)',
                  }}
                >
                  {autoStatus === 'writing' ? (
                    <><Loader2 size={18} className="animate-spin" /> Writing config file...</>
                  ) : autoStatus === 'done' ? (
                    <><CheckCircle2 size={18} /> Config installed! Restart Claude Desktop</>
                  ) : autoStatus === 'error' ? (
                    <><AlertCircle size={18} /> Failed: {autoResult || 'Unknown error'}</>
                  ) : (
                    <><Sparkles size={18} /> Auto-Configure Now</>
                  )}
                </motion.button>
                {autoStatus === 'done' && autoResult && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] mt-2 text-center font-mono"
                    style={{ color: 'var(--secondary-text)' }}
                  >
                    {autoResult}
                  </motion.p>
                )}
                {autoStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex gap-2"
                  >
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify({
                        mcpServers: { "aartiq-browser": { type: "sse", url: "http://localhost:3001/sse" } }
                      }, null, 2))}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold transition-all"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--secondary-text)' }}
                    >
                      <Copy size={14} /> Copy Config Manually
                    </button>
                    <button
                      onClick={handleAutoConfigure}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold transition-all"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--secondary-text)' }}
                    >
                      <RefreshCw size={14} /> Retry
                    </button>
                  </motion.div>
                )}
              </motion.div>

              {/* Post-setup hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="p-3 rounded-xl text-center"
                style={{ background: 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
              >
                <p className="text-[10px] leading-relaxed" style={{ color: 'var(--secondary-text)' }}>
                  After setup, restart Claude Desktop and look for the plug icon.{' '}
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>Try: "List my browser tabs"</span>
                </p>
              </motion.div>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-4 flex items-center justify-center gap-4"
              >
                <button
                  onClick={() => {
                    onClose();
                    window.electronAPI?.openSettingsPopup?.('mcp');
                  }}
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium transition-all hover:underline"
                  style={{ color: 'var(--secondary-text)' }}
                >
                  <Settings size={12} /> MCP Settings
                </button>
                <button
                  onClick={() => window.electronAPI?.openExternalUrl('https://docs.anthropic.com/en/docs/claude-desktop')}
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium transition-all hover:underline"
                  style={{ color: 'var(--secondary-text)' }}
                >
                  <ExternalLink size={12} /> Official Docs
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default McpSetupGuide;
