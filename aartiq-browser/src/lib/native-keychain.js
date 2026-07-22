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

function escapeShellArgLinux(arg) {
  const str = `${arg || ''}`;
  // For Linux secret-tool: wrap in single quotes, escape embedded single quotes
  return `'${str.replace(/'/g, "'\\''")}'`;
}

async function addPassword({ service, account, password, label }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;
  const safeLabel = label || `Aartiq: ${service || 'default'}`;

  // macOS: Use native keychain module
  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.addPassword({ account: account || 'default', service: target, password, label: safeLabel });
  }

  // Windows: Use native credential manager module (required - no fallback)
  if (process.platform === 'win32') {
    if (!windowsCredentialManager) {
      return {
        success: false,
        error: 'Windows Credential Manager module not available',
        code: 'CREDENTIAL_MODULE_MISSING'
      };
    }
    return windowsCredentialManager.addPassword({ target, account: account || 'default', password, label: safeLabel });
  }

  // Linux: Use secret-tool CLI
  if (process.platform === 'linux') {
    try {
      const safeLabelEsc = escapeShellArgLinux(safeLabel);
      const safeTargetEsc = escapeShellArgLinux(target);
      const safeAccountEsc = escapeShellArgLinux(account || 'default');
      const safePasswordEsc = escapeShellArgLinux(password);
      execSync(
        `secret-tool store --label=${safeLabelEsc} service ${safeTargetEsc} account ${safeAccountEsc} <<< ${safePasswordEsc}`,
        { timeout: 10000, stdio: 'ignore' }
      );
      return { success: true };
    } catch (e) {
      return {
        success: false,
        code: 'KEYCHAIN_WRITE_FAILED',
        error: e.message,
        platform: 'linux'
      };
    }
  }

  return { success: false, error: 'Unsupported platform', code: 'UNSUPPORTED_PLATFORM' };
}

async function getPassword({ service, account }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;

  // macOS: Use native keychain module
  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.getPassword({ account: account || 'default', service: target });
  }

  // Windows: Use native credential manager module (required - no fallback)
  if (process.platform === 'win32') {
    if (!windowsCredentialManager) {
      return {
        success: false,
        error: 'Windows Credential Manager module not available',
        code: 'CREDENTIAL_MODULE_MISSING'
      };
    }
    return windowsCredentialManager.getPassword({ target, account: account || 'default' });
  }

  // Linux: Use secret-tool CLI
  if (process.platform === 'linux') {
    try {
      const safeTargetEsc = escapeShellArgLinux(target);
      const safeAccountEsc = escapeShellArgLinux(account || 'default');
      const stdout = execSync(
        `secret-tool lookup service ${safeTargetEsc} account ${safeAccountEsc}`,
        { timeout: 10000, encoding: 'utf8' }
      );
      const password = `${stdout || ''}`.trim();
      if (password) {
        return { success: true, password };
      }
      return { success: false, error: 'Password not found in keychain', code: 'NOT_FOUND' };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        code: 'KEYCHAIN_READ_FAILED',
        platform: 'linux'
      };
    }
  }

  return { success: false, error: 'Unsupported platform', code: 'UNSUPPORTED_PLATFORM' };
}

async function deletePassword({ service, account }) {
  const target = `${KEYCHAIN_SERVICE_PREFIX}.${service || 'default'}`;

  // macOS: Use native keychain module
  if (process.platform === 'darwin' && macosKeychain) {
    return macosKeychain.deletePassword({ account: account || 'default', service: target });
  }

  // Windows: Use native credential manager module (required - no fallback)
  if (process.platform === 'win32') {
    if (!windowsCredentialManager) {
      return {
        success: false,
        error: 'Windows Credential Manager module not available',
        code: 'CREDENTIAL_MODULE_MISSING'
      };
    }
    return windowsCredentialManager.deletePassword({ target, account: account || 'default' });
  }

  // Linux: Use secret-tool CLI
  if (process.platform === 'linux') {
    try {
      const safeTargetEsc = escapeShellArgLinux(target);
      const safeAccountEsc = escapeShellArgLinux(account || 'default');
      execSync(
        `secret-tool clear service ${safeTargetEsc} account ${safeAccountEsc}`,
        { timeout: 10000, stdio: 'ignore' }
      );
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        code: 'KEYCHAIN_DELETE_FAILED',
        platform: 'linux'
      };
    }
  }

  return { success: false, error: 'Unsupported platform', code: 'UNSUPPORTED_PLATFORM' };
}

module.exports = { addPassword, getPassword, deletePassword };
