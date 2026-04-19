#!/usr/bin/env node
/**
 * Pre-build verification script
 * Ensures all required files exist before electron-builder runs
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Comet Browser - Pre-Build Verification\n');

const checks = [
    { name: 'main.cjs', path: './main.cjs', type: 'file' },
    { name: 'preload.cjs', path: './preload.cjs', type: 'file' },
    { name: 'view_preload.cjs', path: './view_preload.cjs', type: 'file' },
    { name: 'package.json', path: './package.json', type: 'file' },
    { name: 'icon.ico', path: './assets/icon.ico', type: 'file' },
    { name: 'out directory', path: './out', type: 'directory' },
    { name: 'out/index.html', path: './out/index.html', type: 'file' },
    { name: 'node_modules', path: './node_modules', type: 'directory' },
];

let allPassed = true;

checks.forEach(check => {
    const fullPath = path.resolve(__dirname, check.path);
    const exists = fs.existsSync(fullPath);

    if (exists) {
        if (check.type === 'directory') {
            const files = fs.readdirSync(fullPath);
            console.log(`✅ ${check.name} (${files.length} items)`);
        } else {
            const stats = fs.statSync(fullPath);
            console.log(`✅ ${check.name} (${(stats.size / 1024).toFixed(2)} KB)`);
        }
    } else {
        console.log(`❌ ${check.name} - MISSING!`);
        allPassed = false;
    }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
    console.log('✅ All checks passed! Ready to build.');
    process.exit(0);
} else {
    console.log('❌ Some checks failed!');
    console.log('\n📝 Fix instructions:');
    console.log('   1. Run: npm install');
    console.log('   2. Run: npm run build');
    console.log('   3. Then run: npm run build-electron');
    process.exit(1);
}
