"use strict";
/**
 * Bootstrap — wires the feature managers + agent-api server into the Electron
 * main process. Kept defensive: any failure is logged, never fatal to the app.
 *
 * Page operations go through a PageAdapter built from Electron's BrowserWindow /
 * webContents, so the same tools work against the real browser tabs at runtime.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAgentApi = startAgentApi;
const electron = __importStar(require("electron"));
const guardrails_1 = require("../guardrails");
const agent_registry_1 = require("../agent/agent-registry");
const manager_1 = require("../snapshot/manager");
const bridge_1 = require("./bridge");
const server_1 = require("./server");
const providers_1 = require("./providers");
function webContentsFor(tabId) {
    const wins = electron.BrowserWindow.getAllWindows();
    if (tabId) {
        for (const w of wins) {
            if (String(w.webContents.id) === String(tabId))
                return w.webContents;
        }
    }
    return wins[0]?.webContents ?? null;
}
function buildPageAdapter() {
    return {
        async getAxTree(tabId) {
            const wc = webContentsFor(tabId);
            if (!wc)
                return [];
            const code = manager_1.SnapshotManager.collectorScript();
            const json = await wc.executeJavaScript(code);
            return typeof json === 'string' ? JSON.parse(json) : json;
        },
        async executeInTab(tabId, script) {
            const wc = webContentsFor(tabId);
            if (!wc)
                return null;
            return wc.executeJavaScript(script);
        },
        async navigate(tabId, url) {
            const wc = webContentsFor(tabId);
            if (wc)
                await wc.loadURL(url);
        },
        async listTabs() {
            return electron.BrowserWindow.getAllWindows().map((w) => ({
                id: String(w.webContents.id),
                url: w.webContents.getURL(),
                title: w.webContents.getTitle(),
            }));
        },
    };
}
async function startAgentApi(deps = {}) {
    try {
        const agents = new agent_registry_1.AgentRegistry();
        const security = new guardrails_1.SecurityPipeline({ agents: agents.trust });
        const snapshots = new manager_1.SnapshotManager();
        const bridge = new bridge_1.InProcessBridge({
            snapshots,
            vault: deps.vault,
            extensions: deps.extensions,
            pageAdapter: buildPageAdapter(),
        });
        const server = new server_1.AgentApiServer({
            bridge,
            security,
            agents,
            snapshots,
            vault: deps.vault,
            extensions: deps.extensions,
            config: deps.config ?? (0, providers_1.defaultConfig)(),
        });
        await server.start();
        console.log('[agent-api] started');
        return server;
    }
    catch (e) {
        console.error('[agent-api] failed to start:', e.message);
        return null;
    }
}
