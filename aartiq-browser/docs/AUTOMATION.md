# Automation Layer Architecture

## Overview

The Automation Layer provides a unified interface for desktop automation tasks across macOS, Windows, and Linux. It abstracts away platform-specific implementations and provides a fallback to robotjs when native automation is unavailable.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AutomationLayer                            │
│  (src/automation/index.js)                                      │
│  • Platform detection                                           │
│  • Backend selection (native/robotjs/none)                      │
│  • Unified API for all automation tasks                         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   mac.js    │      │   win.js    │      │  linux.js   │
│  (163 ln)   │      │  (228 ln)   │      │  (167 ln)   │
│             │      │             │      │             │
│ • AppleScript│      │ • PowerShell│      │ • xdotool   │
│ • Accessibility│   │ • WScript   │      │ • xkbevent  │
│ • CGEvent   │      │ • UIAutomation│    │ • dbus-send │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         └──────────┬─────────┴────────────────────┘
                    ▼
          ┌─────────────────┐
          │   fallback.js   │
          │    (80 ln)      │
          │                 │
          │ • MouseJest     │
          │ • Basic keys   │
          └─────────────────┘
```

## Core Classes

### AutomationLayer

Main class that provides the unified automation API.

```javascript
import { AutomationLayer } from './automation';

const automation = new AutomationLayer({
  useNative: true,      // Prefer native over robotjs
  useRobotjs: true,     // Fallback to robotjs
  debug: false          // Enable debug logging
});
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `backend` | `string` | Current backend: `'native'`, `'robotjs'`, `'none'` |
| `isAvailable` | `boolean` | Whether automation is available |
| `os` | `string` | Detected OS: `'mac'`, `'win'`, `'linux'` |

#### Methods

##### Mouse Operations

```javascript
// Move mouse to position
await automation.moveMouse(x, y, options?);

// Click at position
await automation.click(x, y, button?, double?, options?);

// Get current mouse position
const pos = automation.getMousePos(); // { x: number, y: number }

// Scroll mouse
await automation.scroll(x, y, direction, amount?, options?);
```

##### Keyboard Operations

```javascript
// Type text
await automation.typeText(text, options?);

// Press a key
await automation.keyTap(key, modifiers?, options?);

// Press key combination
await automation.keyToggle(key, down, modifiers?, options?);
```

##### Screen Operations

```javascript
// Take screenshot
const screenshot = await automation.screenshot(options?);
```

##### Sequence Operations

```javascript
// Execute a sequence of actions
const results = await automation.executeClickSequence(actions, options?);
```

## Platform-Specific Backends

### macOS (mac.js)

Uses native macOS APIs for automation:

- **CGEvent**: Low-level mouse and keyboard events
- **AppleScript**: Application automation via script
- **Accessibility API**: UI element inspection

```javascript
// Direct CGEvent usage
automation.mac?.cgEvent?.moveMouse(x, y);
automation.mac?.cgEvent?.click(button, x, y);
automation.mac?.cgEvent?.scroll(deltaX, deltaY);
```

### Windows (win.js)

Uses Windows automation APIs:

- **PowerShell**: System automation commands
- **WScript/CScript**: COM automation (legacy)
- **UIAutomation**: Modern UI element automation

```javascript
// Direct PowerShell execution
automation.win?.runPowerShell(command);
```

### Linux (linux.js)

Uses Linux automation tools:

- **xdotool**: X11 window/workspace automation
- **xkb-event**: Keyboard event injection
- **dbus-send**: D-Bus communication
- **ydotool**: Universal automation tool

```javascript
// Direct ydotool usage
automation.linux?.ydotool?.mouseMove(x, y);
automation.linux?.ydotool?.key(type, key);
```

## Fallback Backend

When native automation is unavailable, the system falls back to:

```javascript
// Basic JavaScript-based simulation
automation.fallback?.mouseMove(x, y);
automation.fallback?.keyTap(key);
```

## Configuration

### Options

```typescript
interface AutomationOptions {
  useNative?: boolean;      // Prefer native over robotjs (default: true)
  useRobotjs?: boolean;     // Enable robotjs fallback (default: true)
  debug?: boolean;           // Enable debug logging (default: false)
  timeout?: number;          // Operation timeout in ms (default: 5000)
  retryCount?: number;       // Number of retries (default: 3)
}
```

## Error Handling

All methods return Promises and throw on failure:

```javascript
try {
  await automation.click(100, 200);
} catch (error) {
  if (error.code === 'AUTOMATION_UNAVAILABLE') {
    // Handle unavailable automation
  } else if (error.code === 'TIMEOUT') {
    // Handle timeout
  }
}
```

## Security Considerations

1. **Sandboxing**: Automation runs in the main process with full system access
2. **Permissions**: Some operations require elevated privileges
3. **Input Validation**: All coordinates are validated before execution
4. **Timeout Protection**: Long-running operations are automatically terminated

## Testing

```bash
# Run automation tests
npm test -- automation.test.js

# Test specific platform
node tests/automation.test.js
```

## Dependencies

| Package | Platform | Purpose |
|---------|----------|---------|
| robotjs | all | Cross-platform automation |
| ydotool | Linux | Universal Linux automation |
| AppleScript | macOS | Native macOS automation |
| PowerShell | Windows | Native Windows automation |

## Migration from robotjs

The Automation Layer is designed to replace direct robotjs usage:

```javascript
// Old robotjs code
robotjs.moveMouse(x, y);
robotjs.click();

// New AutomationLayer code
automation.moveMouse(x, y);
automation.click(x, y);
```

Benefits:
- Cross-platform compatibility
- Graceful fallback
- Better error handling
- Platform-specific optimizations
