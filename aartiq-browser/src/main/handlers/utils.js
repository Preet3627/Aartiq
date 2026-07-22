const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

exports.getAppIcon = async function(appPath) {
  if (!appPath || process.platform !== 'darwin') return null;
  return appPath;
};

exports.getAppIconBase64 = async function() {
  try {
    const { app } = require('electron');
    const appPath = app.getAppPath();
    const isPackaged = app.isPackaged;
    const candidates = isPackaged ? [
      path.join(appPath, 'assets', 'icon-transparent.png'),
      path.join(appPath, 'assets', 'icon.png'),
      path.join(appPath, 'app.asar.unpacked', 'assets', 'icon-transparent.png'),
      path.join(appPath, 'app.asar.unpacked', 'assets', 'icon.png'),
      path.join(process.resourcesPath, 'app', 'assets', 'icon-transparent.png'),
      path.join(process.resourcesPath, 'app', 'assets', 'icon.png'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon-transparent.png'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png'),
      path.join(process.resourcesPath, 'assets', 'icon-transparent.png'),
      path.join(process.resourcesPath, 'assets', 'icon.png'),
    ] : [
      path.join(__dirname, '../../assets/icon-transparent.png'),
      path.join(__dirname, '../../assets/icon.png'),
      path.join(appPath, 'assets/icon-transparent.png'),
      path.join(appPath, 'assets/icon.png'),
    ];
    for (const iconPath of candidates) {
      if (fs.existsSync(iconPath)) {
        const mime = iconPath.endsWith('.png') ? 'image/png' : 'image/x-icon';
        return `data:${mime};base64,${fs.readFileSync(iconPath).toString('base64')}`;
      }
    }
    return null;
  } catch (e) { return null; }
};

exports.scanDirectoryRecursive = async function(folderPath, types) {
  const results = [];
  const scan = async (dir, depth = 0) => {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!types || types.includes(ext)) {
            results.push({ name: entry.name, path: fullPath, size: fs.statSync(fullPath).size });
          }
        }
      }
    } catch (e) {}
  };
  await scan(folderPath);
  return results;
};

exports.searchApplications = async function(query) {
  const platform = process.platform;
  const results = [];
  try {
    if (platform === 'win32') {
      const searchPaths = [path.join(process.env.ProgramData, 'Microsoft/Windows/Start Menu/Programs'), path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs')];
      for (const searchPath of searchPaths) {
        if (fs.existsSync(searchPath)) {
          const getFiles = (dir, depth = 0) => {
            if (depth > 3) return [];
            let res = [];
            try {
              const list = fs.readdirSync(dir, { withFileTypes: true });
              for (const file of list) {
                const resPath = path.resolve(dir, file.name);
                if (file.isDirectory()) res = res.concat(getFiles(resPath, depth + 1));
                else if (file.name.toLowerCase().includes(query.toLowerCase()) && (file.name.endsWith('.lnk') || file.name.endsWith('.exe'))) res.push({ name: path.basename(file.name, path.extname(file.name)), path: resPath });
              }
            } catch (e) { return []; }
            return res;
          };
          results.push(...getFiles(searchPath));
        }
      }
    } else if (platform === 'darwin') {
      const appsPath = '/Applications';
      if (fs.existsSync(appsPath)) {
        const apps = fs.readdirSync(appsPath);
        apps.forEach(app => {
          if (app.toLowerCase().includes(query.toLowerCase()) && app.endsWith('.app')) {
            results.push({ name: path.basename(app, '.app'), path: path.join(appsPath, app) });
          }
        });
      }
    }
  } catch (e) { console.error('Search apps error:', e); }
  return { success: true, results: results.slice(0, 20) };
};

/**
 * Execute a shell command through the full validation + permission pipeline.
 *
 * Call path: AIChatSidebar.tsx → preload → execute-shell-command IPC → here
 *
 * 1. Validate command via SecurityValidator (dangerous patterns, blocked list)
 * 2. Check permission store via checkShellPermission (risk-tiered)
 * 3. Execute via sandboxed executor (OS-level filesystem/network confinement)
 *
 * Audit-doc line items: 3b (system-handlers.js execute-shell-command),
 * 3c (shell-executor.js), 3d (command-validator.js checkShellPermission),
 * §6 (OS-level sandboxing).
 */
/**
 * Extract file paths from a shell command string.
 * Handles quoted paths, unquoted paths after common flags, and bare paths.
 */
function extractPathsFromCommand(command) {
  const paths = new Set();
  // Match quoted paths (single or double quotes)
  const quoted = command.match(/(?:"([^"]+)"|'([^']+)')/g);
  if (quoted) {
    for (const q of quoted) {
      const p = q.slice(1, -1);
      if (p.startsWith('/') || p.startsWith('~/') || p.startsWith('.')) {
        paths.add(p);
      }
    }
  }
  // Match common file operation flags followed by paths
  const flagPattern = /(?:-[^o\s]*\s+)?((?:\/[\w./-]+|(?:~\/|\.\.?\/)[\w./-]+))/g;
  let match;
  while ((match = flagPattern.exec(command)) !== null) {
    const p = match[1];
    if (p && !p.startsWith('-')) {
      paths.add(p);
    }
  }
  return [...paths];
}

exports.execShellCommand = async function(rawCommand, preApproved, reason, riskLevel) {
  const { validateCommand, checkShellPermission, analyzeCommandRisk } = require('../../core/command-validator');
  const { validateCommand: securityValidate } = require('../../lib/SecurityValidator');
  const { executeSandboxed } = require('../../core/sandbox-executor');

  // 1. Basic validation (empty, too long, dangerous patterns, blocked commands)
  let command;
  try {
    command = validateCommand(rawCommand);
  } catch (e) {
    return { success: false, error: e.message };
  }

  // 2. Determine risk level if not provided
  const effectiveRisk = riskLevel || analyzeCommandRisk(command);

  // 3. Directory allowlist check
  try {
    const { PermissionStore } = require('../../lib/permission-store');
    const store = new PermissionStore();
    await store.load();
    const allowedDirs = store.getAllowedDirectories();
    const paths = extractPathsFromCommand(command);
    for (const p of paths) {
      if (!store.isDirectoryAllowed(p)) {
        store.logAudit(`directory-allowlist.blocked: ${p} in command: ${command}`);
        return {
          success: false,
          error: `Access denied: "${p}" is outside the allowed directories. Add it in Settings > Permissions > Directory Allowlist.`,
          blockedPath: p,
          allowedDirectories: allowedDirs,
        };
      }
    }
  } catch (e) {
    // If permission store fails to load, continue without directory check
    console.warn('[execShellCommand] Directory allowlist check skipped:', e.message);
  }

  // 4. Permission check — blocks execution unless explicitly granted
  if (!preApproved) {
    const authorized = checkShellPermission(command, reason, effectiveRisk);
    if (!authorized) {
      return { success: false, error: 'Shell command not authorized. Grant permission in Settings > Permissions or approve via the permission dialog.' };
    }
  }

  // 5. Execute via sandboxed executor (OS-level confinement)
  //    For high/critical risk, disable sandbox escape and enforce stricter limits
  const useSandbox = effectiveRisk !== 'low';
  const cmdParts = command.trim().split(/\s+/);
  const cmdBinary = cmdParts[0];
  const cmdArgs = cmdParts.slice(1);

  // Build directory allowlist for sandbox profile
  let directoryAllowlist = null;
  try {
    const { PermissionStore } = require('../../lib/permission-store');
    const store = new PermissionStore();
    await store.load();
    directoryAllowlist = store.getAllowedDirectories();
  } catch (e) {
    // Fall through with null allowlist (sandbox will use workspace-only fallback)
  }

  return await executeSandboxed(cmdBinary, cmdArgs, {
    useSandbox,
    timeout: 30000,
    directoryAllowlist,
    networkAllowlist: effectiveRisk === 'high' || effectiveRisk === 'critical' ? [] : undefined,
  });
};

exports.deriveKey = async function(passphrase, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passphrase, salt, 100000, 32, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey);
    });
  });
};

exports.validateCommand = function(script) {
  const { validateCommand: securityValidate } = require('../../lib/SecurityValidator');
  const result = securityValidate(script);
  if (!result.valid) {
    throw new Error(result.errors.join('; '));
  }
};

exports.getProviderModels = async function(providerId, options) {
  return [];
};

exports.testGeminiApi = async function(apiKey) {
  return { success: true };
};

// ============================================================================
// NATIVE UI HELPERS
// ============================================================================

exports.deliverNativeMacUiEvent = async function(channel, payload = {}, mainWindow) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
    return { success: true };
  }
  return { success: false, error: 'No active window' };
};

exports.createNativeMacUiSnapshot = function(store) {
  const Store = require('electron-store');
  const s = store || new Store();
  return {
    theme: s.get('theme') || 'system',
    llmProvider: s.get('ai_provider') || 'google',
    model: s.get('gemini_model') || 'gemini-2.0-flash',
    timestamp: Date.now()
  };
};

exports.normalizeMacNativePanelMode = function(mode = 'sidebar') {
  const allowed = ['sidebar', 'mini', 'glass', 'panel', 'settings'];
  return allowed.includes(mode.toLowerCase()) ? mode.toLowerCase() : 'sidebar';
};

// ============================================================================
// SYNC & APPROVAL HELPERS
// ============================================================================

exports.generateShellApprovalQR = async function(command) {
  const QRCode = require('qrcode');
  const os = require('os');
  const deviceId = os.hostname();
  const { randomBytes } = require('crypto');
  const token = randomBytes(5).toString('hex');
  const pin = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  const deepLinkUrl = `aartiq://approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}&command=${encodeURIComponent(command)}`;
  
  const qrImage = await QRCode.toDataURL(deepLinkUrl);
  return { qrImage, pin, token };
};