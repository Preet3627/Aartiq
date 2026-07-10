#!/usr/bin/env node
/**
 * Generate AppX/MSIX icon assets for Windows Store builds.
 * 
 * electron-builder looks for these files in the buildResources directory
 * (configured as "assets/" in package.json) and automatically includes them
 * in the AppX manifest.
 * 
 * Required sizes:
 *   44x44  → Square44x44Logo (app icon in Start menu, taskbar)
 *   50x50  → Square50x50Logo (small tile)
 *   150x150 → Square150x150Logo (medium tile)
 *   310x310 → Square310x310Logo (large tile)
 *   310x150 → Wide310x150Logo (wide tile)
 *   300x300 → StoreLogo (Windows Store listing)
 * 
 * Usage: node scripts/generate-appx-assets.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const sourceIcon = path.join(assetsDir, 'icon.png');

  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Source icon not found at:', sourceIcon);
    console.error('   Place a 1000x1000+ PNG at assets/icon.png first.');
    process.exit(1);
  }

  // Try to use sharp (preferred) or fall back to a warning
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌ sharp is required. Install it with: npm install sharp');
    process.exit(1);
  }

  const icon = sharp(sourceIcon);
  const metadata = await icon.metadata();
  console.log(`📦 Source icon: ${metadata.width}x${metadata.height}`);

  const assets = [
    { name: '44.png', width: 44, height: 44 },
    { name: '50.png', width: 50, height: 50 },
    { name: '150.png', width: 150, height: 150 },
    { name: '310.png', width: 310, height: 310 },
    { name: 'StoreLogo.png', width: 300, height: 300 },
    { name: 'Wide310x150.png', width: 310, height: 150 },
  ];

  for (const asset of assets) {
    const outputPath = path.join(assetsDir, asset.name);
    await sharp(sourceIcon)
      .resize(asset.width, asset.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    console.log(`✅ Created ${asset.name} (${asset.width}x${asset.height})`);
  }

  console.log('\n🎉 All AppX assets generated successfully!');
  console.log('   Run: npm run electron:build:win');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});