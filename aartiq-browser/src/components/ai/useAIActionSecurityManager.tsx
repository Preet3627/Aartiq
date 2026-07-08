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
}

interface PendingPermission {
  resolve: (allowed: boolean) => void;
  mobileApproved: boolean;
  context: PermissionContext;
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
      return true;
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

    return (
      <div className="absolute inset-0 z-[10001] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
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
      </div>
    );
  }, [pendingPermission]);

  return {
    pendingPermission,
    requestPermission,
    approvalModal,
  };
}
