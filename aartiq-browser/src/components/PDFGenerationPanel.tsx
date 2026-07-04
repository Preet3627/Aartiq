"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, FileText, Download, Loader2, CheckCircle2, AlertCircle, 
  Settings, Image, Zap, Clock, FileBarChart, ChevronDown, ChevronUp
} from 'lucide-react';

export interface PDFGenerationOptions {
  title: string;
  subtitle?: string;
  author?: string;
  content: string;
  screenshot?: boolean;
  attachments?: boolean;
  liveData?: boolean;
  slides?: boolean;
}

export interface PDFGenerationProgress {
  stage: 'idle' | 'parsing' | 'preparing' | 'rendering' | 'generating' | 'saving' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: string;
  filePath?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  error?: string;
}

interface PDFGenerationPanelProps {
  isOpen: boolean;
  options: PDFGenerationOptions | null;
  onClose: () => void;
  onComplete: (result: PDFGenerationResult) => void;
}

const STAGE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  idle: { icon: <FileText size={16} />, color: 'text-white/40', label: 'Ready' },
  parsing: { icon: <Settings size={16} />, color: 'text-sky-400', label: 'Parsing Content' },
  preparing: { icon: <FileBarChart size={16} />, color: 'text-purple-400', label: 'Preparing Template' },
  rendering: { icon: <Image size={16} />, color: 'text-violet-400', label: 'Rendering' },
  generating: { icon: <Loader2 size={16} className="animate-spin" />, color: 'text-amber-400', label: 'Generating PDF' },
  saving: { icon: <Download size={16} />, color: 'text-green-400', label: 'Saving to Disk' },
  complete: { icon: <CheckCircle2 size={16} />, color: 'text-green-400', label: 'Complete' },
  error: { icon: <AlertCircle size={16} />, color: 'text-red-400', label: 'Error' },
};

export const PDFGenerationPanel: React.FC<PDFGenerationPanelProps> = ({
  isOpen,
  options,
  onClose,
  onComplete,
}) => {
  const [progress, setProgress] = useState<PDFGenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Waiting for content...',
  });
  const [expandedSection, setExpandedSection] = useState<string | null>('content');

  useEffect(() => {
    if (isOpen && options) {
      generatePDF(options);
    }
  }, [isOpen, options]);

  const generatePDF = useCallback(async (opts: PDFGenerationOptions) => {
    const updateProgress = (stage: PDFGenerationProgress['stage'], progress: number, message: string, details?: string) => {
      setProgress({ stage, progress, message, details });
    };

    try {
      // Stage 1: Parsing
      updateProgress('parsing', 10, 'Parsing content...', `${opts.content.length.toLocaleString()} characters`);
      await new Promise(r => setTimeout(r, 300));

      // Stage 2: Preparing
      updateProgress('preparing', 25, 'Building branded template...', 'Adding header, footer, and styling');
      await new Promise(r => setTimeout(r, 200));

      // Check content size
      if (opts.content.length > 100000) {
        updateProgress('preparing', 30, 'Large content detected...', 'Optimizing for rendering');
      }
      await new Promise(r => setTimeout(r, 300));

      // Stage 3: Rendering
      updateProgress('rendering', 40, 'Loading content into renderer...', 'Preparing browser environment');
      await new Promise(r => setTimeout(r, 200));

      // Build the HTML content
      updateProgress('rendering', 50, 'Building HTML document...', 'Embedding images and styling');
      
      const { buildCleanPDFContent } = await import('./ai/AIUtils');
      const { tryGetIconBase64 } = await import('./ai/AIUtils');
      
      let iconBase64: string | null = null;
      try {
        iconBase64 = tryGetIconBase64();
        if (!iconBase64) {
          const iconPath = '/icon.png';
          const response = await fetch(iconPath);
          if (response.ok) {
            const blob = await response.blob();
            const reader = new FileReader();
            iconBase64 = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }
        }
      } catch (e) {
        console.log('[PDF Panel] Could not load icon');
      }

      const htmlContent = buildCleanPDFContent(
        opts.content,
        opts.title,
        iconBase64
      );

      updateProgress('rendering', 60, 'Content rendered...', `${htmlContent.length.toLocaleString()} HTML characters`);
      await new Promise(r => setTimeout(r, 200));

      // Stage 4: Generating
      updateProgress('generating', 70, 'Converting to PDF...', 'Running printToPDF');

      if (!window.electronAPI?.generatePDF) {
        throw new Error('PDF generation API not available');
      }

      const result = await window.electronAPI.generatePDF(opts.title, htmlContent) as PDFGenerationResult;
      
      // Stage 5: Saving/Saving
      if (result.success) {
        updateProgress('saving', 90, 'Finalizing...', `Saved as ${result.fileName}`);
        await new Promise(r => setTimeout(r, 500));
        updateProgress('complete', 100, 'PDF Generated Successfully!', result.filePath);
        
        setTimeout(() => {
          onComplete(result);
        }, 2000);
      } else {
        updateProgress('error', 0, 'PDF Generation Failed', result.error);
        setTimeout(() => {
          onComplete({ success: false, error: result.error });
        }, 3000);
      }

    } catch (error: any) {
      updateProgress('error', 0, 'Generation Failed', error.message);
      setTimeout(() => {
        onComplete({ success: false, error: error.message });
      }, 3000);
    }
  }, [onComplete]);

  if (!isOpen || !options) return null;

  const config = STAGE_CONFIG[progress.stage];
  const isComplete = progress.stage === 'complete';
  const isError = progress.stage === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && !isComplete && !isError && onClose()}
      >
        <motion.div
          className="w-full max-w-lg bg-gradient-to-br from-[#0a0a12] to-[#12121f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          initial={{ boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' }}
          animate={{ 
            boxShadow: isComplete 
              ? '0 0 60px rgba(34, 197, 94, 0.3)' 
              : isError 
                ? '0 0 60px rgba(239, 68, 68, 0.3)' 
                : '0 0 60px rgba(56, 189, 248, 0.1)'
          }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-sky-500/10 to-purple-500/10 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isComplete ? 'bg-green-500/20' : isError ? 'bg-red-500/20' : 'bg-sky-500/20'}`}>
                <span className={isComplete ? 'text-green-400' : isError ? 'text-red-400' : 'text-sky-400'}>
                  {isComplete ? <CheckCircle2 size={20} /> : isError ? <AlertCircle size={20} /> : <FileText size={20} />}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">PDF Generation</h3>
                <p className="text-[10px] text-white/40 font-medium">{options.title}</p>
              </div>
            </div>
            {!isComplete && !isError && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Progress Section */}
          <div className="p-6 space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={config.color}>{config.icon}</span>
                  <span className="text-xs font-bold text-white/80">{config.label}</span>
                </div>
                <span className="text-xs font-mono text-white/40">{progress.progress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    isComplete ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-gradient-to-r from-sky-500 to-purple-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-white/50 text-center">{progress.message}</p>
            </div>

            {/* Details Accordion */}
            {progress.details && (
              <details 
                className="bg-white/5 rounded-xl overflow-hidden border border-white/5"
                open={expandedSection === 'details'}
              >
                <summary 
                  className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    setExpandedSection(expandedSection === 'details' ? null : 'details');
                  }}
                >
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Details</span>
                  {expandedSection === 'details' ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                </summary>
                <div className="px-4 py-3 border-t border-white/5">
                  <p className="text-[10px] font-mono text-white/60 break-all">{progress.details}</p>
                </div>
              </details>
            )}

            {/* Content Preview Accordion */}
            <details 
              className="bg-white/5 rounded-xl overflow-hidden border border-white/5"
              open={expandedSection === 'content'}
            >
              <summary 
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setExpandedSection(expandedSection === 'content' ? null : 'content');
                }}
              >
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Content Preview</span>
                {expandedSection === 'content' ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
              </summary>
              <div className="px-4 py-3 border-t border-white/5 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-mono text-white/40 whitespace-pre-wrap line-clamp-4">
                  {options.content.substring(0, 500)}...
                </p>
              </div>
            </details>

            {/* Options Summary */}
            <div className="flex flex-wrap gap-2">
              {options.screenshot && (
                <span className="px-2 py-1 bg-sky-500/10 text-sky-400 text-[9px] font-bold rounded-lg border border-sky-500/20">
                  Screenshot
                </span>
              )}
              {options.attachments && (
                <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[9px] font-bold rounded-lg border border-purple-500/20">
                  Attachments
                </span>
              )}
              {options.liveData && (
                <span className="px-2 py-1 bg-green-500/10 text-green-400 text-[9px] font-bold rounded-lg border border-green-500/20">
                  Live Data
                </span>
              )}
              {options.slides && (
                <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-[9px] font-bold rounded-lg border border-amber-500/20">
                  Slides
                </span>
              )}
              {options.author && (
                <span className="px-2 py-1 bg-white/5 text-white/40 text-[9px] font-bold rounded-lg border border-white/10">
                  By {options.author}
                </span>
              )}
            </div>

            {/* Success/Error Actions */}
            {isComplete && progress.filePath && typeof progress.filePath === 'string' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <button
                  onClick={() => progress.filePath && window.electronAPI?.openPDF?.(progress.filePath)}
                  className="flex-1 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border border-green-500/20"
                >
                  Open File
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border border-white/10"
                >
                  Done
                </button>
              </motion.div>
            )}

            {isError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors border border-red-500/20"
                >
                  Close
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper function to trigger PDF generation from anywhere
export function triggerPDFGeneration(options: PDFGenerationOptions): void {
  if (window.electronAPI) {
    window.electronAPI.generatePDF(options.title, options.content);
  }
}
