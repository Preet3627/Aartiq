import React, { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileWarning,
  Fingerprint,
  Lock,
  MousePointer2,
  Search,
  Shield,
  Terminal,
  X,
  Zap,
} from 'lucide-react';

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
    requiresDeviceUnlock?: boolean;
    affectedPaths?: string[];
    estimatedImpact?: string;
  };
  onAllow?: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  batchCommands?: BatchCommandInfo[];
  onAllowBatch?: (allowedIndices: number[]) => void;
}

const riskTone = {
  low: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  high: 'text-red-600 bg-red-500/10 border-red-500/20',
};

const actionIcon = (actionType?: string) => {
  if (actionType === 'SHELL_COMMAND') return <Terminal size={18} />;
  if (actionType === 'FIND_AND_CLICK' || actionType === 'WEB_SEARCH') return <Search size={18} />;
  if (actionType?.includes('CLICK') || actionType === 'FILL_FORM') return <MousePointer2 size={18} />;
  return <Zap size={18} />;
};

const humanAction = (action?: string, actionType?: string) => {
  if (action) return action;
  if (!actionType) return 'Perform an action';
  return actionType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
};

function TechnicalDetails({ children, label = 'Show Technical Details' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[color-mix(in_srgb,var(--border-color)_55%,transparent)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-[12px] text-secondary-text hover:text-primary-text"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DangerousActionNotice({ command, risk }: { command?: string; risk: 'low' | 'medium' | 'high' }) {
  const destructiveCommand = command && /^(rm\s+-rf|dd\s+|mkfs|format|fdisk)/i.test(command.trim());
  const pipedCommand = command && /[|>]/.test(command);
  if (risk !== 'high' && !destructiveCommand && !pipedCommand) return null;

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-red-500">
        <FileWarning size={15} />
        {risk === 'high' || destructiveCommand ? 'This action can modify or delete data' : 'This command redirects or pipes output'}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-secondary-text">
        Review the details before allowing Aartiq to continue.
      </p>
    </div>
  );
}

function SinglePermissionCard({
  context,
  onAllow,
  onDeny,
}: {
  context: NonNullable<ClickPermissionModalProps['context']>;
  onAllow: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
}) {
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const actionName = humanAction(context.action, context.actionType);

  return (
    <PermissionShell>
      <div className="p-5">
        <div className="mb-5 flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${riskTone[context.risk]}`}>
            {context.risk === 'high' ? <Shield size={19} /> : actionIcon(context.actionType)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-secondary-text">Allow Aartiq to</div>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight text-primary-text">{actionName}</h2>
            <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskTone[context.risk]}`}>
              {context.risk === 'high' ? 'High risk — biometric required' : context.risk === 'medium' ? 'Needs approval' : 'Low risk'}
            </div>
          </div>
          <button type="button" onClick={onDeny} className="rounded-md p-2 text-secondary-text hover:bg-[color-mix(in_srgb,var(--primary-text)_8%,transparent)] hover:text-primary-text" title="Deny">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1 text-[12px] font-medium text-secondary-text">Reason</div>
            <p className="text-[14px] leading-relaxed text-primary-text">{context.reason}</p>
          </div>

          {context.what && context.what !== actionName && (
            <div>
              <div className="mb-1 text-[12px] font-medium text-secondary-text">Action</div>
              <p className="text-[14px] leading-relaxed text-primary-text">{context.what}</p>
            </div>
          )}

          {context.affectedPaths && context.affectedPaths.length > 0 && (
            <div>
              <div className="mb-2 text-[12px] font-medium text-secondary-text">Files</div>
              <div className="flex flex-wrap gap-1.5">
                {context.affectedPaths.map((path) => (
                  <span key={path} className="max-w-full truncate rounded-md bg-[color-mix(in_srgb,var(--primary-text)_6%,transparent)] px-2 py-1 font-mono text-[11px] text-secondary-text">
                    {path}
                  </span>
                ))}
              </div>
            </div>
          )}

          {context.estimatedImpact && (
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--primary-text)_5%,transparent)] px-3 py-2 text-[12px] leading-relaxed text-secondary-text">
              {context.estimatedImpact}
            </div>
          )}

          <DangerousActionNotice command={context.target} risk={context.risk} />

          {context.risk === 'high' && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-red-500">
                <Fingerprint size={15} />
                Biometric verification required
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-secondary-text">
                After clicking Allow, your device will prompt for Touch ID / fingerprint to confirm this high-risk action. No exceptions.
              </p>
            </div>
          )}

          {context.requiresDeviceUnlock && context.risk !== 'high' && (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-primary-text">
                <Lock size={15} />
                Device unlock required
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-secondary-text">
                macOS, Windows, or Linux will ask you to verify before this runs.
              </p>
            </div>
          )}

          {context.target && (
            <TechnicalDetails>
              <div className="space-y-1">
                <div className="text-[11px] text-secondary-text">Target</div>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 font-mono text-[11px] text-secondary-text">
                  {context.target}
                </pre>
              </div>
              <div className="grid grid-cols-[90px_1fr] gap-2 text-[11px] text-secondary-text">
                <span>Action type</span><span className="font-mono">{context.actionType || 'unknown'}</span>
                <span>Risk</span><span>{context.risk}</span>
                <span>Biometric</span><span>{context.risk === 'high' ? 'required' : context.requiresDeviceUnlock ? 'required' : 'not required'}</span>
              </div>
            </TechnicalDetails>
          )}
        </div>
      </div>

      {context.risk !== 'high' && (
        <label className="flex cursor-pointer items-center gap-3 border-t border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] px-5 py-3">
          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${alwaysAllow ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[color-mix(in_srgb,var(--border-color)_80%,transparent)]'}`}>
            {alwaysAllow && <Check size={13} />}
          </span>
          <span className="text-[13px] text-secondary-text">Always allow this action</span>
          <input className="sr-only" type="checkbox" checked={alwaysAllow} onChange={(event) => setAlwaysAllow(event.target.checked)} />
        </label>
      )}

      <div className="flex gap-2 border-t border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] p-5 pt-4">
        <button
          type="button"
          onClick={onDeny}
          className="flex-1 rounded-lg border border-[color-mix(in_srgb,var(--border-color)_65%,transparent)] px-4 py-2.5 text-sm font-medium text-secondary-text hover:bg-[color-mix(in_srgb,var(--primary-text)_6%,transparent)] hover:text-primary-text"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onAllow(context.risk === 'high' ? false : alwaysAllow)}
          className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          {context.risk === 'high' ? 'Allow (Touch ID)' : alwaysAllow ? 'Always Allow' : 'Allow Once'}
        </button>
      </div>
    </PermissionShell>
  );
}

function BatchPermissionCard({
  batchCommands,
  onAllowBatch,
  onDeny,
}: {
  batchCommands: BatchCommandInfo[];
  onAllowBatch: (indices: number[]) => void;
  onDeny: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(batchCommands.map((_, index) => index)));
  const selectedCount = selected.size;
  const anyIrreversible = batchCommands.some((command) => command.irreversible);

  const toggleIndex = (index: number) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <PermissionShell wide>
      <div className="p-5">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
            <Terminal size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-secondary-text">Allow Aartiq to</div>
            <h2 className="mt-0.5 text-lg font-semibold leading-tight text-primary-text">Run {batchCommands.length} commands</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-secondary-text">Needed to complete the automation.</p>
          </div>
          <button type="button" onClick={onDeny} className="rounded-md p-2 text-secondary-text hover:bg-[color-mix(in_srgb,var(--primary-text)_8%,transparent)] hover:text-primary-text" title="Deny">
            <X size={16} />
          </button>
        </div>

        {anyIrreversible && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-red-500">
              <AlertTriangle size={15} />
              Some commands may be destructive
            </div>
          </div>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {batchCommands.map((command, index) => {
            const isSelected = selected.has(index);
            return (
              <button
                key={`${command.index}-${index}`}
                type="button"
                onClick={() => toggleIndex(index)}
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${isSelected ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'border-[color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-transparent'}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[color-mix(in_srgb,var(--border-color)_80%,transparent)]'}`}>
                  {isSelected && <Check size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-primary-text">{command.description || 'Run command'}</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-secondary-text">{command.reason}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${riskTone[command.risk]}`}>{command.risk}</span>
              </button>
            );
          })}
        </div>

        <TechnicalDetails label="Show Commands">
          {batchCommands.map((command, index) => (
            <pre key={`${command.index}-raw-${index}`} className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/30 p-2 font-mono text-[11px] text-secondary-text">
              {command.command}
            </pre>
          ))}
        </TechnicalDetails>
      </div>

      <div className="flex gap-2 border-t border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] p-5 pt-4">
        <button
          type="button"
          onClick={onDeny}
          className="flex-1 rounded-lg border border-[color-mix(in_srgb,var(--border-color)_65%,transparent)] px-4 py-2.5 text-sm font-medium text-secondary-text hover:bg-[color-mix(in_srgb,var(--primary-text)_6%,transparent)] hover:text-primary-text"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onAllowBatch(Array.from(selected))}
          disabled={selectedCount === 0}
          className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Allow {selectedCount > 0 ? selectedCount : ''}
        </button>
      </div>
    </PermissionShell>
  );
}

function PermissionShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 10 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`mx-auto max-h-[88vh] w-full ${wide ? 'max-w-lg' : 'max-w-md'} overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_70%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_96%,transparent)] text-primary-text shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl`}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </motion.div>
  );
}

const ClickPermissionModal = memo(function ClickPermissionModal(props: ClickPermissionModalProps) {
  const { context, onAllow, onDeny, batchCommands, onAllowBatch } = props;

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDeny();
      }
      if (event.key === 'Tab' && event.shiftKey && onAllow) {
        event.preventDefault();
        onAllow(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onAllow, onDeny]);

  if (batchCommands && batchCommands.length > 1 && onAllowBatch) {
    return <BatchPermissionCard batchCommands={batchCommands} onAllowBatch={onAllowBatch} onDeny={onDeny} />;
  }

  if (!context || !onAllow) return null;
  return <SinglePermissionCard context={context} onAllow={onAllow} onDeny={onDeny} />;
});

export default ClickPermissionModal;
