# Comet AI Browser - Release Notes v0.2.7

**Release Date**: April 4, 2026

## Highlights

### 🛡️ Hardened Authentication Flow
- **Deep-Link Protocol Intercept**: Re-engineered Electron authentication handling to properly catch custom `comet-browser://` deep links using `did-fail-load`. The system now reliably handles failed web engine loading of OS-level protocols, ensuring seamless auto-closing during Google and Firebase sign-in.
- **Multi-layered Redirect Fixes**: Added a Next.js `did-navigate-in-page` fallback and console message intercept from the landing page. This guarantees the authentication popup dismisses immediately after login, regardless of how the success signal is delivered.
- **Landing Page Synchronization**: Updated the `browser.ponsrischool.in` authentication signaling mechanism to uniformly emit a normalized `comet-auth-success` console payload, carrying secure tokens and user metadata.

### 🏗️ Core Stability & Main Process De-duplication
- **IPC Handler Cleanup**: Stripped out extensive redundant IPC handlers in `main.js` (including `automation:get-tasks`, `get-platform`, `get-app-version`, and more) resolving terminal startup crashes.
- **Memory Leak Prevention**: Addressed and resolved `MaxListenersExceededWarning` memory leaks by removing unbound and orphaned process listeners.
- **Automation Service Locks**: Implemented a concurrency lock around `initializeAutomationService()` guarding against duplicate background process spin-ups that were previously crashing the system scheduler.
- **API Modernization**: Replaced deprecated `console-message` event parameters with properly typed Event objects across `authWindow` instances.
