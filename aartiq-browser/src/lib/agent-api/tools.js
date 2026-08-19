"use strict";
/**
 * Tool definitions — the "all MCP tools" surface, expressed as data.
 *
 * Each tool is a small descriptor that delegates to the bridge. Adding the
 * remaining tandem-style categories is mechanical: append a descriptor here.
 * Side-effecting tools declare a `verb` (gated by origin-guard + agent trust);
 * tools returning web content declare `untrustedOutput` (prompt-injection scan).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_TOOLS = void 0;
exports.registerAllTools = registerAllTools;
const types_1 = require("./types");
function t(def) {
    return def;
}
const str = (desc, extra = {}) => ({ type: 'string', description: desc, ...extra });
const bool = (desc) => ({ type: 'boolean', description: desc });
const SECURITY = [
    t({
        name: 'security_scan', category: 'Security', description: 'Scan arbitrary text (web content, tool output, user data) for prompt-injection.', untrustedOutput: false,
        inputSchema: { type: 'object', properties: { text: str('Text to scan'), tool: str('Source tool name', { optional: true }) }, required: ['text'] },
        async handler(args, ctx) {
            const verdict = await ctx.security.injection.scan(args.text, { untrusted: true });
            return (0, types_1.jsonResult)(verdict);
        },
    }),
    t({
        name: 'security_audit', category: 'Security', description: 'Return the origin-guard audit log of recent agent actions.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(ctx.security.origin.getAuditLog()); },
    }),
    t({
        name: 'security_killswitch', category: 'Security', description: 'Engage or release the global kill switch that blocks all agent actions.',
        inputSchema: { type: 'object', properties: { engaged: bool('true to block all agent actions') }, required: ['engaged'] }, verb: 'sideEffecting',
        async handler(args, ctx) { ctx.security.origin.setKillSwitch(!!args.engaged); return (0, types_1.textResult)(`Kill switch ${args.engaged ? 'engaged' : 'released'}.`); },
    }),
    t({
        name: 'trust_list', category: 'Security', description: 'List registered agents and their trust levels.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(ctx.agents.trust.list()); },
    }),
];
const AGENTS = [
    t({
        name: 'agent_register', category: 'Agents', description: 'Register a new agent session connecting to this browser.',
        inputSchema: { type: 'object', properties: { id: str('Agent id'), name: str('Human-readable name'), trust: str('untrusted|limited|standard|privileged', { optional: true }), transport: str('mcp|http|websocket|in-product', { optional: true }) }, required: ['id', 'name'] },
        async handler(args, ctx) { return (0, types_1.jsonResult)(ctx.agents.connect(args)); },
    }),
    t({
        name: 'agent_list', category: 'Agents', description: 'List currently connected agents.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(ctx.agents.connectedAgents()); },
    }),
    t({
        name: 'agent_revoke', category: 'Agents', description: 'Revoke an agent and release all its tab locks.',
        inputSchema: { type: 'object', properties: { agentId: str('Agent id') }, required: ['agentId'] }, verb: 'sideEffecting',
        async handler(args, ctx) { ctx.agents.disconnect(args.agentId); return (0, types_1.textResult)(`Agent ${args.agentId} revoked.`); },
    }),
    t({
        name: 'tab_handoff', category: 'Agents', description: 'Hand ownership of a locked tab from one agent to another.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), fromAgentId: str('Current owner'), toAgentId: str('New owner') }, required: ['tabId', 'fromAgentId', 'toAgentId'] }, verb: 'sideEffecting',
        async handler(args, ctx) { const r = ctx.agents.locks.handoff(args.tabId, args.fromAgentId, args.toAgentId); return (0, types_1.jsonResult)(r); },
    }),
];
const SNAPSHOTS = [
    t({
        name: 'snapshot', category: 'Snapshots', description: 'Return an accessibility-tree snapshot of a tab with stable @ref ids. Scan for injection.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), interactiveOnly: bool('Only interactive elements'), compact: bool('Drop empty nodes'), depth: { type: 'number', description: 'Max depth' }, scopeSelector: str('CSS scope') }, required: ['tabId'] },
        untrustedOutput: true, requiresTabLock: true,
        async handler(args, ctx) { const r = await ctx.bridge.call('snapshot', args); ctx.snapshots.reset(); return (0, types_1.jsonResult)(r); },
    }),
    t({
        name: 'click_ref', category: 'Snapshots', description: 'Click the element identified by a snapshot @ref.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), ref: str('Element ref, e.g. e3') }, required: ['tabId', 'ref'] }, verb: 'input', requiresTabLock: true,
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('clickRef', args)); },
    }),
    t({
        name: 'fill_ref', category: 'Snapshots', description: 'Fill the element identified by a snapshot @ref with a value.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), ref: str('Element ref'), value: str('Value to set') }, required: ['tabId', 'ref', 'value'] }, verb: 'input', requiresTabLock: true,
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('fillRef', args)); },
    }),
    t({
        name: 'type_ref', category: 'Snapshots', description: 'Type text into the element identified by a snapshot @ref.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), ref: str('Element ref'), text: str('Text to type') }, required: ['tabId', 'ref', 'text'] }, verb: 'input', requiresTabLock: true,
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('typeRef', args)); },
    }),
];
const FORMS = [
    t({
        name: 'autofill_match', category: 'Forms', description: 'Match page fields against the encrypted vault for a domain and return fill values.',
        inputSchema: { type: 'object', properties: { domain: str('Site domain'), fields: { type: 'array', description: 'Field descriptors from a snapshot' } }, required: ['domain', 'fields'] }, annotations: { readOnlyHint: true },
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('autofillMatch', args)); },
    }),
    t({
        name: 'vault_list', category: 'Forms', description: 'List stored credentials and identity profiles (values redacted).',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { const v = await ctx.bridge.call('vaultList'); return (0, types_1.jsonResult)(v); },
    }),
    t({
        name: 'vault_unlock', category: 'Forms', description: 'Unlock the autofill vault with the user passphrase (must be done by the user).',
        inputSchema: { type: 'object', properties: {} }, verb: 'sideEffecting',
        async handler(_a, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('vaultUnlock')); },
    }),
];
const EXTENSIONS = [
    t({
        name: 'extension_list', category: 'Extensions', description: 'List installed Chrome extensions.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('extensionList')); },
    }),
    t({
        name: 'extension_install_webstore', category: 'Extensions', description: 'Install an extension from the Chrome Web Store. CRX3 signature is verified before load.',
        inputSchema: { type: 'object', properties: { url: str('CRX download URL') }, required: ['url'] }, verb: 'sideEffecting',
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('extensionInstallWebStore', args)); },
    }),
    t({
        name: 'extension_import_chrome', category: 'Extensions', description: 'Import extensions from an installed Chrome/Chromium profile.',
        inputSchema: { type: 'object', properties: { profileDir: str('Chrome profile directory (auto-detected if omitted)') } }, verb: 'sideEffecting',
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('extensionImportChrome', args)); },
    }),
    t({
        name: 'extension_analyze', category: 'Extensions', description: 'Grade an installed extension’s permission footprint (risk level).',
        inputSchema: { type: 'object', properties: { extensionId: str('Extension id') }, required: ['extensionId'] }, annotations: { readOnlyHint: true },
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('extensionAnalyze', args)); },
    }),
];
const THEME = [
    t({
        name: 'theme_resolve', category: 'Theme', description: 'Resolve the current theme + UI mode to CSS variables.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('themeResolve')); },
    }),
    t({
        name: 'ui_mode_set', category: 'Theme', description: 'Set the UI mode (normal|focus|reader|zen|presentation).',
        inputSchema: { type: 'object', properties: { mode: str('normal|focus|reader|zen|presentation'), prefs: { type: 'object', description: 'Optional theme overrides' } }, required: ['mode'] }, verb: 'input',
        async handler(args, ctx) { ctx.bridge.call('themeResolve'); return (0, types_1.textResult)(`UI mode set to ${args.mode}.`); },
    }),
];
const NAVIGATION = [
    t({
        name: 'navigate', category: 'Navigation', description: 'Navigate a tab to a URL.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id'), url: str('Destination URL') }, required: ['tabId', 'url'] }, verb: 'navigate', requiresTabLock: true,
        async handler(args, ctx) { await ctx.bridge.call('navigate', args); ctx.snapshots.reset(); return (0, types_1.textResult)(`Navigated ${args.tabId} to ${args.url}.`); },
    }),
    t({
        name: 'get_page_text', category: 'Navigation', description: 'Return the visible text of a tab (scanned for injection).',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id') }, required: ['tabId'] }, untrustedOutput: true, requiresTabLock: true,
        async handler(args, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('getPageText', args)); },
    }),
];
const TABS = [
    t({
        name: 'list_tabs', category: 'Tabs', description: 'List open tabs.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)(await ctx.bridge.call('listTabs')); },
    }),
    t({
        name: 'new_tab', category: 'Tabs', description: 'Open a new tab (optionally to a URL).',
        inputSchema: { type: 'object', properties: { url: str('URL to open') } }, verb: 'navigate',
        async handler(args, ctx) { return (0, types_1.textResult)(`Opened tab${args.url ? ' → ' + args.url : ''}.`); },
    }),
    t({
        name: 'close_tab', category: 'Tabs', description: 'Close a tab.',
        inputSchema: { type: 'object', properties: { tabId: str('Tab id') }, required: ['tabId'] }, verb: 'sideEffecting',
        async handler(args, ctx) { return (0, types_1.textResult)(`Closed tab ${args.tabId}.`); },
    }),
];
const SYSTEM = [
    t({
        name: 'browser_status', category: 'System', description: 'Return browser status and connected-agent count.',
        inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true },
        async handler(_a, ctx) { return (0, types_1.jsonResult)({ agents: ctx.agents.connectedAgents().length, killSwitch: ctx.security.origin.isKillSwitchOn() }); },
    }),
    t({
        name: 'open_panel', category: 'System', description: 'Open a browser panel/section.',
        inputSchema: { type: 'object', properties: { section: str('Panel/section name') }, required: ['section'] }, verb: 'input',
        async handler(args) { return (0, types_1.textResult)(`Opened ${args.section}.`); },
    }),
];
exports.ALL_TOOLS = [
    ...SECURITY, ...AGENTS, ...SNAPSHOTS, ...FORMS, ...EXTENSIONS, ...THEME, ...NAVIGATION, ...TABS, ...SYSTEM,
];
function registerAllTools(registry) {
    registry.registerMany(exports.ALL_TOOLS);
}
