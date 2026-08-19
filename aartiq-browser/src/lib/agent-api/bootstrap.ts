/**
 * Bootstrap — wires the feature managers + agent-api server into the Electron
 * main process. Kept defensive: any failure is logged, never fatal to the app.
 *
 * Page operations go through a PageAdapter built from Electron's BrowserWindow /
 * webContents, so the same tools work against the real browser tabs at runtime.
 */

import * as electron from 'electron';
import { SecurityPipeline } from '../guardrails';
import { AgentRegistry } from '../agent/agent-registry';
import { SnapshotManager } from '../snapshot/manager';
import { InProcessBridge, type PageAdapter } from './bridge';
import { AgentApiServer } from './server';
import { defaultConfig } from './providers';
import type { AgentApiConfig } from './types';

export interface BootstrapDeps {
  extensions?: any;
  vault?: any;
  config?: Partial<AgentApiConfig>;
}

function webContentsFor(tabId?: string): Electron.WebContents | null {
  const wins = electron.BrowserWindow.getAllWindows();
  if (tabId) {
    for (const w of wins) {
      if (String(w.webContents.id) === String(tabId)) return w.webContents;
    }
  }
  return wins[0]?.webContents ?? null;
}

function buildPageAdapter(): PageAdapter {
  return {
    async getAxTree(tabId) {
      const wc = webContentsFor(tabId);
      if (!wc) return [];
      const code = SnapshotManager.collectorScript();
      const json = await wc.executeJavaScript(code);
      return typeof json === 'string' ? JSON.parse(json) : json;
    },
    async executeInTab(tabId, script) {
      const wc = webContentsFor(tabId);
      if (!wc) return null;
      return wc.executeJavaScript(script);
    },
    async navigate(tabId, url) {
      const wc = webContentsFor(tabId);
      if (wc) await wc.loadURL(url);
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

export async function startAgentApi(deps: BootstrapDeps = {}): Promise<AgentApiServer | null> {
  try {
    const agents = new AgentRegistry();
    const security = new SecurityPipeline({ agents: agents.trust });
    const snapshots = new SnapshotManager();
    const bridge = new InProcessBridge({
      snapshots,
      vault: deps.vault,
      extensions: deps.extensions,
      pageAdapter: buildPageAdapter(),
    });
    const server = new AgentApiServer({
      bridge,
      security,
      agents,
      snapshots,
      vault: deps.vault,
      extensions: deps.extensions,
      config: deps.config ?? defaultConfig(),
    });
    await server.start();
    console.log('[agent-api] started');
    return server;
  } catch (e) {
    console.error('[agent-api] failed to start:', (e as Error).message);
    return null;
  }
}
