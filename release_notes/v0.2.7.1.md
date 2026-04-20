# Comet AI Browser - Release Notes v0.2.7.1

**Release Date**: April 6, 2026

## Overview

Patch release addressing TypeScript compilation errors and type safety improvements. This release ensures the project builds cleanly with `npm run dev` and strengthens type definitions across the codebase.

---

## TypeScript Compilation Fixes

### Security.ts Type Corrections
- **Fixed regex pattern iteration**: Changed from generic `Object.entries()` to explicit `RegExp[]` casting for injection pattern loops
- **Removed invalid property access**: Fixed type inference issues with `pattern.source` and `pattern.flags` that were incorrectly inferred from union types
- **Simplified regex construction**: Removed unnecessary type guards and conversions

### electron.d.ts Plugin API Addition
- **Added complete plugins interface**: Integrated all plugin system APIs into the global `electronAPI` type definition
- **Includes 12 plugin methods**:
  - `list()`, `get()`, `install()`, `uninstall()`, `update()`
  - `enable()`, `disable()`, `getCommands()`, `executeCommand()`
  - `updateConfig()`, `getDir()`, `scan()`
  - Event listeners: `onInstalled()`, `onUninstalled()`, `onConfigUpdated()`

### PluginSettings.tsx Type Mapping
- **Fixed plugin list mapping**: Properly transforms API response to internal `Plugin` type
- **Added explicit callback types**: All plugin event callbacks now have proper type annotations
- **Removed implicit `any` types**: Resolved 15+ type errors in plugin settings component

### AIChatSidebar.tsx Result Type Fix
- **Fixed result property access**: Changed `result.output` to `result.result` to match the API interface

### AIUtils.ts Variable Reference Fix
- **Fixed `data.title` reference**: Changed to `title` parameter in `buildCleanPDFContent()` function
- This was a template literal referencing undefined variable that would cause runtime errors

---

## Build System Improvements

### Regex Flag Compatibility
- **Replaced ES2018 `gs` flags**: Changed `/<<<.*?>>>/gs` to `/<<<[\s\S]*?>>>/g`
- **Pattern compatibility**: Ensures compatibility with TypeScript's target ES2020 in standalone tsc command
- Two regex patterns updated for cross-compiler compatibility

### tsconfig.json Target Update
- Updated TypeScript target from ES2017 to ES2020
- Improves regex and string handling capabilities

---

## Verification

All TypeScript errors resolved:
- `npx tsc --noEmit` passes with 0 errors
- `npm run predev` compiles successfully
- All plugin APIs fully typed and available

---

## Files Modified

| File | Changes |
|------|---------|
| `src/types/electron.d.ts` | Added complete plugins API interface |
| `src/lib/Security.ts` | Fixed regex pattern type casting |
| `src/components/PluginSettings.tsx` | Added type mapping and callbacks |
| `src/components/AIChatSidebar.tsx` | Fixed result property access |
| `src/components/ai/AIUtils.ts` | Fixed `data.title` → `title` |
| `tsconfig.json` | Updated target to ES2020 |

---

## Migration Notes

No breaking changes. This is a pure type-definition and build-system patch.

---

## Credits

- TypeScript compilation fixes by AI assistant
