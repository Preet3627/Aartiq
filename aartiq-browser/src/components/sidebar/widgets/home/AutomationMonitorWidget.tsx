"use client";

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, Clock, PauseCircle } from 'lucide-react';
import { AIHomeCard } from '../../home/AIHomeCard';
import type { ActionChainStep } from '@/components/ai/ActionChainTimeline';

interface AutomationMonitorWidgetProps {
  steps: ActionChainStep[];
  isWorking?: boolean;
}

const nodeIcon = (status: ActionChainStep['status']) => {
  switch (status) {
    case 'running':
      return <Loader2 size={10} className="text-sky-400 animate-spin" />;
    case 'done':
      return <CheckCircle2 size={10} className="text-emerald-400" />;
    case 'error':
      return <PauseCircle size={10} className="text-red-400" />;
    default:
      return <Clock size={10} className="text-secondary-text/35" />;
  }
};

const AutomationMonitorWidget = memo(function AutomationMonitorWidget({
  steps,
  isWorking = false,
}: AutomationMonitorWidgetProps) {
  const graph = useMemo(() => steps.slice(-8), [steps]);

  if (graph.length === 0 && !isWorking) return null;

  const completed = graph.filter((s) => s.status === 'done' || s.status === 'error').length;

  return (
    <AIHomeCard
      title="Automation monitor"
      subtitle={graph.length ? `${completed}/${graph.length} steps` : 'Standing by'}
      isWorking={isWorking || graph.some((s) => s.status === 'running')}
    >
      <div className="relative pl-1">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-500/40 via-white/10 to-emerald-500/30" />
        <div className="space-y-2">
          {graph.map((step, idx) => (
            <motion.div
              key={step.id || idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.2 }}
              className="relative flex items-center gap-2 pl-4"
            >
              <div className="absolute left-0 w-[22px] flex justify-center">{nodeIcon(step.status)}</div>
              <div
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-[10px] border ${
                  step.status === 'running'
                    ? 'border-sky-500/25 bg-sky-500/8 text-sky-300/90'
                    : step.status === 'done'
                      ? 'border-emerald-500/15 bg-emerald-500/5 text-secondary-text/75'
                      : step.status === 'error'
                        ? 'border-red-500/20 bg-red-500/5 text-red-300/80'
                        : 'border-white/[0.05] bg-white/[0.02] text-secondary-text/55'
                }`}
              >
                <span className="truncate block">{step.label}</span>
              </div>
              <span className="text-[8px] uppercase tracking-wider text-secondary-text/35 w-14 text-right shrink-0">
                {step.status === 'running' ? 'Running' : step.status === 'pending' ? 'Waiting' : step.status === 'done' ? 'Done' : step.status}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </AIHomeCard>
  );
});

export default AutomationMonitorWidget;
