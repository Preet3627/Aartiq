# Advanced Features Implementation Guide

## 🚀 New Features Overview

This document outlines the implementation of advanced cross-app control features in Aartiq Browser.

---

## 1. ✨ Unified Search System

### Features:
- **Search Everything**: Apps, WiFi, Bluetooth, system settings, files, and web content
- **Keyboard Navigation**: Arrow keys, Enter to select, Esc to close
- **Global Hotkey**: `Windows/CMD + Shift + Space` (works even when browser is closed)
- **Smart Suggestions**: Context-aware results based on query

### Usage:
```typescript
// Open unified search programmatically
window.dispatchEvent(new CustomEvent('open-unified-search'));

// Or use global hotkey: Windows/CMD + Shift + Space
```

### Search Examples:
- `"wifi"` → Opens WiFi settings
- `"bluetooth"` → Opens Bluetooth settings  
- `"volume"` → Opens volume control
- `"brightness"` → Opens display settings
- `"chrome"` → Searches for Chrome app
- `"demo"` → Starts AI feature demonstration

---

## 2. 🤖 AI Feature Demonstration

### Features:
- **Permission System**: Asks user before controlling device
- **Step-by-Step Walkthrough**: Visual progress with status messages
- **Interactive Demo**: Shows real actions (opening apps, adjusting settings, etc.)
- **Pause/Resume**: Control demo playback
- **Skip Steps**: Jump to next demonstration

### Demo Steps:
1. **Welcome** - Introduction
2. **Intelligent Search** - Shows unified search
3. **Smart Browsing** - Navigates to website
4. **File Manager** - Opens file explorer
5. **Cross-App Clicking** - Demonstrates OCR clicking
6. **WiFi Info** - Shows network status
7. **Volume Control** - Adjusts system volume
8. **Complete** - Finish message

### Usage:
```typescript
// Start demo
window.dispatchEvent(new CustomEvent('start-ai-demo'));
```

---

## 3. 🎯 Cross-App OCR Clicking

### Features:
- **Screen Capture**: Captures entire screen or regions
- **OCR Analysis**: Detects all clickable text elements
- **AI Commands**: Natural language click commands
- **Visual Feedback**: Shows click locations with ripple effects
- **Click History**: Tracks recent actions

### Usage:
```typescript
// Capture screen and enable OCR clicking
const result = await window.electronAPI.captureScreenRegion({
  x: 0,
  y: 0,
  width: window.screen.width,
  height: window.screen.height
});

// Perform cross-app click
await window.electronAPI.performCrossAppClick({ x: 100, y: 200 });
```

### AI Commands:
- `"Click on File"` - Clicks on "File" text
- `"Click on Close"` - Clicks on "Close" button
- `"Click on the Settings icon"` - Finds and clicks Settings

---

## 4. 📡 System Control APIs

### Screen Capture
```typescript
const screenshot = await window.electronAPI.captureScreenRegion({
  x: 0,
  y: 0,
  width: 1920,
  height: 1080
});
// Returns: { success: boolean, image?: string, error?: string }
```

### Application Search
```typescript
const apps = await window.electronAPI.searchApplications("chrome");
// Returns: { success: boolean, results: Array<{name, path}>, error?: string }
```

### Open External App
```typescript
await window.electronAPI.openExternalApp("/path/to/app");
// Returns: { success: boolean, error?: string }
```

### Cross-App Click
```typescript
await window.electronAPI.performCrossAppClick({ x: 500, y: 300 });
// Returns: { success: boolean, error?: string }
```

### Shell Commands
```typescript
const result = await window.electronAPI.executeShellCommand("ls -la");
// Returns: { success: boolean, output?: string, error?: string }
```

---

## 5. ⌨️ Global Hotkeys

### Spotlight Search
- **Windows**: `Windows + Shift + Space`
- **macOS**: `Command + Shift + Space`
- **Linux**: `Windows + Shift + Space`

**Behavior**:
- Opens browser if closed
- Shows window if hidden
- Focuses window and opens unified search

---

## 6. 🔧 Integration Guide

### Step 1: Add Components to ClientOnlyPage

```typescript
import UnifiedSearch from '@/components/UnifiedSearch';
import AIFeatureDemo from '@/components/AIFeatureDemo';
import CrossAppOCR from '@/components/CrossAppOCR';

// Add state
const [showUnifiedSearch, setShowUnifiedSearch] = useState(false);
const [showAIDemo, setShowAIDemo] = useState(false);
const [showCrossAppOCR, setShowCrossAppOCR] = useState(false);

// Add event listeners
useEffect(() => {
  const handleOpenSearch = () => setShowUnifiedSearch(true);
  const handleStartDemo = () => setShowAIDemo(true);
  
  window.addEventListener('open-unified-search', handleOpenSearch);
  window.addEventListener('start-ai-demo', handleStartDemo);
  
  if (window.electronAPI) {
    const unsubscribe = window.electronAPI.onOpenUnifiedSearch(handleOpenSearch);
    return () => {
      window.removeEventListener('open-unified-search', handleOpenSearch);
      window.removeEventListener('start-ai-demo', handleStartDemo);
      unsubscribe();
    };
  }
}, []);

// Render components
<UnifiedSearch 
  isOpen={showUnifiedSearch}
  onClose={() => setShowUnifiedSearch(false)}
  onNavigate={(url) => {
    // Handle navigation
    store.addTab(url);
  }}
/>

<AIFeatureDemo 
  isActive={showAIDemo}
  onClose={() => setShowAIDemo(false)}
/>

<CrossAppOCR 
  isActive={showCrossAppOCR}
  onClose={() => setShowCrossAppOCR(false)}
/>
```

### Step 2: Add Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // CMD/Windows + Shift + Space for unified search
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Space') {
      e.preventDefault();
      setShowUnifiedSearch(true);
    }
    
    // CMD/Windows + K for cross-app OCR
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowCrossAppOCR(true);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Step 3: Update URL Bar

```typescript
// In URL bar input onChange handler
const handleUrlBarChange = (value: string) => {
  setInputValue(value);
  
  // Trigger unified search for special queries
  if (value.startsWith('@')) {
    setShowUnifiedSearch(true);
  }
};
```

---

## 7. 🔒 Security Considerations

### Permission System
- AI demo requires explicit user permission
- Cross-app clicking shows permission dialog
- Shell commands are logged for audit

### Command Whitelist (Recommended for Production)
```typescript
const ALLOWED_COMMANDS = [
  'netsh interface show interface',
  'networksetup -getairportpower',
  'nmcli device wifi list',
  // Add more safe commands
];

// Validate before execution
if (!ALLOWED_COMMANDS.some(cmd => command.startsWith(cmd))) {
  return { success: false, error: 'Command not allowed' };
}
```

### Rate Limiting
```typescript
const commandRateLimit = new Map<string, number>();

function checkRateLimit(command: string): boolean {
  const now = Date.now();
  const lastExec = commandRateLimit.get(command) || 0;
  
  if (now - lastExec < 1000) { // 1 second cooldown
    return false;
  }
  
  commandRateLimit.set(command, now);
  return true;
}
```

---

## 8. 📊 Platform-Specific Implementations

### Windows
```typescript
// WiFi Settings
'start ms-settings:network-wifi'

// Bluetooth Settings
'start ms-settings:bluetooth'

// Volume Control
'start sndvol'

// Brightness
'start ms-settings:display'

// File Manager
'explorer'
```

### macOS
```typescript
// WiFi Settings
'open /System/Library/PreferencePanes/Network.prefPane'

// Bluetooth Settings
'open /System/Library/PreferencePanes/Bluetooth.prefPane'

// Volume Control
'open /System/Library/PreferencePanes/Sound.prefPane'

// Brightness
'open /System/Library/PreferencePanes/Displays.prefPane'

// File Manager
'open ~'
```

### Linux
```typescript
// WiFi Settings
'gnome-control-center wifi'

// Bluetooth Settings
'gnome-control-center bluetooth'

// Volume Control
'gnome-control-center sound'

// Brightness
'gnome-control-center display'

// File Manager
'nautilus ~'
```

---

## 9. 🧪 Testing

### Test Unified Search
1. Press `Windows/CMD + Shift + Space`
2. Type "wifi"
3. Verify WiFi settings open
4. Type "demo"
5. Verify AI demo starts

### Test AI Demo
1. Search for "demo" in unified search
2. Click "AI Feature Demonstration"
3. Grant permission
4. Verify all steps execute correctly
5. Test pause/resume/skip

### Test Cross-App OCR
1. Press `CMD/Windows + K`
2. Verify screen capture
3. Type "Click on File"
4. Verify click action

---

## 10. 🐛 Troubleshooting

### Unified Search Not Opening
- Check if global hotkey is registered
- Verify `onOpenUnifiedSearch` listener is set up
- Check console for errors

### Cross-App Click Not Working
- Ensure robotjs is installed: `npm install robotjs --build-from-source`
- Check if screen capture permissions are granted
- Verify OCR is detecting text elements

### AI Demo Permission Dialog Not Showing
- Check if `hasPermission` state is properly managed
- Verify `showPermissionDialog` is true initially

### Apps Not Found in Search
- Check platform-specific search paths
- Verify file system permissions
- Add custom search paths if needed

---

## 11. 📝 API Reference

### UnifiedSearch Component
```typescript
interface UnifiedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (url: string) => void;
}
```

### AIFeatureDemo Component
```typescript
interface AIDemoProps {
  isActive: boolean;
  onClose: () => void;
}
```

### CrossAppOCR Component
```typescript
interface CrossAppOCRProps {
  isActive: boolean;
  onClose: () => void;
}
```

---

## 12. 🎨 Customization

### Styling
All components use Tailwind CSS with custom glassmorphism effects. Modify colors in component files:

```typescript
// Purple/Blue gradient
className="bg-gradient-to-br from-purple-900/90 to-blue-900/90"

// Custom accent color
className="text-purple-400"
```

### Demo Steps
Add custom demo steps in `AIFeatureDemo.tsx`:

```typescript
{
  id: 'custom-step',
  title: 'Custom Action',
  description: 'Description of custom action',
  action: async () => {
    // Your custom action
    await window.electronAPI.executeShellCommand('custom-command');
  }
}
```

---

## 13. 📦 Dependencies

### Required
- `tesseract.js` - OCR functionality
- `robotjs` - Cross-app clicking
- `framer-motion` - Animations
- `lucide-react` - Icons

### Installation
```bash
npm install tesseract.js robotjs framer-motion lucide-react
```

---

## 14. 🚀 Performance Optimization

### OCR Caching
```typescript
const ocrCache = new Map<string, OCRResult[]>();

async function performOCRWithCache(imageData: string) {
  const hash = hashImage(imageData);
  
  if (ocrCache.has(hash)) {
    return ocrCache.get(hash);
  }
  
  const results = await performOCR(imageData);
  ocrCache.set(hash, results);
  
  return results;
}
```

### Debounced Search
```typescript
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    performUnifiedSearch(query);
  }, 300),
  []
);
```

---

**Version**: 1.0.0  
**Last Updated**: February 11, 2026  
**Status**: ✅ Production Ready
