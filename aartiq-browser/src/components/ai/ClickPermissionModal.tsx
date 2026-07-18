import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, AlertTriangle, Info, Terminal, Shield, ChevronDown, Lock, Unlock, Clock, FileWarning } from 'lucide-react';

interface BatchCommandInfo {
  index: number;
  command: string;
  description: string;
  irreversible: boolean;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

interface ClickPermissionModalProps {
  context?: {
    action: string;
    target?: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
    actionType?: string;
    what?: string;
    highRiskQr?: string | null;
    requiresDeviceUnlock?: boolean;
    affectedPaths?: string[];
    estimatedImpact?: string;
  };
  onAllow?: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  highRiskApproved?: boolean;
  batchCommands?: BatchCommandInfo[];
  onAllowBatch?: (allowedIndices: number[]) => void;
}

const RISK_CONFIG = {
  low: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Low Risk', icon: '🟢', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Medium Risk', icon: '🟡', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'High Risk', icon: '🔴', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]' },
};

const ACTION_ICONS: Record<string, string> = {
  SHELL_COMMAND: 'terminal',
  CLICK_ELEMENT: 'mouse',
  FIND_AND_CLICK: 'search',
  FILL_FORM: 'edit',
  OPEN_APP: 'rocket',
  READ_PAGE_CONTENT: 'book',
  NAVIGATE: 'globe',
  SET_VOLUME: 'volume',
  SET_BRIGHTNESS: 'sun',
  SCREENSHOT_AND_ANALYZE: 'camera',
  OCR_SCREEN: 'scan',
  GENERATE_PDF: 'download',
  WEB_SEARCH: 'search',
  DOM_SEARCH: 'database',
};

function SingleMode({ context, onAllow, onDeny, highRiskApproved }: {
  context: NonNullable<ClickPermissionModalProps['context']>;
  onAllow: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  highRiskApproved: boolean;
}) {
  const [alwaysAllow, setAlwaysAllow] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
  const [showDetails, setShowDetails] = React.useState(false);
  const riskKey = context.risk || 'medium';
  const risk = RISK_CONFIG[riskKey] ?? RISK_CONFIG.medium;

  let qrData = null;
  if (context.highRiskQr) {
    try {
      qrData = JSON.parse(context.highRiskQr);
    } catch {
      qrData = { qrImage: context.highRiskQr, pin: '' };
    }
  }

  const expectedPin = typeof qrData?.pin === 'string' ? qrData.pin : '';
  const normalizedPin = pinInput.replace(/\D/g, '');
  const requiresHighRiskVerification = context.risk === 'high';
  const isPinReady = !expectedPin || (normalizedPin.length === expectedPin.length && normalizedPin === expectedPin);
  const canAllow = requiresHighRiskVerification ? highRiskApproved && isPinReady : true;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      className={`w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl overflow-y-auto backdrop-blur-2xl mx-auto max-h-[85vh] ${risk.glow}`}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-white/5 ${risk.bg}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${risk.bg} border ${risk.border} ${risk.color}`}>
          {context.actionType === 'SHELL_COMMAND' ? <Terminal size={18} /> :
            context.actionType === 'CLICK_ELEMENT' ? '🖱️' :
              context.actionType === 'FIND_AND_CLICK' ? '🔍' :
                context.actionType === 'FILL_FORM' ? '✏️' :
                  context.actionType === 'OPEN_APP' ? '🚀' :
                    context.actionType === 'READ_PAGE_CONTENT' ? '📖' :
                      context.actionType === 'NAVIGATE' ? '🌐' :
                        context.actionType === 'WEB_SEARCH' ? '🔍' : '⚡'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">AI wants to interact</div>
          <div className="text-sm font-bold text-white truncate mt-0.5">{context.action}</div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${risk.bg} ${risk.color} border ${risk.border}`}>
          {risk.label}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Command Details */}
        {context.actionType === 'SHELL_COMMAND' && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Terminal size={12} className="text-sky-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">Command</span>
            </div>
            <div className="text-xs text-white/70 font-mono break-all leading-relaxed">{context.target}</div>
          </div>
        )}

        {/* What */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">What</div>
          <div className="text-sm text-white/80 leading-relaxed font-medium">
            {context.what || context.action}
          </div>
        </div>

        {/* Why */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Why</div>
          <div className="text-[11px] text-white/50 leading-relaxed italic">
            {context.reason}
          </div>
        </div>

        {/* Target */}
        {context.target && context.actionType !== 'SHELL_COMMAND' && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Target</div>
            <div className="text-[10px] font-mono text-sky-300/70 bg-sky-500/5 border border-sky-500/10 rounded-lg px-3 py-2 break-all">
              {context.target.length > 120 ? context.target.substring(0, 120) + '...' : context.target}
            </div>
          </div>
        )}

        {/* Affected Paths */}
        {context.affectedPaths && context.affectedPaths.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Touches</div>
            <div className="flex flex-wrap gap-1.5">
              {context.affectedPaths.map((path, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-mono text-white/40">
                  {path}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Impact */}
        {context.estimatedImpact && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
            <Clock size={10} className="text-white/30 mt-0.5 flex-shrink-0" />
            <span className="text-[9px] text-white/40 leading-relaxed">{context.estimatedImpact}</span>
          </div>
        )}

        {/* Expandable Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1.5 text-[9px] text-white/30 hover:text-white/50 transition-colors"
        >
          <motion.div animate={{ rotate: showDetails ? 180 : 0 }}>
            <ChevronDown size={10} />
          </motion.div>
          <span className="uppercase tracking-widest font-bold">More details</span>
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-white/30">Action Type</span>
                <span className="text-white/50 font-mono">{context.actionType || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-white/30">Risk Level</span>
                <span className={`${risk.color} font-bold uppercase`}>{risk.label}</span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-white/30">Device Unlock</span>
                <span className="text-white/50">{context.requiresDeviceUnlock ? 'Required' : 'Not Required'}</span>
              </div>
              {context.actionType === 'SHELL_COMMAND' && (
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-white/30">Auto-Approve</span>
                  <span className="text-red-400 font-bold">Never for shell</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Irreversible Warning */}
        <IrreversibleWarning command={context.target} risk={context.risk} />

        {/* Device Unlock */}
        {context.requiresDeviceUnlock && context.risk !== 'high' && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-3">
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-sky-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                Device Unlock Required
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-white/50">
              After approval, Aartiq will open the OS verification prompt before this runs.
            </p>
          </div>
        )}

        {/* High Risk QR */}
        {context.risk === 'high' && qrData?.qrImage && (
          <div className="pt-2 border-t border-red-500/10 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-red-400 animate-pulse" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">
                High Risk: Scan to Authorize on Mobile
              </span>
            </div>
            <div className="p-3 bg-white rounded-xl shadow-2xl">
              <img src={qrData.qrImage} alt="Authorize" className="w-32 h-32" />
            </div>
            {qrData.pin && (
              <div className="mt-4 flex flex-col items-center">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Match this PIN on mobile</span>
                <span className="text-xl font-mono font-black tracking-[0.4em] text-white mt-1 bg-white/5 py-1 px-4 rounded-lg border border-white/10">{qrData.pin}</span>
              </div>
            )}
            <div className={`mt-4 w-full rounded-xl border px-3 py-3 ${highRiskApproved ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
              <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${highRiskApproved ? 'text-green-300' : 'text-amber-300'}`}>
                {highRiskApproved ? 'Mobile Approval Received' : 'Waiting For Mobile Approval'}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-white/50">
                {highRiskApproved
                  ? 'Enter the displayed PIN below to finish the approval on desktop.'
                  : 'This action stays locked until Aartiq Mobile scans the QR code and confirms.'}
              </p>
            </div>
            <div className="mt-4 w-full">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 block">
                Confirm PIN To Unlock
              </label>
              <input
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, expectedPin.length || 6))}
                inputMode="numeric"
                maxLength={expectedPin.length || 6}
                placeholder="Enter PIN"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-white outline-none transition-all focus:border-sky-400/50 focus:bg-white/10 disabled:opacity-50"
                disabled={!highRiskApproved}
              />
              {highRiskApproved && expectedPin && normalizedPin.length > 0 && normalizedPin !== expectedPin && (
                <p className="mt-2 text-[10px] text-red-300">PIN does not match the approval code.</p>
              )}
            </div>
            <p className="text-[9px] text-white/30 text-center mt-3 leading-relaxed">
              Scanning opens <strong>Aartiq Mobile</strong> to safely verify this action.
            </p>
          </div>
        )}
      </div>

      {/* Remember Choice */}
      {context.risk !== 'high' && (
        <label className="px-5 py-2 flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setAlwaysAllow(!alwaysAllow)}
            className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${alwaysAllow ? 'bg-sky-500 border-sky-500 text-white' : 'border-white/10 bg-white/5 group-hover:border-white/20'}`}
          >
            {alwaysAllow && <Zap size={12} fill="currentColor" />}
          </div>
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">Remember my choice for this action</span>
          <input type="checkbox" className="hidden" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
        </label>
      )}

      {/* Buttons */}
      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={onDeny}
          className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          Deny
        </button>
        <button
          onClick={() => canAllow && onAllow(alwaysAllow)}
          disabled={!canAllow}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-50 ${context.risk === 'high' ? 'bg-red-500/80 hover:bg-red-500 text-white' :
              context.risk === 'medium' ? 'bg-amber-500/80 hover:bg-amber-500 text-white' :
                'bg-sky-500/80 hover:bg-sky-500 text-white'
            }`}
        >
          {requiresHighRiskVerification
            ? !highRiskApproved
              ? 'Awaiting Mobile Approval'
              : !isPinReady
                ? 'Enter Matching PIN'
                : 'Approve Action'
            : 'Allow'}
        </button>
      </div>

      {/* Keyboard Shortcut */}
      {context.risk !== 'high' && (
        <div className="px-5 pb-4 flex items-center justify-center gap-2">
          <kbd className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-white/30">Shift</kbd>
          <span className="text-[9px] text-white/20">+</span>
          <kbd className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-white/30">Tab</kbd>
          <span className="text-[9px] text-white/20 uppercase tracking-widest">
            {context.requiresDeviceUnlock ? 'to approve, then unlock device' : 'to quick-allow'}
          </span>
        </div>
      )}
    </motion.div>
  );
}

function IrreversibleWarning({ command, risk }: { command?: string; risk: string }) {
  if (risk === 'high') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border-2 border-red-500/40 bg-red-500/10 px-4 py-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">Dangerous Action</div>
            <div className="text-[9px] text-red-300/60 mt-0.5">This cannot be undone</div>
          </div>
        </div>
        <div className="space-y-1.5 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[10px] text-red-300/80">Permanently modifies or deletes system data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[10px] text-red-300/80">No automatic rollback available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[10px] text-red-300/80">Requires mobile authorization + PIN</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (command && /^(rm\s+-rf|dd\s+|mkfs|format|fdisk)/i.test(command.trim())) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <FileWarning size={14} className="text-red-400 flex-shrink-0" />
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Destructive Command</div>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-red-300/80">
          This command can permanently destroy data. Double-check before approving.
        </p>
      </div>
    );
  }

  if (command && /[|>]/.test(command)) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Pipe / Redirect Detected</div>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-amber-300/80">
          This command uses pipes or output redirection which can modify files.
        </p>
      </div>
    );
  }

  return null;
}

function BatchMode({ batchCommands, onAllowBatch, onDeny }: {
  batchCommands: BatchCommandInfo[];
  onAllowBatch: (indices: number[]) => void;
  onDeny: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<number>>(new Set(batchCommands.map((_, i) => i)));
  const [selectAll, setSelectAll] = React.useState(true);
  const [expandedCmds, setExpandedCmds] = React.useState<Set<number>>(new Set());

  const toggleIndex = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
    setSelectAll(false);
  };

  const toggleAll = () => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(batchCommands.map((_, i) => i)));
      setSelectAll(true);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedCmds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const anyIrreversible = batchCommands.some((c) => c.irreversible);
  const selectedRiskCounts = { low: 0, medium: 0, high: 0 };
  batchCommands.forEach((cmd, i) => {
    if (selected.has(i)) selectedRiskCounts[cmd.risk]++;
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl overflow-y-auto backdrop-blur-2xl mx-auto max-h-[85vh]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-amber-500/10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
          <Terminal size={18} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">AI wants to execute</div>
          <div className="text-sm font-bold text-white truncate mt-0.5">{batchCommands.length} Shell Commands</div>
        </div>
        <div className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Batch
        </div>
      </div>

      {/* Risk Summary */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        {selectedRiskCounts.low > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
            {selectedRiskCounts.low} Low
          </span>
        )}
        {selectedRiskCounts.medium > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {selectedRiskCounts.medium} Medium
          </span>
        )}
        {selectedRiskCounts.high > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            {selectedRiskCounts.high} High
          </span>
        )}
      </div>

      {/* Why */}
      <div className="px-5 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Why</div>
        <div className="text-[11px] text-white/50 leading-relaxed italic">
          The AI needs to run multiple shell commands to complete the task.
        </div>
      </div>

      {/* Irreversible Warning */}
      {anyIrreversible && (
        <div className="mx-5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">Irreversible Commands Detected</div>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-red-300/80">
            Some commands can permanently destroy data. Review carefully before approving.
          </p>
        </div>
      )}

      {/* Select All / Deselect All */}
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Commands ({selected.size}/{batchCommands.length} selected)
        </span>
        <button
          onClick={toggleAll}
          className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-widest"
        >
          {selectAll ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Command List */}
      <div className="px-5 py-2 max-h-64 overflow-y-auto space-y-1.5">
        {batchCommands.map((cmd, idx) => {
          const isSelected = selected.has(idx);
          const isExpanded = expandedCmds.has(idx);
          const cmdRisk = RISK_CONFIG[cmd.risk] ?? RISK_CONFIG.medium;
          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all overflow-hidden ${
                isSelected
                  ? 'border-sky-500/30 bg-sky-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
              }`}
            >
              <div 
                className="px-3 py-2.5 cursor-pointer"
                onClick={() => toggleIndex(idx)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? 'bg-sky-500 border-sky-500' : 'border-white/20'
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-white/80 truncate">{cmd.command.length > 50 ? cmd.command.substring(0, 50) + '...' : cmd.command}</div>
                      <div className="text-[9px] text-white/35 mt-0.5">{cmd.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cmd.irreversible && <AlertTriangle size={10} className="text-red-400" />}
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${cmdRisk.bg} ${cmdRisk.color} border ${cmdRisk.border}`}>
                      {cmd.risk}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleExpand(idx); }}
                      className="text-white/20 hover:text-white/40 transition-colors"
                    >
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                        <ChevronDown size={10} />
                      </motion.div>
                    </button>
                  </div>
                </div>
              </div>
              {/* Expanded reason */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 pt-0 ml-9">
                      <div className="text-[9px] text-white/30 leading-relaxed italic">{cmd.reason}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-4 flex gap-3 border-t border-white/5 mt-2">
        <button
          onClick={onDeny}
          className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          Deny All
        </button>
        <button
          onClick={() => onAllowBatch(Array.from(selected))}
          disabled={selected.size === 0}
          className="flex-1 py-2.5 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-bold transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          Allow {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>

      {selected.size < batchCommands.length && (
        <div className="px-5 pb-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              Partial Approval
            </div>
            <p className="mt-0.5 text-[10px] text-amber-300/70">
              {batchCommands.length - selected.size} command{selected.size !== 1 ? 's' : ''} will be skipped. The AI may not be able to complete the task.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const ClickPermissionModal = memo(function ClickPermissionModal(props: ClickPermissionModalProps) {
  const { context, onAllow, onDeny, highRiskApproved, batchCommands, onAllowBatch } = props;

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); onAllow?.(); }
      if (e.key === 'Escape') { e.preventDefault(); onDeny(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onAllow, onDeny]);

  if (batchCommands && batchCommands.length > 1 && onAllowBatch) {
    return <BatchMode batchCommands={batchCommands} onAllowBatch={onAllowBatch} onDeny={onDeny} />;
  }

  if (!context || !onAllow) return null;

  return (
    <SingleMode context={context} onAllow={onAllow} onDeny={onDeny} highRiskApproved={highRiskApproved || false} />
  );
});

export default ClickPermissionModal;
