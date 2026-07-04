# Aartiq Browser - Installation & Launch Troubleshooting Guide

## Problem: Browser runs in background but window doesn't show

### Root Causes Identified & Fixed:

1. **Window Visibility Issue** ✅ FIXED
   - **Problem**: Window was set to `show: false` and relied on `ready-to-show` event
   - **Issue**: If Next.js build fails to load, event never fires and window stays hidden
   - **Fix**: Added multiple safeguards:
     - 3-second timeout fallback to force window show
     - Error handlers for load failures
     - Window shows even if content fails to load
     - Comprehensive logging to diagnose issues

2. **Missing Build Files** ✅ PREVENTED
   - **Problem**: `.exe` created without `out/` directory
   - **Fix**: Added `verify-build.js` script that checks all files before build
   - **Usage**: Runs automatically before `npm run build-electron`

3. **Background Process Cleanup** ✅ FIXED
   - **Problem**: App stays running after window closes
   - **Fix**: 
     - Added explicit `app.quit()` on window close (Windows)
     - Cleanup for MCP Server, P2P Service, timers
     - Force process exit with `process.exit(0)`

## Pre-Installation Testing (RECOMMENDED)

Before building the `.exe`, test the production mode locally:

```bash
# 1. Build the Next.js app
npm run build

# 2. Verify all files exist
node verify-build.js

# 3. Test production mode (exactly how .exe will behave)
npm run test:prod
```

**Expected Result**: Window should appear within 3 seconds with the browser UI.

## Building the Installer

```bash
# Build Windows installer (recommended)
npm run dist:win
```

This will:
1. Run `npm run build` (creates `out/` directory)
2. Run verification checks
3. Create `.exe` in `release/` directory

## After Installation

### Where the .exe is installed:
- **Default Location**: `C:\Users\<YourName>\AppData\Local\Programs\Aartiq Browser\`
- **Desktop Shortcut**: Created automatically

### First Launch Checklist:

1. **Launch the app** from Desktop shortcut or Start Menu
2. **Window should appear within 3 seconds**
3. **If window doesn't show**:
   - Open Task Manager (Ctrl+Shift+Esc)
   - Check if "Aartiq Browser" is running
   - If yes, kill it and try again
   - Check logs (see below)

### Checking Logs (if window doesn't appear):

**Windows:**
```powershell
# Navigate to app directory
cd "$env:LOCALAPPDATA\Programs\Aartiq Browser"

# Run from command line to see logs
."Aartiq Browser.exe"
```

Look for these log messages:
- `[Main] Loading URL: file://...`
- `[Main] Build files verified` ✅ Good
- `[Main] ERROR: Out directory does not exist` ❌ Bad - Reinstall
- `[Main] Window ready-to-show event fired` ✅ Good
- `[Main] Forcing window to show (ready-to-show timeout)` ⚠️ Fallback triggered
- `[Main] Page failed to load: ...` ❌ Bad - Reinstall

## Common Issues & Solutions

### Issue 1: Window doesn't show at all
**Symptoms**: Process runs in background
**Solution**:
```bash
# Rebuild with verification
npm run build
node verify-build.js
npm run test:prod  # Test before rebuilding .exe
npm run dist:win   # Rebuild installer
```

### Issue 2: "Out directory does not exist" error
**Symptoms**: Logs show missing `out/` directory
**Solution**:
```bash
# Build was incomplete
npm run build
# Verify
ls out/  # Should show index.html and other files
# Rebuild installer
npm run dist:win
```

### Issue 3: Blank/white window shows
**Symptoms**: Window appears but content doesn't load
**Solution**: 
- Check `out/index.html` exists
- Verify `next.config.ts` has `output: 'export'`
- Rebuild: `npm run build && npm run dist:win`

### Issue 4: Process stays running after close
**Status**: ✅ Fixed
**Details**: Added cleanup handlers - should no longer occur

## Development Workflow

### For Testing (Development Mode):
```bash
npm run dev
```
- Uses Next.js dev server (http://localhost:3000)
- Hot reload enabled
- Developer tools available

### For Production Testing (Without Building .exe):
```bash
npm run build      # Build Next.js static export
npm run test:prod  # Test in production mode
```

### For Creating Installer:
```bash
npm run dist:win   # Creates .exe in release/ folder
```

## File Structure (After Build)

```
aartiq-browser/
├── out/                    # Next.js static export (REQUIRED)
│   ├── index.html         # Main entry point
│   ├── _next/             # Next.js assets
│   └── ...
├── main.js                # Electron main process
├── preload.js             # Preload script
├── view_preload.js        # BrowserView preload
├── icon.ico               # App icon
├── package.json           # Dependencies & metadata
├── verify-build.js        # Pre-build verification
├── test-production.js     # Production mode tester
└── release/               # Built installers (created by electron-builder)
    └── Aartiq Browser Setup 0.1.7.exe
```

## Diagnostic Commands

```bash
# Check if build files exist
node verify-build.js

# Test production mode locally
npm run test:prod

# Check what will be included in .exe
npx electron-builder --dir --win

# Build without packaging (for debugging)
npx electron-builder --dir --win
```

## Support Checklist

If issues persist, provide:
1. ✅ Output of `node verify-build.js`
2. ✅ Output of `npm run test:prod` (first 50 lines)
3. ✅ Logs from running `.exe` directly from command line
4. ✅ Windows version (Win 10/11)
5. ✅ Installation directory

## Key Improvements Made

| Issue | Status | Details |
|-------|--------|---------|
| Window not showing | ✅ Fixed | Added 3s timeout + error handlers |
| Background process | ✅ Fixed | Explicit cleanup + force quit |
| Missing build files | ✅ Prevented | Pre-build verification |
| Silent failures | ✅ Fixed | Comprehensive logging |
| Load errors hidden | ✅ Fixed | Window shows even on error |

---

**Last Updated**: 2026-02-03
**Version**: 0.1.7
