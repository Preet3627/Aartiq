const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const { app, desktopCapturer, systemPreferences } = require('electron');

const execFilePromise = util.promisify(execFile);

function getBundlePath() {
  if (process.platform !== 'darwin') return null;

  const parts = process.execPath.split(path.sep);
  const appIndex = parts.findIndex((part) => part.endsWith('.app'));
  if (appIndex === -1) return null;
  return parts.slice(0, appIndex + 1).join(path.sep) || path.sep;
}

async function getBundleIdentifier() {
  const bundlePath = getBundlePath();
  if (!bundlePath) return null;

  try {
    const infoPath = path.join(bundlePath, 'Contents', 'Info');
    const { stdout } = await execFilePromise('/usr/bin/defaults', ['read', infoPath, 'CFBundleIdentifier']);
    return String(stdout || '').trim() || null;
  } catch (error) {
    return null;
  }
}

async function probeScreenCapture() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 80, height: 45 },
    });
    const first = sources[0];
    const size = first?.thumbnail?.getSize?.() || { width: 0, height: 0 };
    return {
      ok: sources.length > 0 && size.width > 0 && size.height > 0,
      sourceCount: sources.length,
      thumbnailSize: size,
    };
  } catch (error) {
    return {
      ok: false,
      sourceCount: 0,
      error: error.message,
    };
  }
}

async function getMacOSPermissionHealth({ promptAccessibility = false } = {}) {
  if (process.platform !== 'darwin') {
    return { success: true, platform: process.platform, supported: false };
  }

  const screenStatus = systemPreferences.getMediaAccessStatus('screen');
  const accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(Boolean(promptAccessibility));
  const screenProbe = await probeScreenCapture();
  const bundlePath = getBundlePath();
  const bundleIdentifier = await getBundleIdentifier();
  const issues = [];

  if (screenStatus !== 'granted') {
    issues.push({
      code: 'screen-not-granted',
      permission: 'screen',
      message: 'Screen Recording is not granted to the current app identity.',
    });
  } else if (!screenProbe.ok) {
    issues.push({
      code: 'screen-stale-or-relaunch-needed',
      permission: 'screen',
      message: 'macOS reports Screen Recording as granted, but capture still fails. Relaunch Comet-AI; if it persists, reset the stale Screen Recording grant.',
    });
  }

  if (!accessibilityTrusted) {
    issues.push({
      code: 'accessibility-not-trusted',
      permission: 'accessibility',
      message: 'Accessibility is not trusted for the current Comet-AI process.',
    });
  }

  if (!bundleIdentifier) {
    issues.push({
      code: 'bundle-id-unavailable',
      permission: 'identity',
      message: 'Comet-AI is running without a packaged .app bundle identity, so macOS may grant permissions to Electron, Terminal, or the launcher instead.',
    });
  }

  return {
    success: true,
    supported: true,
    appName: app.getName(),
    isPackaged: app.isPackaged,
    executablePath: process.execPath,
    bundlePath,
    bundleIdentifier,
    screen: {
      status: screenStatus,
      captureAvailable: screenProbe.ok,
      sourceCount: screenProbe.sourceCount,
      error: screenProbe.error,
    },
    accessibility: {
      trusted: accessibilityTrusted,
    },
    needsRelaunch: issues.some((issue) => issue.code === 'screen-stale-or-relaunch-needed'),
    issues,
  };
}

async function resetMacOSPermissions(types = ['screen', 'accessibility']) {
  if (process.platform !== 'darwin') {
    return { success: false, error: 'macOS permission reset is only available on macOS.' };
  }

  const bundleIdentifier = await getBundleIdentifier();
  if (!bundleIdentifier) {
    return {
      success: false,
      error: 'No packaged app bundle identifier found. Launch the built Comet-AI.app, not Electron through a terminal, then retry.',
    };
  }

  const serviceByType = {
    screen: 'ScreenCapture',
    accessibility: 'Accessibility',
    automation: 'AppleEvents',
  };

  const requested = Array.isArray(types) && types.length ? types : ['screen', 'accessibility'];
  const reset = [];

  for (const type of requested) {
    const service = serviceByType[type];
    if (!service) continue;
    await execFilePromise('/usr/bin/tccutil', ['reset', service, bundleIdentifier]);
    reset.push(type);
  }

  return {
    success: true,
    bundleIdentifier,
    reset,
    message: 'Permissions were reset for this app identity. Quit and reopen Comet-AI, then grant the prompts again.',
  };
}

module.exports = {
  getMacOSPermissionHealth,
  resetMacOSPermissions,
};
