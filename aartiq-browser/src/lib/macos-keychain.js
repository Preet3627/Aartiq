const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const HELPER_NAME = 'AartiqKeychain';

function getHelperPaths() {
  return {
    bundledBinary: path.join(process.resourcesPath || '', 'bin', HELPER_NAME),
    localBinary: path.join(__dirname, '..', '..', 'bin', HELPER_NAME),
    swiftScript: path.join(__dirname, 'macos-keychain.swift'),
  };
}

async function ensureLocalBinary(swiftScript, localBinary) {
  if (!fs.existsSync(swiftScript)) return false;
  if (swiftScript.includes('.asar') || localBinary.includes('.asar')) return false;

  const scriptStat = fs.statSync(swiftScript);
  const binaryExists = fs.existsSync(localBinary);
  const binaryIsFresh = binaryExists && fs.statSync(localBinary).mtimeMs >= scriptStat.mtimeMs;

  if (binaryIsFresh) return true;

  fs.mkdirSync(path.dirname(localBinary), { recursive: true });
  await execFileAsync('swiftc', [swiftScript, '-o', localBinary], {
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  fs.chmodSync(localBinary, 0o755);
  return true;
}

async function runHelper(args) {
  try {
    const { bundledBinary, localBinary, swiftScript } = getHelperPaths();

    let command;
    let commandArgs;

    if (fs.existsSync(bundledBinary)) {
      command = bundledBinary;
      commandArgs = args;
    } else {
      try {
        await ensureLocalBinary(swiftScript, localBinary);
      } catch (e) {
        // ignore compilation error
      }

      if (fs.existsSync(localBinary) && !localBinary.includes('.asar')) {
        command = localBinary;
        commandArgs = args;
      } else if (fs.existsSync(swiftScript)) {
        let scriptToRun = swiftScript;
        let tempScriptPath = null;

        if (swiftScript.includes('.asar')) {
          const os = require('os');
          tempScriptPath = path.join(os.tmpdir(), `macos-keychain-${Date.now()}.swift`);
          fs.writeFileSync(tempScriptPath, fs.readFileSync(swiftScript, 'utf8'));
          scriptToRun = tempScriptPath;
        }

        command = 'swift';
        commandArgs = [scriptToRun, ...args];

        const result = await runProcess(command, commandArgs);
        if (tempScriptPath) {
          try { fs.unlinkSync(tempScriptPath); } catch (e) {}
        }
        return result;
      } else {
        return { success: false, error: 'No macOS keychain helper available' };
      }
    }

    return runProcess(command, commandArgs);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runProcess(command, args) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });

  const trimmed = `${stdout || ''}`.trim();
  if (!trimmed) return { success: false, error: 'Helper returned no output' };

  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch (e) {
      // not JSON, continue
    }
  }

  return { success: false, error: 'Could not parse helper output', raw: trimmed };
}

async function addPassword({ account, service, password, label }) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'macOS only' };
  }
  return runHelper([
    '--action', 'add',
    '--account', account,
    '--service', service,
    '--password', password,
    '--label', label || 'Aartiq',
  ]);
}

async function deletePassword({ account, service }) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'macOS only' };
  }
  return runHelper([
    '--action', 'delete',
    '--account', account,
    '--service', service,
  ]);
}

async function getPassword({ account, service }) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'macOS only' };
  }
  return runHelper([
    '--action', 'get',
    '--account', account,
    '--service', service,
  ]);
}

async function listEntries({ servicePrefix } = {}) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'macOS only' };
  }
  const args = ['--action', 'list'];
  if (servicePrefix) {
    args.push('--service-prefix', servicePrefix);
  }
  return runHelper(args);
}

module.exports = {
  addPassword,
  deletePassword,
  getPassword,
  listEntries,
  getHelperPaths,
  ensureLocalBinary,
};
