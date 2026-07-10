import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Info, Terminal } from 'lucide-react';

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
  };
  onAllow?: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  highRiskApproved?: boolean;
  batchCommands?: BatchCommandInfo[];
  onAllowBatch?: (allowedIndices: number[]) => void;
}

const RISK_CONFIG = {
  low: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'Low Risk', icon: '🟢' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Medium Risk', icon: '🟡' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'High Risk', icon: '🔴' },
};

function SingleMode({ context, onAllow, onDeny, highRiskApproved }: {
  context: NonNullable<ClickPermissionModalProps['context']>;
  onAllow: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  highRiskApproved: boolean;
}) {
  const [alwaysAllow, setAlwaysAllow] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
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
      className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl overflow-hidden backdrop-blur-2xl mx-auto"
    >
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-white/5 ${risk.bg}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${risk.bg} border ${risk.border}`}>
          {context.actionType === 'SHELL_COMMAND' ? <Terminal size={18} /> :
            context.actionType === 'CLICK_ELEMENT' ? '🖱️' :
              context.actionType === 'FIND_AND_CLICK' ? '🔍' :
                context.actionType === 'FILL_FORM' ? '✏️' :
                  context.actionType === 'OPEN_APP' ? '🚀' :
                    context.actionType === 'READ_PAGE_CONTENT' ? '📖' : '⚡'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-white/40">AI wants to interact</div>
          <div className="text-sm font-bold text-white truncate mt-0.5">{context.action}</div>
        </div>
        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${risk.bg} ${risk.color} border ${risk.border}`}>
          {risk.label}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {context.actionType === 'SHELL_COMMAND' && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 flex items-start gap-2.5">
            <Info size={14} className="text-sky-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-400">Command</div>
              <div className="text-xs text-white/70 font-mono mt-0.5 break-all">{context.target}</div>
            </div>
          </div>
        )}

        {context.actionType === 'SHELL_COMMAND' && context.target && (
          <div className="px-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Description</div>
            <div className="text-xs text-white/70 leading-relaxed">
              {context.target.length > 80 ? context.target.substring(0, 80) + '...' : context.target}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Why</div>
          <div className="text-sm text-white/60 leading-relaxed italic">
            {context.reason}
          </div>
        </div>

        {context.target && context.actionType !== 'SHELL_COMMAND' && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Target</div>
            <div className="text-[11px] font-mono text-sky-300/80 bg-sky-500/5 border border-sky-500/10 rounded-lg px-3 py-2 break-all">
              {context.target.length > 120 ? context.target.substring(0, 120) + '...' : context.target}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">What</div>
          <div className="text-sm text-white/80 leading-relaxed font-medium">
            {context.what || context.action}
          </div>
        </div>

        <IrreversibleWarning command={context.target} risk={context.risk} />

        {context.requiresDeviceUnlock && context.risk !== 'high' && (
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">
              Native Device Unlock Required
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/60">
              After approval, Aartiq will open the OS verification prompt before this command runs.
            </p>
          </div>
        )}

        {context.risk === 'high' && qrData?.qrImage && (
          <div className="pt-2 border-t border-red-500/10 flex flex-col items-center">
            <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 animate-pulse">
              🚨 High Risk: Scan to Authorize on Mobile
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
              <div className={`text-[10px] font-black uppercase tracking-[0.3em] ${highRiskApproved ? 'text-green-300' : 'text-amber-300'}`}>
                {highRiskApproved ? 'Mobile Approval Received' : 'Waiting For Mobile Approval'}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/60">
                {highRiskApproved
                  ? 'Enter the displayed PIN below to finish the approval on desktop.'
                  : 'This action stays locked until Aartiq Mobile scans the QR code and confirms the request.'}
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
                <p className="mt-2 text-[11px] text-red-300">PIN does not match the approval code.</p>
              )}
            </div>
            <p className="text-[10px] text-white/30 text-center mt-3 leading-relaxed">
              Scanning opens **Aartiq Mobile** <br /> to safely verify this action.
            </p>
          </div>
        )}
      </div>

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

      <div className="px-5 pb-5 flex gap-3">
        <button
          onClick={onDeny}
          className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          ✕ Deny
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
            : '✓ Allow'}
        </button>
      </div>

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
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Irreversible Action</div>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-red-300/80">
          This action can permanently modify or damage your system. Proceed with caution.
        </p>
      </div>
    );
  }

  if (command && /^(rm\s+-rf|dd\s+|mkfs|format|fdisk)/i.test(command.trim())) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Destructive Command</div>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-red-300/80">
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
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Pipe / Redirect Detected</div>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-300/80">
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

  const anyIrreversible = batchCommands.some((c) => c.irreversible);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl overflow-hidden backdrop-blur-2xl mx-auto"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-amber-500/10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
          <Terminal size={18} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-white/40">AI wants to execute</div>
          <div className="text-sm font-bold text-white truncate mt-0.5">{batchCommands.length} Shell Commands</div>
        </div>
        <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Batch
        </div>
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Why</div>
        <div className="text-xs text-white/60 leading-relaxed italic">
          The AI needs to run multiple shell commands to complete the task.
        </div>
      </div>

      {anyIrreversible && (
        <div className="mx-5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Irreversible Commands Detected</div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-red-300/80">
            Some commands in this batch can permanently destroy data. Review carefully before approving.
          </p>
        </div>
      )}

      <div className="px-5 pt-2 pb-1 flex items-center justify-between">
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

      <div className="px-5 py-2 max-h-64 overflow-y-auto space-y-2">
        {batchCommands.map((cmd, idx) => {
          const isSelected = selected.has(idx);
          const cmdRisk = RISK_CONFIG[cmd.risk] ?? RISK_CONFIG.medium;
          return (
            <div
              key={idx}
              onClick={() => toggleIndex(idx)}
              className={`rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-sky-500/30 bg-sky-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
              }`}
            >
              <div className="px-3 py-2.5">
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
                      <div className="text-xs font-mono text-white/90 truncate">{cmd.command.length > 60 ? cmd.command.substring(0, 60) + '...' : cmd.command}</div>
                      <div className="text-[10px] text-white/40 mt-0.5">{cmd.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {cmd.irreversible && <AlertTriangle size={10} className="text-red-400" />}
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${cmdRisk.bg} ${cmdRisk.color} border ${cmdRisk.border}`}>
                      {cmdRisk.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">
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
