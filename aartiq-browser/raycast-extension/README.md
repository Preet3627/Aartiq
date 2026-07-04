# Aartiq Browser - Raycast Extension

Control Aartiq Browser directly from Raycast on macOS.

## Features

### 🔍 Search Tabs
Quickly find and switch between your open tabs.

**Shortcuts:**
- `⌘ + Enter` - Switch to tab
- `⌘ + W` - Close tab
- `⌘ + C` - Copy URL

### 🆕 New Tab
Open a new tab with a specific URL or search query.

### 📚 Search History
Search through your browsing history and quickly revisit pages.

### ✨ AI Search
Perform AI-powered searches using Aartiq's built-in AI.

### 🔖 Bookmarks
Quick access to your bookmarks.

### ⚡ Quick Actions
Common browser actions:
- Reload current tab
- Close current tab
- New incognito tab
- Open downloads
- Clear history

## Installation

### Prerequisites
- macOS 12.0 or later
- Raycast installed
- Aartiq Browser installed and running

### Install from Raycast Store
1. Open Raycast
2. Search for "Aartiq Browser"
3. Click Install

### Manual Installation
1. Clone this repository
2. Navigate to `raycast-extension/`
3. Run `npm install`
4. Run `npm run build`
5. Import the extension in Raycast

## Setup

1. Open Aartiq Browser
2. Go to Settings → Integrations
3. Enable "Raycast Integration"
4. The extension will automatically connect

## Usage

### Search Tabs
1. Open Raycast (`⌘ + Space`)
2. Type "Search Tabs" or use the shortcut
3. Start typing to filter tabs
4. Press `Enter` to switch to the selected tab

### New Tab
1. Open Raycast
2. Type "New Tab"
3. Enter a URL or search query
4. Press `Enter`

### AI Search
1. Open Raycast
2. Type "AI Search"
3. Enter your query
4. Get AI-powered results directly in Raycast

## Keyboard Shortcuts

You can customize these in Raycast settings:

- **Search Tabs:** `⌥ + T`
- **New Tab:** `⌥ + N`
- **Search History:** `⌥ + H`
- **AI Search:** `⌥ + A`
- **Bookmarks:** `⌥ + B`
- **Quick Actions:** `⌥ + Q`

## Communication Protocol

The extension now talks to Aartiq Browser through the local HTTP API exposed at `http://127.0.0.1:9877/raycast`. The API mirrors your current tabs/history and accepts commands (open tab, quick actions) so the Raycast client feels native without relying on AppleScript.

## Development

### Project Structure
```
raycast-extension/
├── package.json
├── src/
│   ├── search-tabs.tsx
│   ├── new-tab.tsx
│   ├── search-history.tsx
│   ├── ai-search.tsx
│   ├── bookmarks.tsx
│   └── quick-actions.tsx
└── assets/
    └── icon.png
```

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Lint
```bash
npm run lint
```

## Troubleshooting

### Extension not connecting to Aartiq
1. Make sure Aartiq Browser is running
2. Check that Raycast integration is enabled in Comet settings
3. Restart both Raycast and Aartiq

### Tabs not showing
1. Verify Comet has open tabs
2. Check Raycast extension permissions
3. Try reloading the extension

### Commands not working
1. Update to the latest version of Aartiq
2. Reinstall the Raycast extension
3. Check macOS accessibility permissions

## Privacy

- All data stays local on your Mac
- No data is sent to external servers
- Communication happens directly between Raycast and Aartiq

## Support

- **Issues:** [GitHub Issues](https://github.com/aartiq-browser/raycast-extension/issues)
- **Discussions:** [GitHub Discussions](https://github.com/aartiq-browser/raycast-extension/discussions)
- **Email:** support@aartiqbrowser.com

## License

Apache License 2.0 - see LICENSE file for details

## Credits

Developed by the Aartiq Browser team with ❤️

---

**Made for Raycast** 🚀
