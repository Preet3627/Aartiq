const fs = require('fs');
const path = require('path');
const { ensureLocalMacNativePanelBinary, getMacNativePanelPaths } = require('../src/lib/macos-native-panels.js');

if (process.platform !== 'darwin') {
  console.log('[build-macos-native-panels] Skipping: not running on macOS.');
  process.exit(0);
}

const rootDir = path.resolve(__dirname, '..');
const swiftSourceDir = path.join(rootDir, 'src', 'lib', 'native-panels');
const legacySwiftSource = path.join(rootDir, 'src', 'lib', 'macos-native-panels.swift');

const swiftSource = fs.existsSync(swiftSourceDir) ? swiftSourceDir : (fs.existsSync(legacySwiftSource) ? legacySwiftSource : null);

if (!swiftSource) {
  console.log('[build-macos-native-panels] Skipping: Swift source not found.');
  process.exit(0);
}

const modes = ['sidebar', 'settings', 'action-chain', 'menu', 'downloads', 'clipboard', 'permissions', 'apple-ai', 'all'];

(async () => {
  for (const mode of modes) {
    const paths = getMacNativePanelPaths(mode);
    console.log(`[build-macos-native-panels] Building ${mode}...`);
    try {
      await ensureLocalMacNativePanelBinary(swiftSource, paths.localBinary, mode);
      console.log(`[build-macos-native-panels] Built ${paths.localBinary}`);
    } catch (e) {
      console.error(`[build-macos-native-panels] Failed to build ${mode}:`, e);
      process.exit(1);
    }
  }
})();
