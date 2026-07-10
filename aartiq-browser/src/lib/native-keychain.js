const { execSync } = require('child_process');
const path = require('path');

const KEYCHAIN_SERVICE_PREFIX = 'com.aartiq';

const macosKeychain = (() => {
  if (process.platform !== 'darwin') return null;
  try { return require('./macos-keychain'); }
  catch (e) { return null; }
})();

const windowsCredentialManager = (() => {
  if (process.platform !== 'win32') return null;
  try { return require('./windows-credential-manager'); }
  catch (e) { return null; }
})();

function escapeShellArg(arg) {
  return `${arg || ''}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function addPassword({ service, account, password, label }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;
  const safeLabel = label || `Aartiq: ${service || 'default'}`;

  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.addPassword({ account: account || 'default', service: target, password, label: safeLabel });
  }

  if (process.platform === 'win32' && windowsCredentialManager) {
    return windowsCredentialManager.addPassword({ target, account: account || 'default', password, label: safeLabel });
  }

  if (process.platform === 'win32') {
    try {
      execSync(
        `powershell -Command "Add-Type -AssemblyName System.Security; $s=ConvertTo-SecureString '${escapeShellArg(password)}' -AsPlainText -Force; [System.Net.NetworkCredential]::new('${escapeShellArg(account || 'default')}',$s).Password | Out-Null"`,
        { timeout: 10000, stdio: 'ignore' }
      );
    } catch {}
    return { success: true };
  }

  if (process.platform === 'linux') {
    try {
      execSync(
        `secret-tool store --label="${escapeShellArg(safeLabel)}" service "${escapeShellArg(target)}" account "${escapeShellArg(account || 'default')}" <<< "${escapeShellArg(password)}"`,
        { timeout: 10000, stdio: 'ignore' }
      );
    } catch {}
    return { success: true };
  }

  return { success: false, error: 'Unsupported platform' };
}

async function getPassword({ service, account }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;

  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.getPassword({ account: account || 'default', service: target });
  }

  if (process.platform === 'win32' && windowsCredentialManager) {
    return windowsCredentialManager.getPassword({ target, account: account || 'default' });
  }

  if (process.platform === 'linux') {
    try {
      const stdout = execSync(
        `secret-tool lookup service "${escapeShellArg(target)}" account "${escapeShellArg(account || 'default')}"`,
        { timeout: 10000, encoding: 'utf8' }
      );
      const password = `${stdout || ''}`.trim();
      if (password) return { success: true, password };
    } catch {}
    return { success: false, error: 'Not found' };
  }

  return { success: false, error: 'Unsupported platform' };
}

async function deletePassword({ service, account }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;

  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.deletePassword({ account: account || 'default', service: target });
  }

  if (process.platform === 'win32' && windowsCredentialManager) {
    return windowsCredentialManager.deletePassword({ target, account: account || 'default' });
  }

  if (process.platform === 'linux') {
    try {
      execSync(
        `secret-tool clear service "${escapeShellArg(target)}" account "${escapeShellArg(account || 'default')}"`,
        { timeout: 10000, stdio: 'ignore' }
      );
    } catch {}
    return { success: true };
  }

  return { success: false, error: 'Unsupported platform' };
}

module.exports = { addPassword, getPassword, deletePassword };
