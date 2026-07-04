# Crash Fix: "Attempted to register a second handler for 'capture-screen-region'"

## Problem
The error occurs when the app tries to register the same IPC handler twice:
```
Uncaught Exception:
Error: Attempted to register a second handler for 'capture-screen-region'
at ipcMain|impl.handle (node:electron/js2c/browser_init:112956)
```

## Root Cause
This happens when:
1. The main process file (`main.js`) is loaded/executed multiple times
2. Hot reload during development re-registers handlers
3. Multiple instances of the app are running

## Solutions

### Solution 1: Remove Handler Before Re-registering (Development)
Add this before each `ipcMain.handle()` call during development:

```javascript
// Remove existing handler if it exists
ipcMain.removeHandler('capture-screen-region');

// Then register the new handler
ipcMain.handle('capture-screen-region', async (event, bounds) => {
  // ... handler code
});
```

### Solution 2: Check for Existing Handler
```javascript
const handlerName = 'capture-screen-region';

// Only register if not already registered
if (!ipcMain._events[handlerName]) {
  ipcMain.handle(handlerName, async (event, bounds) => {
    // ... handler code
  });
}
```

### Solution 3: Single Instance Lock (Recommended)
The app already has single instance lock in `main.js`:

```javascript
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // ... register handlers here
}
```

This prevents multiple instances from running simultaneously.

### Solution 4: Restart the App
If you see this error:
1. **Close ALL instances** of Aartiq Browser
2. Check Task Manager (Windows) or Activity Monitor (macOS) for any lingering processes
3. Kill any `Aartiq Browser.exe` or `electron` processes
4. Restart the app

## Prevention

### For Development:
1. **Use `npm run dev`** instead of manually running electron
2. **Don't run multiple dev instances** simultaneously
3. **Clear the app cache** if issues persist:
   ```bash
   # Windows
   rd /s /q "%APPDATA%\aartiq-browser"
   
   # macOS
   rm -rf ~/Library/Application\ Support/aartiq-browser
   
   # Linux
   rm -rf ~/.config/aartiq-browser
   ```

### For Production:
1. The single instance lock prevents this automatically
2. If users report this, advise them to:
   - Close all instances
   - Restart the app
   - Reinstall if problem persists

## Verification

Run the duplicate handler checker:
```bash
node check_dups.js
```

This will scan `main.js` and report any duplicate `ipcMain.handle()` registrations.

## Current Status

✅ **Fixed** - No duplicate handlers found in current codebase
✅ **Single instance lock** is active
✅ **Duplicate checker** script available

If you still see this error, it's likely from:
- A previous instance still running in background
- Development hot reload issue
- Corrupted app cache

**Solution**: Fully close and restart the app.
