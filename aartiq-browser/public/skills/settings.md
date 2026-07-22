---
name: settings
description: Use this skill when the user wants to read or modify browser settings, bookmarks, browsing history, permission grants, allowlisted directories, or customize chat style and open settings panels. Activate when the user says "bookmarks", "history", "permissions", "change style", "open settings", or similar.
license: Proprietary
---

## Settings & Browser Management Workflow

### 1. Settings Queries & Updates
- **SETTINGS_QUERY**: Read a category (`webSearch`, `ai`, `ui`, or `permissions`).
  - JSON format: `{"type": "SETTINGS_QUERY", "category": "webSearch"}`
- **SETTINGS_UPDATE**: Modify settings under `webSearch`, `ai`, or `ui` (requires user approval).
  - JSON format: `{"type": "SETTINGS_UPDATE", "category": "webSearch", "updates": {"maxPages": 5}}`

### 2. Bookmarks Library
- **LIST_BOOKMARKS**: Retrieve all bookmarks in the browser.
  - JSON format: `{"type": "LIST_BOOKMARKS"}`
- **ADD_BOOKMARK**: Add a bookmark with a URL and optional title.
  - JSON format: `{"type": "ADD_BOOKMARK", "url": "https://example.com", "title": "Example site"}`
- **REMOVE_BOOKMARK**: Remove a bookmark by URL.
  - JSON format: `{"type": "REMOVE_BOOKMARK", "url": "https://example.com"}`
- **CLEAR_BOOKMARKS**: Clear all bookmarks (requires user approval).
  - JSON format: `{"type": "CLEAR_BOOKMARKS"}`

### 3. Browsing History
- **LIST_HISTORY**: Retrieve recent browsing history (optional limit, defaults to 50).
  - JSON format: `{"type": "LIST_HISTORY", "limit": 20}`
- **CLEAR_HISTORY**: Clear all browsing history (requires user approval).
  - JSON format: `{"type": "CLEAR_HISTORY"}`

### 4. Customizing Chat Appearance (Style)
- **SET_CHAT_STYLE**: Instantly adjust font size, glow preset, and glow mode for the chat assistant sidebar.
  - JSON format: `{"type": "SET_CHAT_STYLE", "fontSize": 15, "glowMode": "gradient", "glowPreset": "sunset-fire"}`
  - `glowMode` options: `"off"`, `"gradient"`, `"rgb"`
  - `glowPreset` options: `"purple-cosmos"`, `"ocean-blue"`, `"emerald-forest"`, `"sunset-fire"`, `"rose-gold"`, `"arctic-ice"`, `"custom"`

### 5. Opening Settings Panels
- **OPEN_SETTINGS_PANEL**: Open a specific tab or utility panel for the user in the browser window.
  - JSON format: `{"type": "OPEN_SETTINGS_PANEL", "panel": "vault"}`
  - `panel` options: `"settings"`, `"bookmarks"`, `"history"`, `"extensions"`, `"downloads"`, `"clipboard"`, `"workspace"`

---

## Examples

**User: "Show my bookmarks"**
→ Use `{"type": "LIST_BOOKMARKS"}`

**User: "Add this tab to bookmarks"**
→ Use `{"type": "ADD_BOOKMARK", "url": "https://news.ycombinator.com", "title": "Hacker News"}`

**User: "Clear my browsing history"**
→ Use `{"type": "CLEAR_HISTORY"}`

**User: "Make my chat glow with red/fire colors"**
→ Use `{"type": "SET_CHAT_STYLE", "glowMode": "gradient", "glowPreset": "sunset-fire"}`

**User: "Which directories are allowlisted?"**
→ Use `{"type": "SETTINGS_QUERY", "category": "permissions"}`
