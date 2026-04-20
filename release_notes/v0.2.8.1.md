# Comet AI Browser - v0.2.8.1 Release Notes

**Release Date:** 2026-04-10  
**Channel:** Stable  
**Codename:** Nebula

---

## Native UI Enhancements

### 9 New Liquid Glass Themes

Added comprehensive glass morphism themes with ultra-translucent backgrounds:

| Theme | Description | Accent Color |
|-------|-------------|--------------|
| `graphite` | Dark gray minimal | Indigo #6366f1 |
| `crystal` | Cool cyan tones | Cyan #06b6d4 |
| `obsidian` | Deep purple-black | Purple #a855f7 |
| `azure` | Blue ocean | Blue #3b82f6 |
| `rose` | Pink rose quartz | Pink #ec4899 |
| `aurora` | Green aurora borealis | Emerald #10b981 |
| `nebula` | Purple nebula clouds | Violet #8b5cf6 |
| `liquidGlass` | Ultra translucent | Indigo #6366f1 |
| `translucent` | Nearly invisible glass | Slate #64748b |

### Visual Enhancements

- **30-50% reduction** in background opacity for true translucency
- **Multi-layer gradients** for depth and specular highlights
- **Improved spring animations** (0.18-0.22s response, 0.5-0.7 damping)
- **Specular highlight overlays** on all glass surfaces
- **Consistent glass treatment** across all card components
- **Ultra-thin materials** for maximum transparency

### New Components Added

- `UltraTranslucentBackground` - True translucent panel background
- `UltraTranslucentVisualEffectView` - Custom NSVisualEffectView wrapper
- `GlassPreset` enum - Theme management
- `GlassOptionButton` - Glass-styled option buttons
- `GlassDivider` - Gradient dividers

### AICommandParser Robustness

- Multiple JSON parsing patterns for different AI response formats
- Graceful handling of unknown command types
- Fallback to "unknown" category instead of ignoring
- Improved regex patterns for JSON command extraction
- Safe substring extraction to prevent crashes

---

## Swift UI Updates

### Settings View
- All 9 themes now available in theme selector
- Clean glass button styling
- Updated descriptions for each theme

### Native Panels
- THINK UI now has animated thinking indicator
- Rich markdown rendering via WKWebView (KaTeX/math/markdown support)
- Mermaid diagram rendering via MermaidView (MermaidJS via WKWebView)
- Liquid Glass theme applied to all native panels
- macOS menu with direct settings access (⌘, shortcuts)

---

## Previous Version (v0.2.8)

### TypeScript Compilation Fixes
- Fixed Security.ts type errors with explicit RegExp casting
- Added plugins API to electron.d.ts
- Fixed AIChatSidebar.tsx result property access
- Fixed AIUtils.ts undefined data.title

### Build Verification
- `npx tsc --noEmit` passes with 0 errors
- `npm run predev` compiles successfully

---

## Next Version

See [v0.2.8.2](RELEASE_NOTES_v0.2.8.2.md) for latest features including Advanced Document Generation and Raycast Extension.