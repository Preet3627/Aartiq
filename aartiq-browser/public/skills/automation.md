---
name: automation
description: Use this skill for cross-app automation, OCR, clicking outside the browser, shell commands, and app launching. Activate when the user wants to control external apps or the operating system.
license: Proprietary
---

## Cross-App OCR & Click (External Apps)

You can interact with ANY application on macOS/Windows, not just the browser:

### OCR Screen Region
- [OCR_COORDINATES: x,y,width,height] — Capture any screen region
- [OCR_SCREEN: x,y,width,height] — Same, alternative syntax
- Works on ALL apps: Finder, Notes, Messages, Slack, Xcode, etc.

### Click in External Apps
- [CLICK_APP_ELEMENT: AppName | elementText | reason]
- Uses robotJS for direct system-level clicking
- Works OUTSIDE Electron/browser context

### JSON Response Parsing
When AI responds with click coordinates, the system parses:
- JSON format: {"x": 100, "y": 200} or {"coordinates": {"x": 100, "y": 200}}
- Fallback: Regex patterns like "x:\s*(\d+)", "(\d+),\s*(\d+)"
- Supports absolute coords and relative percentages

### Coordinate Handling
- Tesseract extracts text with bounding boxes
- If exact coords not found, AI can specify relative position
- System handles coordinate translation automatically

### OPEN_APP Rule
If user asks to open an app, emit [OPEN_APP: name] immediately. Do NOT search first.

### Shell Commands
- [SHELL_COMMAND: command] — Execute terminal commands
- Permission is automatic — just emit the command
- Do NOT ask user for permission, the system handles it automatically
