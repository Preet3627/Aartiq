const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const HELPER_BINARY_NAME = 'Aartiq-AppleIntelligence';

function getAppleIntelligencePaths() {
  return {
    bundledBinary: path.join(process.resourcesPath || '', 'bin', HELPER_BINARY_NAME),
    localBinary: path.join(__dirname, '..', '..', 'bin', HELPER_BINARY_NAME),
    swiftSource: path.join(__dirname, 'apple-intelligence.swift'),
  };
}

async function ensureAppleIntelligenceBinary(swiftSource, localBinary) {
  if (!fs.existsSync(swiftSource)) {
    throw new Error('Apple Intelligence Swift source was not found.');
  }

  const sourceStat = fs.statSync(swiftSource);
  const binaryExists = fs.existsSync(localBinary);
  const binaryIsFresh = binaryExists && fs.statSync(localBinary).mtimeMs >= sourceStat.mtimeMs;

  if (binaryIsFresh) {
    return true;
  }

  fs.mkdirSync(path.dirname(localBinary), { recursive: true });
  await execFileAsync('swiftc', ['-parse-as-library', swiftSource, '-o', localBinary], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 10,
  });
  fs.chmodSync(localBinary, 0o755);
  return true;
}

async function resolveAppleIntelligenceBinary() {
  const { bundledBinary, localBinary, swiftSource } = getAppleIntelligencePaths();

  if (fs.existsSync(bundledBinary)) {
    return bundledBinary;
  }

  await ensureAppleIntelligenceBinary(swiftSource, localBinary);
  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  throw new Error('Apple Intelligence helper binary is unavailable.');
}

async function runAppleIntelligenceCommand(command, payload = {}) {
  if (process.platform !== 'darwin') {
    return {
      success: false,
      error: 'Apple Intelligence is only available on macOS.',
    };
  }

  const binary = await resolveAppleIntelligenceBinary();

  return new Promise((resolve) => {
    const child = spawn(binary, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        resolve({ success: false, error: stderr.trim() || `Apple Intelligence helper exited with code ${code}` });
        return;
      }

      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch (error) {
        resolve({ success: false, error: stderr.trim() || error.message || 'Failed to parse Apple Intelligence helper response.' });
      }
    });

    child.stdin.write(JSON.stringify({ command, ...payload }));
    child.stdin.end();
  });
}

async function getAppleIntelligenceStatus() {
  return runAppleIntelligenceCommand('status');
}

async function summarizeWithAppleIntelligence(text) {
  return runAppleIntelligenceCommand('summary', { text });
}

async function generateAppleIntelligenceImage(prompt, outputPath, style = 'illustration') {
  return runAppleIntelligenceCommand('image', { prompt, outputPath, style });
}

async function generateGenmoji(prompt) {
  return runAppleIntelligenceCommand('genmoji', { prompt });
}

module.exports = {
  generateAppleIntelligenceImage,
  generateGenmoji,
  getAppleIntelligencePaths,
  getAppleIntelligenceStatus,
  summarizeWithAppleIntelligence,
};
