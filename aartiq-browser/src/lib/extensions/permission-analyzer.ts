/**
 * Extension permission analyzer — risk scoring + conflict detection.
 *
 * Before installing/loading an extension we grade its permission footprint and
 * check for overlaps with already-installed extensions. High-risk permissions
 * (broad host access, scripting, native messaging, downloads, clipboard,
 * debugger) push the score up; the UI/agent can then require explicit approval.
 */

export interface ManifestPermissions {
  permissions?: string[];
  host_permissions?: string[];
  optional_permissions?: string[];
  optional_host_permissions?: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PermissionReport {
  risk: RiskLevel;
  score: number; // 0..100
  reasons: string[];
  broadHostAccess: boolean;
  sensitiveApis: string[];
}

const SENSITIVE = new Set([
  'scripting', 'debugger', 'nativeMessaging', 'downloads', 'clipboardRead', 'clipboardWrite',
  'tabCapture', 'desktopCapture', 'geolocation', 'management', 'proxy', 'webRequest',
  'webRequestBlocking', 'cookies', 'history', 'bookmarks', 'sessions', 'tabs', 'storage',
  'notifications', 'background',
]);

function isBroadHost(hosts: string[]): boolean {
  return hosts.some((h) => h === '<all_urls>' || h === '*://*/*' || h.endsWith('://*/*'));
}

export function analyzePermissions(manifest: ManifestPermissions): PermissionReport {
  const perms = manifest.permissions ?? [];
  const hosts = manifest.host_permissions ?? [];
  const reasons: string[] = [];
  let score = 0;

  if (isBroadHost(hosts)) {
    score += 40;
    reasons.push('Requests broad host access (<all_urls>).');
  } else if (hosts.length > 0) {
    score += Math.min(20, hosts.length * 4);
    reasons.push(`Requests access to ${hosts.length} specific host pattern(s).`);
  }

  const sensitive = perms.filter((p) => SENSITIVE.has(p));
  if (sensitive.length) {
    score += Math.min(45, sensitive.length * 9);
    reasons.push(`Uses sensitive APIs: ${sensitive.join(', ')}.`);
  }

  if (perms.includes('debugger') || perms.includes('nativeMessaging')) {
    score += 15;
    reasons.push('Can attach a debugger or use native messaging (high privilege).');
  }

  score = Math.max(0, Math.min(100, score));

  let risk: RiskLevel = 'low';
  if (score >= 60) risk = 'high';
  else if (score >= 30) risk = 'medium';

  return { risk, score, reasons, broadHostAccess: isBroadHost(hosts), sensitiveApis: sensitive };
}

export interface ConflictReport {
  conflicts: Array<{ extensionId: string; name: string; overlappingHosts: string[] }>;
}

/** Detect host-permission overlap with already-installed extensions. */
export function detectConflicts(
  candidate: ManifestPermissions,
  installed: Array<{ id: string; name: string; manifest: ManifestPermissions }>
): ConflictReport {
  const candHosts = new Set(candidate.host_permissions ?? []);
  const conflicts: ConflictReport['conflicts'] = [];
  for (const ext of installed) {
    const hosts = ext.manifest.host_permissions ?? [];
    const overlap = hosts.filter((h) => candHosts.has(h));
    if (overlap.length) conflicts.push({ extensionId: ext.id, name: ext.name, overlappingHosts: overlap });
  }
  return { conflicts };
}
