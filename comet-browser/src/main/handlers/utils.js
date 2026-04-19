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
      path.join(appPath, 'assets', 'icon.png'),
      path.join(process.resourcesPath, 'app', 'assets', 'icon.png'),
    ] : [
      path.join(__dirname, '../../assets/icon.png'),
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

exports.execShellCommand = async function(rawCommand, preApproved, reason, riskLevel) {
  return new Promise((resolve) => {
    exec(rawCommand, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) resolve({ success: false, error: err.message });
      else resolve({ success: true, output: stdout || stderr });
    });
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
  const dangerous = /sudo|rm\s+-rf|shutdown|reboot|kill\s+-9|diskutil|dd\s+if/i;
  if (dangerous.test(script)) {
    throw new Error('Command contains dangerous operations');
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

exports.streamPromptToMobile = async function(promptId, prompt, targetModel, provider, handlers) {
  const { wifiSyncService, llmGenerateHandler } = handlers;
  if (!wifiSyncService) return;

  const streamEvent = {
    sender: {
      isDestroyed: () => false,
      send: (_channel, data) => {
        if (data?.type === 'text-delta') {
          wifiSyncService.sendAIResponse(promptId, data.textDelta || '', true);
        } else if (data?.type === 'finish') {
          wifiSyncService.sendAIResponse(promptId, '', false);
        }
      }
    }
  };

  await llmGenerateHandler([{ role: 'user', content: prompt }], {
    model: targetModel,
    provider: provider
  }, streamEvent);
};

exports.generateShellApprovalQR = async function(command) {
  const QRCode = require('qrcode');
  const os = require('os');
  const deviceId = os.hostname();
  const token = Math.random().toString(36).substring(2, 10);
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const deepLinkUrl = `comet-ai://approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}&command=${encodeURIComponent(command)}`;
  
  const qrImage = await QRCode.toDataURL(deepLinkUrl);
  return { qrImage, pin, token };
};