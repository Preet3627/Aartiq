const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const HELPER_NAME = 'Aartiq';

let _webauthnService = null;
function getWebauthnService() {
    if (_webauthnService === null) {
        try {
            _webauthnService = require('./webauthn-service');
        } catch (err) {
            console.warn('[NativeVerifier] WebAuthn service not available:', err.message);
            _webauthnService = false;
        }
    }
    return _webauthnService || false;
}

function getMacHelperPaths() {
  return {
    bundledBinary: path.join(process.resourcesPath || '', 'bin', HELPER_NAME),
    localBinary: path.join(__dirname, '..', '..', 'bin', HELPER_NAME),
    swiftScript: path.join(__dirname, 'macos-device-unlock.swift'),
  };
}

async function ensureLocalMacHelperBinary(swiftScript, localBinary) {
  if (!fs.existsSync(swiftScript)) {
    return false;
  }

  // If inside asar, we can't compile to localBinary (which is inside asar) or read swiftScript directly.
  if (swiftScript.includes('.asar') || localBinary.includes('.asar')) {
    return false;
  }

  const scriptStat = fs.statSync(swiftScript);
  const binaryExists = fs.existsSync(localBinary);
  const binaryIsFresh = binaryExists && fs.statSync(localBinary).mtimeMs >= scriptStat.mtimeMs;

  if (binaryIsFresh) {
    return true;
  }

  fs.mkdirSync(path.dirname(localBinary), { recursive: true });
  await execFileAsync('swiftc', [swiftScript, '-o', localBinary], {
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  fs.chmodSync(localBinary, 0o755);
  return true;
}

function hasNativeDeviceUnlockSupport() {
  if (process.platform === 'win32') {
    return true; // We now support PowerShell-based unlock as a fallback
  }

  if (process.platform !== 'darwin') {
    return false;
  }

  const { bundledBinary, localBinary, swiftScript } = getMacHelperPaths();

  return fs.existsSync(bundledBinary) || fs.existsSync(localBinary) || fs.existsSync(swiftScript);
}

async function runHelper(command, args, mode) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    
    if (stderr && !stdout) {
      console.warn(`[NativeVerifier] Subprocess stderr: ${stderr}`);
    }

    const trimmed = `${stdout || ''}`.trim();
    if (!trimmed) {
      return { supported: true, approved: false, mode, error: 'Verifier returned no output.' };
    }

    // Fix: Find the JSON line in case of diagnostic messages
    const lines = trimmed.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            const parsed = JSON.parse(lines[i]);
            return {
                supported: parsed.supported !== false,
                approved: !!parsed.approved,
                mode: parsed.mode || mode,
                error: parsed.error || null,
            };
        } catch (e) {
            // Not a JSON line, continue
        }
    }

    return {
      supported: true,
      approved: false,
      mode,
      error: 'Could not find valid JSON in verifier output.',
    };
  } catch (error) {
    console.error(`[NativeVerifier] ${mode} helper failed:`, error.message);
    return {
      supported: true,
      approved: false,
      mode,
      error: error.stderr || error.message || 'Native verification failed.',
    };
  }
}

async function verifyMacDeviceUnlock({ reason, actionText, riskLevel = 'medium' }) {
  const promptReason = reason || `Approve a protected ${riskLevel} risk action in Aartiq.`;
  const args = [
    '--reason', promptReason,
    '--command', actionText || promptReason,
    '--risk', riskLevel,
    '--app-name', 'Aartiq',
  ];

  const { bundledBinary, localBinary, swiftScript } = getMacHelperPaths();

  // Try bundled binary first
  if (fs.existsSync(bundledBinary)) {
    return runHelper(bundledBinary, args, 'macos-device-owner-auth');
  }

  try {
    await ensureLocalMacHelperBinary(swiftScript, localBinary);
  } catch (error) {
    console.warn('[NativeVerifier] Failed to compile local macOS helper binary:', error.message);
  }

  // Try local binary
  if (fs.existsSync(localBinary) && !localBinary.includes('.asar')) {
    return runHelper(localBinary, args, 'macos-device-owner-auth');
  }

  // Try swift script
  if (fs.existsSync(swiftScript)) {
    let scriptToRun = swiftScript;
    let tempScriptPath = null;
    
    // If inside an ASAR archive, swift compiler can't access it. Copy to temp dir.
    if (swiftScript.includes('.asar')) {
      const os = require('os');
      tempScriptPath = path.join(os.tmpdir(), `macos-device-unlock-${Date.now()}.swift`);
      fs.writeFileSync(tempScriptPath, fs.readFileSync(swiftScript, 'utf8'));
      scriptToRun = tempScriptPath;
    }

    console.log(`[NativeVerifier] Using Swift helper: ${scriptToRun}`);
    try {
        const result = await runHelper('swift', [scriptToRun, ...args], 'macos-device-owner-auth');
        if (tempScriptPath) fs.unlinkSync(tempScriptPath); // clean up
        
        if (result.approved || (!result.error && result.supported)) {
            return result;
        }
        console.warn('[NativeVerifier] Swift helper returned failure, trying fallback...');
    } catch (e) {
        if (tempScriptPath && fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); // clean up
        console.warn('[NativeVerifier] Swift execution failed, trying alternative...');
    }
  }

  // FINAL FALLBACK: Use Electron's native promptTouchID (no password fallback though)
  try {
    const { systemPreferences } = require('electron');
    if (systemPreferences && systemPreferences.canPromptTouchID()) {
      console.log('[NativeVerifier] Using Electron native promptTouchID fallback');
      try {
        await systemPreferences.promptTouchID(promptReason);
        return { supported: true, approved: true, mode: 'macos-native-touchid-only' };
      } catch (e) {
        return { supported: true, approved: false, mode: 'macos-native-touchid-only', error: e.message };
      }
    }
  } catch (e) {
    console.warn('[NativeVerifier] Electron native fallback failed:', e.message);
  }

  return {
    supported: false,
    approved: false,
    mode: 'macos-device-owner-auth',
    error: 'No macOS native verifier helper is available. Ensure Xcode tools or the bundled binary are present.',
  };
}

async function verifyWindowsLegacy({ reason, actionText, riskLevel }) {
    try {
        const psCommand = `
        $creds = Get-Credential -UserName "$env:USERNAME" -Message "${reason || 'Unlock Aartiq to continue.'}";
        if ($creds) {
          Write-Host '{"supported": true, "approved": true, "mode": "windows-credential-prompt"}';
        } else {
          Write-Host '{"supported": true, "approved": false, "mode": "windows-credential-prompt"}';
        }
      `;
        const { stdout } = await execFileAsync('powershell', ['-Command', psCommand]);
        const trimmed = `${stdout || ''}`.trim();
        const lastLine = trimmed.split('\n').pop();
        try {
            return JSON.parse(lastLine);
        } catch (e) {
            return { supported: true, approved: false, mode: 'windows-credential-prompt', error: 'Failed to parse PowerShell output.' };
        }
    } catch (error) {
        return {
            supported: true,
            approved: false,
            mode: 'windows-credential-prompt',
            error: error.message || 'PowerShell credential prompt failed.',
        };
    }
}

async function verifyNativeDeviceAccess({ reason, actionText, riskLevel = 'medium' }) {
  if (process.platform === 'darwin') {
    return verifyMacDeviceUnlock({ reason, actionText, riskLevel });
  }

  if (process.platform === 'win32') {
    try {
      const webauthnService = getWebauthnService();
      if (!webauthnService || !webauthnService.isSupported()) {
        console.log('[NativeVerifier] WebAuthn not available, falling back to PowerShell legacy verification');
        return await verifyWindowsLegacy({ reason, actionText, riskLevel });
      }

      if (!webauthnService.hasCredential()) {
        const reg = await webauthnService.registerCredential({
          userName: 'aartiq-user',
          displayName: 'Aartiq User',
        });
        if (!reg.success) {
          console.warn('[NativeVerifier] WebAuthn registration failed, falling back to PowerShell:', reg.error);
          return await verifyWindowsLegacy({ reason, actionText, riskLevel });
        }
      }

      const result = await webauthnService.authenticate(reason || `Unlock Aartiq to continue.`);
      return {
        supported: true,
        approved: result.success,
        mode: 'windows-hello-webauthn',
        credentialId: result.credentialId || null,
        error: result.success ? null : (result.error || 'WebAuthn authentication failed'),
      };
    } catch (error) {
      console.warn('[NativeVerifier] WebAuthn verification failed, falling back to PowerShell:', error.message);
      return await verifyWindowsLegacy({ reason, actionText, riskLevel });
    }
  }

  return {
    supported: false,
    approved: false,
    mode: 'unsupported-platform',
    error: 'Native device unlock verification is unavailable on this platform.',
  };
}

async function verifyNativeCommandApproval({ command, riskLevel = 'medium' }) {
  return verifyNativeDeviceAccess({
    reason: `Approve running a ${riskLevel} risk shell command in Aartiq.`,
    actionText: command,
    riskLevel,
  });
}

module.exports = {
  hasNativeDeviceUnlockSupport,
  verifyNativeDeviceAccess,
  verifyNativeCommandApproval,
};
