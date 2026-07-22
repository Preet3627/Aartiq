/**
 * shell-permission-bridge.js
 *
 * Singleton bridge connecting main-process shell execution permission checks
 * with renderer-side interactive permission approval prompts.
 *
 * Flow:
 *   1. utils.js / execShellCommand detects unauthorized command
 *   2. Calls requestShellPermission(command, reason, riskLevel)
 *   3. Emits 'shell-permission-request' to renderer via mainWindow IPC
 *   4. Renderer shows permission approval modal (Allow Once / Allow Always / Deny)
 *   5. Renderer responds via respondShellPermission ('shell-permission-response' IPC)
 *   6. Bridge resolves promise -> utils.js proceeds with execution or returns error
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class ShellPermissionBridge extends EventEmitter {
  constructor() {
    super();
    this._mainWindow = null;
    /** @type {Map<string, { resolve: (res: { granted: boolean, remember: boolean }) => void, command: string, reason: string, riskLevel: string }>} */
    this._pending = new Map();
  }

  /** Called from main.js after BrowserWindow is created */
  setMainWindow(win) {
    this._mainWindow = win;
  }

  /**
   * Request shell execution permission from the user via renderer UI.
   * Returns a promise resolving to { granted: boolean, remember: boolean }.
   * Auto-denies after 60s timeout.
   */
  requestShellPermission(command, reason, riskLevel) {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();

      // Auto-deny after 60s
      const timer = setTimeout(() => {
        if (this._pending.has(requestId)) {
          this._pending.delete(requestId);
          resolve({ granted: false, remember: false });
        }
      }, 60_000);

      this._pending.set(requestId, {
        resolve: (result) => {
          clearTimeout(timer);
          this._pending.delete(requestId);
          resolve(result);
        },
        command,
        reason,
        riskLevel,
      });

      if (this._mainWindow && !this._mainWindow.isDestroyed()) {
        this._mainWindow.webContents.send('shell-permission-request', {
          requestId,
          command,
          reason,
          riskLevel,
        });
      } else {
        clearTimeout(timer);
        this._pending.delete(requestId);
        resolve({ granted: false, remember: false });
      }
    });
  }

  /**
   * Called from IPC handler when renderer responds.
   */
  resolvePermission(requestId, granted, remember = false) {
    const entry = this._pending.get(requestId);
    if (entry) {
      entry.resolve({ granted: !!granted, remember: !!remember });
    }
  }

  get pendingCount() {
    return this._pending.size;
  }
}

const bridge = new ShellPermissionBridge();
module.exports = bridge;
