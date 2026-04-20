# Comet-AI v0.2.5 Release Notes

**Release Date:** March 26, 2026

---

## 🚀 New Features

### Automation Panel
- **Settings Integration** - Automation section now available in Settings panel
- **Task Management** - View, filter (All/Active/Paused), and manage scheduled tasks
- **Create Task Button** - "+ Create Task" button opens scheduling modal
- **Scrolling** - Fixed panel overflow with scrollable task list

### AI Commands
- **OPEN_AUTOMATION_SETTINGS** - AI can open automation settings directly
- **OPEN_SCHEDULING_MODAL** - AI can prefill and open scheduling modal with data
- **JSON Format** - SCHEDULE_TASK now uses JSON format exclusively

### Panel Updates
- **Translate Panel** - Added scrolling with max-height limit
- **z-[9999] Layer** - All panels now appear on top of browser view
- **Browser Disable** - Browser view disabled when panels open

---

## 🐛 Bug Fixes

1. **Duplicate Import** - Fixed SpotlightSearchOverlay imported twice
2. **Automation Service** - Fixed crash when service not initialized
3. **ClientOnlyPage Parsing** - Fixed syntax errors from incorrect code blocks
4. **Infinite Loop** - Fixed useEffect missing dependency array

---

## 🔧 Updates

- Removed deprecated GENERATE_PDF format from AI guide
- PDF template markers now properly passed to generator
- All version references updated to v0.2.5

---

## 📝 Version History

| Version | Date | Key Changes |
|---------|------|--------------|
| v0.2.5 | 2026-03-26 | Automation panel, AI commands, panel fixes |
| v0.2.4 | 2026-03-XX | AI scheduling, mobile notifications |
| v0.2.3 | Earlier | Initial automation features |

---

## 🔗 Downloads

Download from GitHub releases:
- Windows: `Comet-Setup.exe`
- macOS: `Comet-Mac.dmg`
- Linux: `Comet-Linux.AppImage`