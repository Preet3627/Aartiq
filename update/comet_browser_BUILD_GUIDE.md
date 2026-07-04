# Quick Start - Building Aartiq Browser .exe

## Prerequisites
- Node.js 20+ installed
- Windows 10/11
- Git (optional, for cloning)

## Build Steps

### 1. Install Dependencies
```bash
cd aartiq-browser
npm install
```

### 2. Build the App
```bash
# Build Next.js static export
npm run build
```
Expected output: `out/` directory with `index.html`

### 3. Verify Build
```bash
# Ensure all required files exist
node verify-build.js
```
Expected output: `✅ All checks passed! Ready to build.`

### 4. Test Production Mode (Optional but Recommended)
```bash
# Test how the .exe will behave
npm run test:prod
```
Expected: Window should appear within 1 second

### 5. Create Windows Installer
```bash
# Build the .exe
npm run dist:win
```

**Build time**: ~2-5 minutes depending on your machine

**Output location**: `release/Aartiq Browser Setup 0.1.7.exe`

## Installation & Testing

### Install the App
1. Navigate to `release/` folder
2. Double-click `Aartiq Browser Setup 0.1.7.exe`
3. Follow installation wizard
4. Default location: `C:\Users\<You>\AppData\Local\Programs\Aartiq Browser\`

### Launch the App
- **Desktop shortcut**: Double-click "Aartiq Browser"
- **Start Menu**: Search for "Aartiq Browser"
- **Direct**: Navigate to install folder and run `Aartiq Browser.exe`

### Expected Behavior
✅ Window appears within 1 second
✅ Browser UI loads
✅ No console/terminal window
✅ Clean close when exiting

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
rm -rf out/ node_modules/
npm install
npm run build
npm run dist:win
```

### Window Doesn't Show
This should **NOT** happen with current fixes, but if it does:
1. Check Task Manager - kill any running instances
2. Run from command line to see logs:
   ```powershell
   cd "$env:LOCALAPPDATA\Programs\Aartiq Browser"
   ."Aartiq Browser.exe"
   ```
3. Look for error messages in output

### SmartScreen Warning
First-time installations may show Windows SmartScreen:
1. Click "More info"
2. Click "Run anyway"

(This is normal for unsigned apps. Future: Add code signing)

## GitHub Actions (Automatic Builds)

Builds automatically trigger on:
- Push to `main` or `develop` branch
- Version tags (e.g., `v0.1.7`)
- Manual workflow dispatch

Download artifacts from:
`Actions` → Select workflow run → `Artifacts` → `aartiq-browser-windows-installer`

## Scripts Reference

| Command | What It Does |
|---------|--------------|
| `npm run build` | Build Next.js app → `out/` |
| `npm run test:prod` | Test production mode locally |
| `node verify-build.js` | Verify all files exist |
| `npm run dist:win` | Build Windows .exe installer |
| `npm run dev` | Development mode (hot reload) |

## File Locations

### Source Files
- `main.js` - Electron main process
- `preload.js` - Preload script
- `src/` - React/Next.js app
- `out/` - Built static files (generated)

### Build Output
- `release/*.exe` - Windows installer
- `release/win-unpacked/` - Unpacked app (for debugging)

## Clean Build (If Issues)

```bash
# Delete generated files
rm -rf out/ release/ .next/ node_modules/

# Fresh install
npm install

# Fresh build
npm run build
npm run dist:win
```

## Support

See `TROUBLESHOOTING.md` for detailed debugging steps.
See `FIXES_COMPLETE.md` for technical details on fixes applied.

---

**Build Version**: 0.1.7+
**Platform**: Windows x64
**Build Tool**: electron-builder
