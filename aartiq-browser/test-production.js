#!/usr/bin/env node
/**
 * Test Production Build Locally
 * Simulates how the .exe will run after installation
 * This helps catch issues before building the installer
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Production Build Locally\n');
console.log('This simulates how the built .exe will behave after installation.\n');

// Check if out directory exists
const outPath = path.join(__dirname, 'out');
const indexPath = path.join(outPath, 'index.html');

if (!fs.existsSync(outPath)) {
    console.error('❌ ERROR: out directory does not exist!');
    console.error('📝 Run: npm run build');
    process.exit(1);
}

if (!fs.existsSync(indexPath)) {
    console.error('❌ ERROR: out/index.html does not exist!');
    console.error('📝 Run: npm run build');
    process.exit(1);
}

console.log('✅ Build files verified\n');
console.log('🚀 Starting Electron in production mode...\n');
console.log('Expected behavior:');
console.log('  1. Window should appear within 3 seconds');
console.log('  2. If window doesn\'t show, check the console logs');
console.log('  3. Press Ctrl+C to stop\n');
console.log('='.repeat(50) + '\n');

// Set NODE_ENV to production to simulate built app
const env = { ...process.env, NODE_ENV: 'production' };

const electron = spawn('npx', ['electron', '.'], {
    cwd: __dirname,
    env,
    stdio: 'inherit',
    shell: true
});

electron.on('error', (err) => {
    console.error('\n❌ Failed to start Electron:', err.message);
    process.exit(1);
});

electron.on('close', (code) => {
    if (code !== 0) {
        console.log(`\n⚠️  Electron exited with code ${code}`);
    } else {
        console.log('\n✅ Electron exited normally');
    }
    process.exit(code || 0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping test...');
    electron.kill();
    process.exit(0);
});
