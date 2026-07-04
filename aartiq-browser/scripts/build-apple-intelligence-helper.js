const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'darwin') {
  console.log('[build-apple-intelligence-helper] Skipping: not running on macOS.');
  process.exit(0);
}

const rootDir = path.resolve(__dirname, '..');
const swiftSource = path.join(rootDir, 'src', 'lib', 'apple-intelligence.swift');
const outputDir = path.join(rootDir, 'bin');
const outputBinary = path.join(outputDir, 'Aartiq-AppleIntelligence');

if (!fs.existsSync(swiftSource)) {
  console.log('[build-apple-intelligence-helper] Skipping: Swift source not found.');
  process.exit(0);
}

fs.mkdirSync(outputDir, { recursive: true });
execFileSync('swiftc', ['-parse-as-library', swiftSource, '-o', outputBinary], { stdio: 'inherit' });
fs.chmodSync(outputBinary, 0o755);
console.log(`[build-apple-intelligence-helper] Built ${outputBinary}`);
