# Aartiq Browser Enhancement Implementation Plan

## Phase 1: Critical Fixes (Priority: HIGH)

### 1.1 Transparent Overlay Window System
**Status:** In Progress
**Files to Modify:**
- `main.js` - Add overlay window creation and management
- `preload.js` - Add IPC handlers for overlay communication
- `src/app/ClientOnlyPage.tsx` - Update overlay rendering logic

**Implementation:**
```javascript
// Create separate transparent window for overlays
let overlayWindow = null;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    parent: mainWindow,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay_preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // Sync position with main window
  const syncPosition = () => {
    if (mainWindow && overlayWindow) {
      const bounds = mainWindow.getBounds();
      overlayWindow.setBounds(bounds);
    }
  };
  
  mainWindow.on('move', syncPosition);
  mainWindow.on('resize', syncPosition);
}
```

### 1.2 Music Visualizer Redesign
**Status:** Planned
**Location:** Right side of URL bar
**Design:** Minimal, clean, modern

**Features:**
- Compact waveform animation
- Subtle color scheme matching theme
- Shows current track info on hover
- Click to expand player controls

---

## Phase 2: OS-Specific Features (Priority: HIGH)

### 2.1 macOS Specific Features
**Files to Create/Modify:**
- `src/lib/platform/MacOSIntegration.ts`
- `main.js` - Add macOS-specific menu and shortcuts

**Features:**
- ✅ Native menu bar integration
- ✅ Touch Bar support
- ✅ Spotlight integration
- ✅ Raycast extension support
- ✅ macOS notification center
- ✅ Handoff support
- ✅ Quick Look integration

### 2.2 Windows Specific Features
**Files to Create/Modify:**
- `src/lib/platform/WindowsIntegration.ts`
- `main.js` - Add Windows-specific features

**Features:**
- ✅ Jump List integration
- ✅ Windows notifications
- ✅ Taskbar progress
- ✅ Windows Hello integration
- ✅ Cortana integration
- ✅ Windows Search integration

### 2.3 Linux Specific Features
**Files to Create/Modify:**
- `src/lib/platform/LinuxIntegration.ts`

**Features:**
- ✅ Desktop file integration
- ✅ System tray icon
- ✅ Native notifications
- ✅ Wayland/X11 support
- ✅ KDE/GNOME integration

---

## Phase 3: Raycast Extension (macOS)

### 3.1 Raycast Extension Structure
**Directory:** `raycast-extension/`

**Files to Create:**
```
raycast-extension/
├── package.json
├── src/
│   ├── search-tabs.tsx
│   ├── new-tab.tsx
│   ├── search-history.tsx
│   ├── ai-search.tsx
│   └── bookmarks.tsx
└── assets/
    └── icon.png
```

**Features:**
- Quick tab search
- Create new tab with URL
- Search browsing history
- AI-powered search
- Bookmark management
- Quick actions (reload, close tab, etc.)

---

## Phase 4: Native Flutter Mobile App

### 4.1 Flutter App Structure
**Directory:** `../AartiqBrowserMobile/aartiq/`

**Platform-Specific Implementations:**
- iOS: Native WebKit integration
- Android: Native Chrome Custom Tabs
- Shared: Flutter UI layer

**Features:**
- ✅ Native browser engine integration
- ✅ Sync with desktop via Firebase
- ✅ P2P sync support
- ✅ AI chat sidebar
- ✅ Password manager
- ✅ Tab sync
- ✅ History sync
- ✅ Bookmark sync

### 4.2 Platform Channels
**iOS (Swift):**
```swift
// ios/Runner/BrowserChannel.swift
class BrowserChannel {
  func openURL(_ url: String)
  func getCurrentURL() -> String
  func goBack()
  func goForward()
  func reload()
}
```

**Android (Kotlin):**
```kotlin
// android/app/src/main/kotlin/BrowserChannel.kt
class BrowserChannel {
  fun openURL(url: String)
  fun getCurrentURL(): String
  fun goBack()
  fun goForward()
  fun reload()
}
```

---

## Phase 5: Enhanced Features

### 5.1 Music Visualizer Component
**File:** `src/components/MusicVisualizer.tsx`

**Design Specs:**
- Width: 120px
- Height: 32px
- Position: Right of URL bar
- Animation: Smooth waveform
- Colors: Theme-adaptive

### 5.2 Platform Detection Utility
**File:** `src/lib/platform/detector.ts`

```typescript
export const platform = {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  
  getOS(): 'macos' | 'windows' | 'linux' {
    if (this.isMac) return 'macos';
    if (this.isWindows) return 'windows';
    return 'linux';
  }
};
```

---

## Implementation Timeline

### Week 1: Critical Fixes
- [x] Tab loading bug fix
- [ ] Transparent overlay window system
- [ ] Music visualizer redesign

### Week 2: OS Integration
- [ ] macOS features
- [ ] Windows features
- [ ] Linux features

### Week 3: Raycast Extension
- [ ] Basic extension structure
- [ ] Tab management commands
- [ ] AI search integration

### Week 4: Flutter Mobile App
- [ ] iOS native integration
- [ ] Android native integration
- [ ] Sync implementation

---

## Testing Checklist

### Desktop (Electron)
- [ ] macOS (Intel)
- [ ] macOS (Apple Silicon)
- [ ] Windows 10/11
- [ ] Ubuntu 22.04+
- [ ] Fedora 38+

### Mobile (Flutter)
- [ ] iOS 15+
- [ ] Android 10+

### Raycast
- [ ] macOS 12+ with Raycast installed

---

## Dependencies to Add

### Electron (main.js)
```json
{
  "electron-window-state": "^5.0.3",
  "electron-updater": "^6.1.7"
}
```

### Raycast Extension
```json
{
  "@raycast/api": "^1.65.0",
  "@raycast/utils": "^1.12.0"
}
```

### Flutter Mobile
```yaml
dependencies:
  webview_flutter: ^4.4.2
  flutter_inappwebview: ^6.0.0
  firebase_core: ^2.24.2
  firebase_auth: ^4.15.3
```

---

## Notes

- All platform-specific code should be properly abstracted
- Use feature detection, not platform detection where possible
- Maintain consistent UX across all platforms
- Ensure proper error handling for unsupported features
- Document platform-specific limitations
