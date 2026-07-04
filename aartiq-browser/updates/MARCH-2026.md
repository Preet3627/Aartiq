# Aartiq Browser Updates

## March 24, 2026 - Version 0.2.5 (Auto-Execution Update)

### What's New

🚀 **Auto-Executing Shell Commands**
- All shell commands now execute automatically without any permission dialogs
- No more blocking popups when AI runs terminal commands
- Commands run directly after validation

🔧 **New Permission Settings Panel**
- Settings > Permissions - dedicated section for macOS system permissions
- Lists: Screen Recording, Accessibility, Automation
- "Open Settings" buttons for quick access to System Preferences
- Shell command status and approval information

⚡ **Improved JSON Parsing**
- Fixed regex pattern for `{"commands": [...]}` format
- AI responses with JSON commands now parse correctly

📝 **Updated AI Instructions**
- AI knows permissions are handled automatically
- No longer asks "can I run this?" - just executes
- Clear instructions in AIConstants.ts about auto-execution

### Technical Changes

| File | Change |
|------|--------|
| main.js | Removed permission dialog from checkShellPermission() |
| main.js | Added open-system-settings IPC handler |
| preload.js | Added openSystemSettings API |
| SettingsPanel.tsx | Added PermissionSettings section |
| PermissionSettings.tsx | New component for permissions UI |
| AICommandParser.ts | Fixed JSON parsing regex |
| AIConstants.ts | Updated AI instructions |
| electron.d.ts | Added type definition |

### How It Works Now

1. User asks AI: "list my Downloads folder"
2. AI emits: `[SHELL_COMMAND: ls ~/Downloads]`
3. Command executes directly (no dialog)
4. Results shown in terminal panel

### macOS System Permissions

For full functionality, users should enable in System Settings:
- **Screen Recording** - For screenshot capture and OCR
- **Accessibility** - For mouse/keyboard automation  
- **Automation (Terminal)** - For shell command execution

Access via: Settings > Permissions in Aartiq Browser

---

### Branding
- **Aartiq Browser** v0.2.5
- Made with ❤️ in India
- Developer: [Preet3627](https://github.com/Preet3627)
- Platform: Windows | macOS | Linux

### Previous Updates
See CHANGELOG.md for earlier versions.