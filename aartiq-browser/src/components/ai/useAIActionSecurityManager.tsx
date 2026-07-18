import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ClickPermissionModal from './ClickPermissionModal';
import {
  getActionPermissionKey,
  isActionAutoApproved,
  isIrreversibleCommand,
  getCommandDescription,
  normalizeActionType,
  normalizeRiskLevel,
  type ActionRiskLevel,
} from '@/lib/ai-action-security';

interface PermissionContext {
  actionType: string;
  action: string;
  target?: string;
  what?: string;
  reason: string;
  risk: ActionRiskLevel;
  highRiskQr?: string | null;
  requiresDeviceUnlock?: boolean;
  affectedPaths?: string[];
  estimatedImpact?: string;
}

interface BatchCommandInfo {
  index: number;
  command: string;
  description: string;
  irreversible: boolean;
  risk: ActionRiskLevel;
  reason: string;
}

interface PendingPermission {
  resolve: (allowed: boolean) => void;
  mobileApproved: boolean;
  context: PermissionContext;
  batchCommands?: BatchCommandInfo[];
}

interface PermissionRequestInput {
  actionType: string;
  action: string;
  target?: string;
  what?: string;
  reason: string;
  risk?: string;
}

async function getSecuritySettingsSafe() {
  try {
    return await window.electronAPI?.getSecuritySettings?.();
  } catch (error) {
    console.error('[AI Security] Failed to load security settings:', error);
    return null;
  }
}

export function useAIActionSecurityManager() {
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const biometricVerifiedRef = useRef(false);
  const batchResolveRef = useRef<((allowed: boolean[]) => void) | null>(null);
  const batchInputsLengthRef = useRef(0);

  const requestPermission = useCallback(async (input: PermissionRequestInput): Promise<boolean> => {
    const actionType = normalizeActionType(input.actionType);
    const risk = normalizeRiskLevel(input.risk);
    const permissionKey = getActionPermissionKey(actionType, input.target, input.what);

    if (risk !== 'high' && window.electronAPI?.permCheck) {
      const existingPermission = await window.electronAPI.permCheck(permissionKey);
      if (existingPermission?.granted) {
        return true;
      }
    }

    const settings = await getSecuritySettingsSafe();
    if (isActionAutoApproved(settings, actionType, risk)) {
      if (risk === 'low' && settings?.requireBiometricEveryTime) {
        if (window.electronAPI?.authenticateBiometric) {
          const authResult = await window.electronAPI.authenticateBiometric(
            `Verify identity: ${input.action}`
          );
          if (!authResult?.success) return false;
        }
      } else if (risk === 'low' && settings?.requireBiometricPerSession && !biometricVerifiedRef.current) {
        if (window.electronAPI?.authenticateBiometric) {
          const authResult = await window.electronAPI.authenticateBiometric(
            'Verify identity for low-risk actions this session'
          );
          if (!authResult?.success) return false;
        }
        biometricVerifiedRef.current = true;
      }
      return true;
    }

    if (risk === 'low') {
      if (settings?.requireBiometricEveryTime && window.electronAPI?.authenticateBiometric) {
        const authResult = await window.electronAPI.authenticateBiometric(
          `Verify identity: ${input.action}`
        );
        return !!authResult?.success;
      }
      if (settings?.requireBiometricPerSession && !biometricVerifiedRef.current && window.electronAPI?.authenticateBiometric) {
        const authResult = await window.electronAPI.authenticateBiometric(
          'Verify identity for low-risk actions this session'
        );
        if (!authResult?.success) return false;
        biometricVerifiedRef.current = true;
        return true;
      }
    }

    const requiresDeviceUnlock = settings?.requireDeviceUnlockForManualApproval !== false;

    let highRiskQr: string | null = null;
    if (risk === 'high' && window.electronAPI?.generateHighRiskQr) {
      highRiskQr = await window.electronAPI.generateHighRiskQr(`${actionType}-${Date.now()}`);
    }

    return new Promise((resolve) => {
      setPendingPermission({
        resolve,
        mobileApproved: false,
        context: {
          actionType,
          action: input.action,
          target: input.target,
          what: input.what,
          reason: input.reason,
          risk,
          highRiskQr,
          requiresDeviceUnlock: requiresDeviceUnlock && risk !== 'low',
        },
      });
    });
  }, []);

  const requestBatchPermission = useCallback(async (inputs: PermissionRequestInput[]): Promise<boolean[]> => {
    if (inputs.length === 0) return [];
    if (inputs.length === 1) {
      const result = await requestPermission(inputs[0]);
      return [result];
    }

    const results = new Array<boolean>(inputs.length).fill(false);
    const enriched = await Promise.all(inputs.map(async (input) => {
      const actionType = normalizeActionType(input.actionType);
      const risk = normalizeRiskLevel(input.risk);
      const permissionKey = getActionPermissionKey(actionType, input.target, input.what);

      if (risk !== 'high' && window.electronAPI?.permCheck) {
        const existingPermission = await window.electronAPI.permCheck(permissionKey);
        if (existingPermission?.granted) return { ...input, actionType, risk, autoApproved: true as const };
      }

      const settings = await getSecuritySettingsSafe();
      if (isActionAutoApproved(settings, actionType, risk)) {
        if (risk === 'low' && settings?.requireBiometricEveryTime) {
          if (window.electronAPI?.authenticateBiometric) {
            const authResult = await window.electronAPI.authenticateBiometric(
              `Verify identity: ${input.action}`
            );
            if (!authResult?.success) return { ...input, actionType, risk, autoApproved: false as const };
          }
        } else if (risk === 'low' && settings?.requireBiometricPerSession && !biometricVerifiedRef.current) {
          if (window.electronAPI?.authenticateBiometric) {
            const authResult = await window.electronAPI.authenticateBiometric(
              'Verify identity for low-risk actions this session'
            );
            if (!authResult?.success) return { ...input, actionType, risk, autoApproved: false as const };
          }
          biometricVerifiedRef.current = true;
        }
        return { ...input, actionType, risk, autoApproved: true as const };
      }

      if (risk === 'low') {
        if (settings?.requireBiometricEveryTime && window.electronAPI?.authenticateBiometric) {
          const authResult = await window.electronAPI.authenticateBiometric(
            `Verify identity: ${input.action}`
          );
          return { ...input, actionType, risk, autoApproved: !!authResult?.success };
        }
        if (settings?.requireBiometricPerSession && !biometricVerifiedRef.current && window.electronAPI?.authenticateBiometric) {
          const authResult = await window.electronAPI.authenticateBiometric(
            'Verify identity for low-risk actions this session'
          );
          if (!authResult?.success) return { ...input, actionType, risk, autoApproved: false as const };
          biometricVerifiedRef.current = true;
          return { ...input, actionType, risk, autoApproved: true as const };
        }
      }

      return { ...input, actionType, risk, autoApproved: false as const };
    }));

    const pending = enriched.filter((e) => !e.autoApproved) as (PermissionRequestInput & { actionType: string; risk: ActionRiskLevel; autoApproved: false })[];
    if (pending.length === 0) return enriched.map(() => true);

    const settings = await getSecuritySettingsSafe();
    const requiresDeviceUnlock = settings?.requireDeviceUnlockForManualApproval !== false;

    return new Promise<boolean[]>((resolve) => {
      batchResolveRef.current = resolve;
      batchInputsLengthRef.current = inputs.length;

      setPendingPermission({
        resolve: (approved: boolean) => {
          batchResolveRef.current = null;
          if (!approved) {
            resolve(new Array<boolean>(inputs.length).fill(false));
          } else {
            resolve(new Array<boolean>(inputs.length).fill(true));
          }
        },
        mobileApproved: false,
        context: {
          actionType: 'BATCH',
          action: `Batch Shell Commands (${pending.length})`,
          target: pending.map((p) => p.target || '').join('\n'),
          what: pending.map((p) => p.what || p.target || '').join('\n'),
          reason: `The AI wants to execute ${pending.length} shell commands.`,
          risk: 'medium',
          highRiskQr: null,
          requiresDeviceUnlock,
        },
        batchCommands: pending.map((p) => ({
          index: enriched.indexOf(p),
          command: p.target || '',
          description: getCommandDescription(p.target || ''),
          irreversible: isIrreversibleCommand(p.target || ''),
          risk: p.risk,
          reason: p.reason,
        })),
      });
    });
  }, [requestPermission]);

  useEffect(() => {
    if (!window.electronAPI?.onAutomationShellApproval) {
      return;
    }

    const cleanup = window.electronAPI.onAutomationShellApproval(async (payload) => {
      const settings = await getSecuritySettingsSafe();
      const requiresDeviceUnlock = settings?.requireDeviceUnlockForManualApproval !== false;
      setPendingPermission({
        resolve: async (allowed: boolean) => {
          if (allowed && requiresDeviceUnlock && window.electronAPI?.authenticateBiometric) {
            const authResult = await window.electronAPI.authenticateBiometric(
              `Approve shell command: ${payload.command}`
            );
            if (!authResult?.success) {
              return;
            }
          }

          if (window.electronAPI?.respondAutomationShellApproval) {
            window.electronAPI.respondAutomationShellApproval({
              requestId: payload.requestId,
              allowed,
            });
            return;
          }

          window.electronAPI?.submitShellApprovalResponse?.(payload.requestId, allowed);
        },
        mobileApproved: false,
        context: {
          actionType: payload.actionType || 'SHELL_COMMAND',
          action: payload.action || 'Shell Command Approval',
          target: payload.command,
          what: payload.command,
          reason: payload.reason || 'An automated task needs to execute this shell command.',
          risk: normalizeRiskLevel(payload.risk),
          highRiskQr: payload.highRiskQr,
          requiresDeviceUnlock,
        },
      });
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onMobileApproveHighRisk) {
      return;
    }

    const cleanup = window.electronAPI.onMobileApproveHighRisk((data: { pin: string; id: string }) => {
      setPendingPermission((currentPending) => {
        if (!currentPending || currentPending.context.risk !== 'high') {
          return currentPending;
        }

        try {
          const qrData = JSON.parse(currentPending.context.highRiskQr || '{}');
          if (qrData.pin === data.pin && qrData.token === data.id) {
            return { ...currentPending, mobileApproved: true };
          }
        } catch (error) {
          console.error('[AI Security] Failed to parse high-risk approval payload:', error);
        }

        return currentPending;
      });
    });

    return cleanup;
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onApprovalActionResolved) return;
    const cleanup = window.electronAPI.onApprovalActionResolved((data: { requestId: string; allowed: boolean }) => {
      if (!data.allowed) {
        setPendingPermission((prev) => {
          if (prev) { prev.resolve(false); }
          return null;
        });
        return;
      }
      setPendingPermission((prev) => {
        if (prev) { prev.resolve(true); }
        return null;
      });
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!pendingPermission || pendingPermission.context.risk === 'high') {
        return;
      }

      if (event.shiftKey && event.key === 'Tab') {
        event.preventDefault();
        pendingPermission.resolve(true);
        setPendingPermission(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pendingPermission]);

  const approvalModal = useMemo(() => {
    if (!pendingPermission) {
      return null;
    }

    const isBatch = !!pendingPermission.batchCommands && pendingPermission.batchCommands.length > 0;

    return (
      <div className="fixed inset-0 z-[10001] flex items-start justify-center overflow-y-auto py-6 px-4 bg-black/60 backdrop-blur-md">
        {isBatch ? (
          <ClickPermissionModal
            context={pendingPermission.context}
            highRiskApproved={pendingPermission.mobileApproved}
            batchCommands={pendingPermission.batchCommands}
            onAllowBatch={(allowedIndices) => {
              const commands = pendingPermission.batchCommands!;
              const result = new Array<boolean>(batchInputsLengthRef.current).fill(true);
              const selectedSet = new Set(allowedIndices);
              for (let i = 0; i < commands.length; i++) {
                if (!selectedSet.has(i)) {
                  result[commands[i].index] = false;
                }
              }
              batchResolveRef.current?.(result);
              batchResolveRef.current = null;
              setPendingPermission(null);
            }}
            onDeny={() => {
              pendingPermission.resolve(false);
              setPendingPermission(null);
            }}
          />
        ) : (
          <ClickPermissionModal
            context={pendingPermission.context}
            highRiskApproved={pendingPermission.mobileApproved}
            onAllow={async (alwaysAllow) => {
              const context = pendingPermission.context;

              if (context.requiresDeviceUnlock && window.electronAPI?.authenticateBiometric) {
                const authResult = await window.electronAPI.authenticateBiometric(
                  `Approve action: ${context.action}`
                );
                if (!authResult?.success) {
                  return;
                }
              }

              if (alwaysAllow && window.electronAPI?.permGrant && context.risk !== 'high') {
                const permissionKey = getActionPermissionKey(context.actionType, context.target, context.what);
                await window.electronAPI.permGrant(permissionKey, 'execute', context.action, false);

                if (
                  context.actionType === 'SHELL_COMMAND' &&
                  window.electronAPI?.setAutoApprovalCommand &&
                  context.target
                ) {
                  await window.electronAPI.setAutoApprovalCommand({
                    command: context.target,
                    enabled: true,
                  });
                }
              }

              pendingPermission.resolve(true);
              setPendingPermission(null);
            }}
            onDeny={() => {
              pendingPermission.resolve(false);
              setPendingPermission(null);
            }}
          />
        )}
      </div>
    );
  }, [pendingPermission]);

  return {
    pendingPermission,
    requestPermission,
    requestBatchPermission,
    approvalModal,
  };
}
