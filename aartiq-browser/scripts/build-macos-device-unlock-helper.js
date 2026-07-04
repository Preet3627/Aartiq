const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.log('[build-macos-device-unlock-helper] Skipping: not running on macOS.');
  process.exit(0);
}

const rootDir = path.resolve(__dirname, '..');
const swiftSource = path.join(rootDir, 'src', 'lib', 'macos-device-unlock.swift');
const outputDir = path.join(rootDir, 'bin');
const outputBinary = path.join(outputDir, 'Aartiq');

if (!fs.existsSync(swiftSource)) {
  console.log('[build-macos-device-unlock-helper] Skipping: Swift source not found.');
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
execFileSync('swiftc', [swiftSource, '-o', outputBinary], { stdio: 'inherit' });
fs.chmodSync(outputBinary, 0o755);
console.log(`[build-macos-device-unlock-helper] Built ${outputBinary}`);
