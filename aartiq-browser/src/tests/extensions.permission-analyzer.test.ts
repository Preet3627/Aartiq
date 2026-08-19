import { analyzePermissions, detectConflicts } from '../lib/extensions/permission-analyzer';

describe('Extension permission analyzer', () => {
  it('flags broad host access + sensitive APIs as high risk', () => {
    const r = analyzePermissions({ permissions: ['debugger', 'scripting', 'nativeMessaging'], host_permissions: ['<all_urls>'] });
    expect(r.risk).toBe('high');
    expect(r.broadHostAccess).toBe(true);
    expect(r.sensitiveApis).toContain('debugger');
  });

  it('treats a minimal extension as low risk', () => {
    const r = analyzePermissions({ permissions: ['storage'], host_permissions: [] });
    expect(r.risk).toBe('low');
  });

  it('detects host-permission conflicts with installed extensions', () => {
    const candidate = { host_permissions: ['https://a.com/*'] };
    const installed = [{ id: 'e1', name: 'Existing', manifest: { host_permissions: ['https://a.com/*'] } }];
    const c = detectConflicts(candidate, installed);
    expect(c.conflicts.length).toBe(1);
    expect(c.conflicts[0].name).toBe('Existing');
  });
});
