const fs = require('fs');
const path = require('path');

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const appxDir = path.join(assetsDir, 'appx');
  const sourceIcon = path.join(assetsDir, 'icon.png');

  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found at:', sourceIcon);
    console.error('Place a high-res PNG at assets/icon.png first.');
    process.exit(1);
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp is required. Install with: npm install sharp');
    process.exit(1);
  }

  fs.mkdirSync(appxDir, { recursive: true });

  const icon = sharp(sourceIcon);
  const metadata = await icon.metadata();
  console.log('Source icon: ' + metadata.width + 'x' + metadata.height);

  const assets = [
    { name: 'Square44x44Logo.png', width: 44, height: 44 },
    { name: 'Square150x150Logo.png', width: 150, height: 150 },
    { name: 'StoreLogo.png', width: 50, height: 50 },
    { name: 'Wide310x150Logo.png', width: 310, height: 150 },
  ];

  for (const asset of assets) {
    const outputPath = path.join(appxDir, asset.name);
    await sharp(sourceIcon)
      .resize(asset.width, asset.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
    console.log('Created ' + asset.name + ' (' + asset.width + 'x' + asset.height + ')');
  }

  console.log('\nAll AppX assets generated in assets/appx/');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
