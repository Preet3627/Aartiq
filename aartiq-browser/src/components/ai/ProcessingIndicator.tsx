"use client";

import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Search,
  Zap,
  Clock,
  Target,
  Pause,
  Check,
  Circle,
  Loader2,
  FileText,
  MousePointerClick,
  Globe,
  Scan,
  Terminal,
  AppWindow,
  Download,
  Pencil,
} from 'lucide-react';
import type { AgentState } from '../AIChatSidebar/types';

interface ProcessingIndicatorProps {
  agentState: AgentState;
  customStatus?: string;
  currentCommand?: { type: string; value: string } | null;
  className?: string;
}

interface PhaseConfig {
  icon: React.FC<any>;
  color: string;
  dotColor: string;
  label: string;
}

const PHASE_MAP: Record<string, PhaseConfig> = {
  thinking:   { icon: Brain,            color: 'text-indigo-400', dotColor: 'bg-indigo-400', label: 'Thinking' },
  searching:  { icon: Search,           color: 'text-cyan-400',   dotColor: 'bg-cyan-400',   label: 'Searching' },
  executing:  { icon: Zap,              color: 'text-sky-400',    dotColor: 'bg-sky-400',     label: 'Executing' },
  waiting:    { icon: Clock,            color: 'text-orange-400', dotColor: 'bg-orange-400',  label: 'Waiting' },
  planning:   { icon: Target,           color: 'text-amber-400',  dotColor: 'bg-amber-400',   label: 'Planning' },
  paused:     { icon: Pause,            color: 'text-yellow-400', dotColor: 'bg-yellow-400',  label: 'Paused' },
  finished:   { icon: Check,            color: 'text-green-400',  dotColor: 'bg-green-400',   label: 'Done' },
  idle:       { icon: Circle,           color: 'text-white/20',   dotColor: 'bg-white/20',    label: '' },
};

const COMMAND_ICONS: Record<string, React.FC<any>> = {
  NAVIGATE:              Globe,
  WEB_SEARCH:            Search,
  SEARCH:                Search,
  READ_PAGE_CONTENT:     FileText,
  DOM_SEARCH:            Scan,
  CLICK_ELEMENT:         MousePointerClick,
  CLICK_AT:              MousePointerClick,
  FILL_FORM:             Pencil,
  SCREENSHOT_AND_ANALYZE: Scan,
  SHELL_COMMAND:         Terminal,
  OPEN_APP:              AppWindow,
  GENERATE_PDF:          Download,
  CREATE_FILE_JSON:      Download,
  GENERATE_IMAGE:        Download,
};

const COMMAND_LABELS: Record<string, string> = {
  NAVIGATE:              'Navigating',
  WEB_SEARCH:            'Searching the web',
  SEARCH:                'Searching',
  READ_PAGE_CONTENT:     'Reading page content',
  DOM_SEARCH:            'Searching page elements',
  CLICK_ELEMENT:         'Clicking',
  CLICK_AT:              'Clicking',
  FILL_FORM:             'Filling form',
  SCREENSHOT_AND_ANALYZE: 'Analyzing screen',
  SHELL_COMMAND:         'Running command',
  OPEN_APP:              'Opening app',
  GENERATE_PDF:          'Generating PDF',
  CREATE_FILE_JSON:      'Generating document',
  GENERATE_IMAGE:        'Generating image',
  SET_THEME:             'Changing theme',
  SET_VOLUME:            'Adjusting volume',
  RELOAD:                'Reloading page',
  GO_BACK:               'Going back',
  GO_FORWARD:            'Going forward',
  WAIT:                  'Waiting',
  ORGANIZE_TABS:         'Organizing tabs',
  CLOSE_TAB:             'Closing tab',
  SWITCH_TAB:            'Switching tab',
  OPEN_TABS:             'Opening tabs',
  SCROLL_TO:             'Scrolling',
};

function BouncingDots({ color, className }: { color: string; className?: string }) {
  return (
    <div className={`flex items-center gap-[3px] ${className || ''}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`w-[4px] h-[4px] rounded-full ${color}`}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

function SpinningLoader({ color }: { color: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >
      <Loader2 size={13} className={color} />
    </motion.div>
  );
}

const ProcessingIndicator = memo(function ProcessingIndicator({
  agentState,
  customStatus,
  currentCommand,
  className,
}: ProcessingIndicatorProps) {
  const phase = PHASE_MAP[agentState] || PHASE_MAP.thinking;

  const commandLabel = useMemo(() => {
    if (customStatus) return customStatus;
    if (currentCommand) {
      const base = COMMAND_LABELS[currentCommand.type] || currentCommand.type.replace(/_/g, ' ').toLowerCase();
      const value = currentCommand.value?.trim();
      if (value && value.length < 60) {
        const short = value.length > 40 ? value.slice(0, 40) + '...' : value;
        return `${base}: ${short}`;
      }
      return base;
    }
    return null;
  }, [customStatus, currentCommand]);

  const displayLabel = commandLabel || phase.label;
  const IconComponent = currentCommand && COMMAND_ICONS[currentCommand.type] ? COMMAND_ICONS[currentCommand.type] : phase.icon;

  if (agentState === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className={`mx-auto w-full max-w-[650px] ${className || ''}`}
    >
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <BouncingDots color={phase.dotColor} />

        <AnimatePresence mode="wait">
          <motion.div
            key={displayLabel}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center gap-1.5 min-w-0"
          >
            <motion.div
              animate={agentState === 'executing' || agentState === 'searching'
                ? { rotate: [0, 10, -10, 0] }
                : { scale: [1, 1.1, 1] }
              }
              transition={{
                duration: agentState === 'executing' ? 0.6 : 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <IconComponent size={12} className={phase.color} />
            </motion.div>

            <span className={`text-[12px] font-medium ${phase.color} truncate`}>
              {displayLabel}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="flex-1" />

        <motion.div
          className={`h-[1px] flex-1 max-w-[120px] rounded-full ${phase.dotColor} opacity-20`}
          animate={{ scaleX: [0.3, 1, 0.3], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: 'left' }}
        />
      </div>
    </motion.div>
  );
});

export default ProcessingIndicator;
