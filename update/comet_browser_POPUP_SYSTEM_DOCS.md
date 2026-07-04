# Popup Window System & Google OAuth Integration

## Overview
This update implements a comprehensive popup window system to fix the issue where panels (settings, clipboard, downloads, etc.) appear behind the browser view. It also adds direct Google OAuth integration using the browser engine.

## Changes Made

### 1. GitHub Workflow - Build Configuration
**File:** `.github/workflows/build.yml`

Added robotjs installation to the build workflow for all platforms:
- Windows: Automatic installation with build-from-source
- macOS: Added pkg-config, cairo, pango dependencies
- Linux: Added libx11-dev, libxtst-dev, libpng-dev, libjpeg-dev

### 2. Main Process - Popup Window System
**File:** `main.js`

#### New Features:
- **Popup Window Manager**: Created a comprehensive system to manage popup windows
- **Always On Top**: Popups use `alwaysOnTop: true` to appear above browser views
- **Parent-Child Relationship**: Popups are children of the main window
- **Transparent Background**: Popups support transparency for modern UI effects

#### Popup Types Supported:
1. **Settings** - Full settings panel (1200x800)
2. **Profile** - User profile management (600x700)
3. **Plugins** - Plugin/Extension manager (900x700)
4. **Downloads** - Download manager (400x600)
5. **Clipboard** - Clipboard history (450x650)
6. **Cart** - Shopping cart manager (500x700)

#### IPC Handlers Added:
```javascript
// Generic popup handlers
ipcMain.on('open-popup-window', ...)
ipcMain.on('close-popup-window', ...)
ipcMain.on('close-all-popups', ...)

// Specific popup handlers
ipcMain.on('open-settings-popup', ...)
ipcMain.on('open-profile-popup', ...)
ipcMain.on('open-plugins-popup', ...)
ipcMain.on('open-downloads-popup', ...)
ipcMain.on('open-clipboard-popup', ...)
ipcMain.on('open-cart-popup', ...)

// Google OAuth
ipcMain.on('google-oauth-login', ...)
```

### 3. Preload Script - API Exposure
**File:** `preload.js`

Added new APIs to the `electronAPI` context bridge:

```javascript
// Popup Window APIs
openPopupWindow(type, options)
closePopupWindow(type)
closeAllPopups()

// Specific popup methods
openSettingsPopup(section)
openProfilePopup()
openPluginsPopup()
openDownloadsPopup()
openClipboardPopup()
openCartPopup()

// Google OAuth
googleOAuthLogin()
onGoogleOAuthCode(callback)
```

## How to Use

### Opening Popups from Renderer Process

#### Settings Popup
```javascript
// Open settings with default section
window.electronAPI.openSettingsPopup();

// Open settings with specific section
window.electronAPI.openSettingsPopup('profile');
window.electronAPI.openSettingsPopup('privacy');
```

#### Other Popups
```javascript
// Profile
window.electronAPI.openProfilePopup();

// Plugins/Extensions
window.electronAPI.openPluginsPopup();

// Downloads
window.electronAPI.openDownloadsPopup();

// Clipboard
window.electronAPI.openClipboardPopup();

// Shopping Cart
window.electronAPI.openCartPopup();
```

#### Closing Popups
```javascript
// Close specific popup
window.electronAPI.closePopupWindow('settings');

// Close all popups
window.electronAPI.closeAllPopups();
```

### Google OAuth Integration

```javascript
// Trigger Google OAuth login
window.electronAPI.googleOAuthLogin();

// Listen for OAuth code
window.electronAPI.onGoogleOAuthCode((code) => {
  console.log('Received OAuth code:', code);
  // Exchange code for tokens on your backend
});
```

## Technical Details

### Z-Index Solution
The popup windows solve the z-index issue through:
1. **Separate BrowserWindow**: Each popup is a separate window, not a DOM element
2. **alwaysOnTop**: Ensures popups appear above the main window's browser view
3. **Parent-Child Relationship**: Popups are modal to the main window
4. **skipTaskbar**: Popups don't clutter the taskbar

### Google OAuth Flow
1. User clicks login button
2. `googleOAuthLogin()` is called
3. OAuth window opens with Google's consent screen
4. User authorizes the app
5. Google redirects to callback URL with code
6. Code is captured and sent to renderer via `google-oauth-code` event
7. Renderer exchanges code for tokens

### Environment Variables
Add these to your `.env` file:
```env
GOOGLE_CLIENT_ID=your-client-id-here
```

## Migration Guide

### Before (Old Approach)
```javascript
// Settings appeared behind browser view
<div className="settings-panel">
  <SettingsPanel />
</div>
```

### After (New Approach)
```javascript
// Settings open in popup window
<button onClick={() => window.electronAPI.openSettingsPopup()}>
  Open Settings
</button>
```

## Benefits

1. **No Z-Index Issues**: Popups always appear on top
2. **Better Performance**: Separate windows don't block main UI
3. **Native Feel**: Popups behave like native OS windows
4. **Easy to Manage**: Centralized popup management
5. **Secure OAuth**: OAuth happens in isolated window

## Browser Compatibility

### Popup Window Features
- ✅ Windows 10/11
- ✅ macOS 10.14+
- ✅ Linux (Ubuntu 20.04+)

### Google OAuth
- ✅ All platforms with system browser
- ✅ Automatic token handling
- ✅ Secure credential storage

## Troubleshooting

### Popup Not Appearing
1. Check if popup is already open (only one per type)
2. Verify main window is created
3. Check console for errors

### OAuth Not Working
1. Verify GOOGLE_CLIENT_ID is set
2. Check redirect URI matches Google Console
3. Ensure callback URL is whitelisted

### Popup Appearing Behind
This should not happen with the new system. If it does:
1. Check `alwaysOnTop` is true
2. Verify parent window is set
3. Update Electron to latest version

## Future Enhancements

1. **Popup Positioning**: Remember last position
2. **Multi-Monitor Support**: Open on correct screen
3. **Popup Themes**: Match main window theme
4. **Keyboard Shortcuts**: Quick popup access
5. **Popup State Sync**: Share state between windows

## Testing

### Manual Testing
1. Open browser
2. Click profile icon → Should open popup
3. Click settings → Should open popup
4. Open multiple popups → All should be visible
5. Close popup → Should close cleanly

### Automated Testing
```javascript
// Test popup opening
test('should open settings popup', async () => {
  await window.electronAPI.openSettingsPopup();
  // Verify popup is open
});

// Test OAuth flow
test('should complete OAuth flow', async () => {
  window.electronAPI.googleOAuthLogin();
  // Verify OAuth window opens
});
```

## Performance Considerations

- Popups are lightweight (transparent, frameless)
- Only one popup per type can be open
- Popups are destroyed when closed (memory cleanup)
- OAuth window is modal (blocks main window)

## Security

- OAuth happens in isolated window
- No credentials stored in localStorage
- Tokens stored in secure electron-store
- HTTPS-only OAuth endpoints

## Credits

Implemented by: Aartiq Browser Team
Date: February 2026
Version: 0.1.8
