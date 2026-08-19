"use strict";
/**
 * InProcessBridge — implements tool methods directly against the feature managers
 * inside the browser main process. Page-dependent operations are delegated to a
 * PageAdapter (supplied by main.js at runtime; mocked in tests). A RemoteBridge
 * (HTTP) can expose the same surface to external MCP/HTTP agents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InProcessBridge = void 0;
exports.createRemoteBridge = createRemoteBridge;
class InProcessBridge {
    constructor(deps) {
        this.deps = deps;
    }
    listMethods() {
        return [
            'snapshot', 'clickRef', 'fillRef', 'typeRef', 'navigate', 'getPageText',
            'listTabs', 'autofillMatch', 'vaultList', 'vaultUnlock',
            'extensionList', 'extensionInstallWebStore', 'extensionImportChrome', 'extensionAnalyze',
            'themeResolve', 'agentRegister', 'agentList', 'agentRevoke',
        ];
    }
    async call(method, args = {}) {
        const pa = this.deps.pageAdapter;
        switch (method) {
            case 'snapshot': {
                if (!pa)
                    throw new Error('No page adapter configured.');
                const raw = await pa.getAxTree(String(args.tabId));
                const result = this.deps.snapshots.build(raw, args.options || {});
                return result;
            }
            case 'clickRef':
                return pa.executeInTab(String(args.tabId), `/* click element by ref */ (function(){var els=document.querySelectorAll('[data-ref="${args.ref}"]'); if(els[0]) els[0].click();})();`);
            case 'fillRef':
                return pa.executeInTab(String(args.tabId), `/* fill by ref */ (function(){var el=document.querySelector('[data-ref="${args.ref}"]'); if(el){el.value=${JSON.stringify(args.value)}; el.dispatchEvent(new Event('input',{bubbles:true}));}})();`);
            case 'typeRef':
                return pa.executeInTab(String(args.tabId), `/* type by ref */ (function(){var el=document.querySelector('[data-ref="${args.ref}"]'); if(el){el.focus(); el.value+=${JSON.stringify(args.text)}; el.dispatchEvent(new Event('input',{bubbles:true}));}})();`);
            case 'navigate':
                return pa.navigate(String(args.tabId), String(args.url));
            case 'getPageText':
                return pa.executeInTab(String(args.tabId), 'document.body ? document.body.innerText : ""');
            case 'listTabs':
                return pa.listTabs();
            case 'autofillMatch': {
                if (!this.deps.vault)
                    throw new Error('Vault not available.');
                return this.deps.vault.matchForm(String(args.domain), args.fields || []);
            }
            case 'vaultList':
                return { credentials: this.deps.vault?.listCredentials?.() ?? [], profiles: this.deps.vault?.listProfiles?.() ?? [] };
            case 'vaultUnlock':
                this.deps.vault?.unlock();
                return { unlocked: true };
            case 'extensionList':
                return this.deps.extensions?.getInstalledExtensions?.() ?? [];
            case 'extensionInstallWebStore':
                return this.deps.extensions?.installFromWebStore?.(args.url);
            case 'extensionImportChrome':
                return this.deps.extensions?.importFromChrome?.(args.profileDir);
            case 'extensionAnalyze':
                return this.deps.extensions?.analyzePermissions?.(args.extensionId);
            case 'themeResolve':
                return this.deps.themeState?.current ?? { mode: 'normal', prefs: {} };
            case 'agentRegister':
                return this.deps.agents?.connect?.(args);
            case 'agentList':
                return this.deps.agents?.connectedAgents?.() ?? [];
            case 'agentRevoke':
                this.deps.agents?.disconnect?.(args.agentId);
                return { revoked: true };
            default:
                throw new Error(`Unknown bridge method: ${method}`);
        }
    }
}
exports.InProcessBridge = InProcessBridge;
/** Build a Bridge from a plain HTTP client (remote agent over Tailscale/LAN). */
function createRemoteBridge(baseUrl, fetchImpl) {
    return {
        listMethods: () => [],
        async call(method, args = {}) {
            const res = await fetchImpl(`${baseUrl}/api/${method}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(args ?? {}),
            });
            if (!res.ok)
                throw new Error(`Bridge ${method} failed: ${res.status}`);
            return (await res.json());
        },
    };
}
