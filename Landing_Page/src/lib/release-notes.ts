// Auto-generated release notes
// Add new releases following the format below

export interface ReleaseEntry {
  version: string;
  date: string;
  codename: string;
  channel: 'alpha' | 'beta' | 'stable';
  changes: {
    new?: string[];
    fix?: string[];
    change?: string[];
    docs?: string[];
    security?: string[];
  };
}

export const releases: ReleaseEntry[] = [
  {
    version: '0.3.0',
    date: '2026-07-07',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Microsoft Store availability — Aartiq is now listed on the Microsoft Store',
        'Windows title bar redesign — standard minimize/maximize/close layout replaces traffic lights on non-Mac',
        'Windows MSIX build pipeline with automated identity injection for Store submission',
        'Self-signed code signing certificate generation for MSIX sideloading',
        'Startup onboarding flow with native window controls',
      ],
      fix: [
        'Security: base64-encoded payloads now decoded and re-scanned for shell commands (was fully bypassable)',
        'Security: all shellPrimitives now consistently treated as critical severity (dd, mkfs, shutdown, etc.)',
        'Security: Credential URL regex fixed to require protocol prefix (eliminates false positives)',
        'Fixed BrowserView not preserving cookies/auth across restarts (persistent partition)',
        'Fixed settings page crash',
        'Fixed navigation detection for redirect-heavy pages; added retry for JS-heavy extraction',
        'Fixed deepseek-r1 model defaults not removable',
        'Fixed WelcomeScreen broken IPC icon load',
        'Fixed 16x16 icon → 256x256 for Windows builder',
        'Fixed MSIX MinVersion to 10.0.17763.0 for Store compliance',
        'Fixed artifact upload directory flattening for CI release',
        'Fixed app:registerAppFileProtocol() not being called',
        'Fixed OCR/robot service initialization and DOM/OCR preference toggle',
      ],
      change: [
        'Bumped version to 0.3.0',
        'Transparent logo used across Windows/Linux builds',
        'Enhanced store/selectors for state management',
        'Refactored web search service',
        'Updated browser/file handlers',
      ],
      docs: [
        'Added Microsoft Store links across all READMEs and landing pages',
        'Added privacy policy with contact info for Store submission',
        'Updated AI-GUIDE.md with current version and release checklist',
        'Updated release notes for v0.3.0',
      ],
      security: [
        'SecureDOMParser now decodes and re-scans base64 payloads against injection patterns',
        'Consistent critical severity for all shell primitive matches',
        'Credential URL pattern requires URI scheme prefix',
      ]
    }
  },
  {
    version: '0.2.99',
    date: '2026-07-06',
    codename: 'Nebula',
    channel: 'alpha',
    changes: {
      change: [
        'Official rebrand from Comet-AI to Aartiq across Landing_Page',
        'Updated all product names, URLs, logos, and branding references',
        'Migrated domain references: browser.ponsrischool.in → aartiq.vercel.app',
        'Updated deep link schemes: comet-browser:// → aartiq-browser://, comet-ai:// → aartiq://',
        'Updated API headers: X-Comet-App-Token → X-Aartiq-App-Token',
        'Replaced logo from /icon.png to /logo-transparent.png',
        'Added Google Search Console verification tag for aartiq.vercel.app',
        'Expanded SEO keywords and JSON-LD structured data for maximum search visibility',
        'Updated AI-GUIDE.md with new project structure and branding',
        'Removed deprecated REFACTOR ATTEMPT entry from release notes',
        'Ran component scanner and synced component-data.json',
        'Set up Landing_Page as standalone git repository for Vercel deployment',
      ],
      docs: [
        'Updated AI-GUIDE.md with Aartiq project structure, URLs, and repository references',
        'Cleaned up release-notes.ts changelog (removed stale REFACTOR ATTEMPT entry)',
        'Synced component scanner data with Landing_Page'
      ]
    }
  },
  {
    version: '0.2.98',
    date: '2026-06-27',
    codename: 'Nebula',
    channel: 'alpha',
    changes: {
      security: [
        'Wired capability controller into main.js and command-executor.js — shell execution now gated by registered actions',
        'Added decryptLegacyBlob() for old-format E2EE: blobs (SHA-256 key derivation, no salt, 12-byte IV)',
        'Added migrateToNewFormat() to transparently upgrade legacy blobs to PBKDF2-based E2EE2: format',
        'Added runtime DOMPurify guard: gracefully degrades when window/document unavailable (main process safety)',
        'Removed dead checkCSSAttacks() — CSS safety is handled by DOMPurify or style stripping',
        'Audited Security.ts vs Security.js — Security.js does not exist in this repo; all callers import Security.ts directly',
        'Audited 31 AI-action IPC channels: 22 gated, 9 monitoring-only — documented in docs-audit/action-inventory.md',
      ],
      change: [
        'Replaced regex HTML sanitization with DOMPurify — eliminates two decades of known bypass techniques',
        'Replaced base64 "encryption" fallback with real AES-256-GCM + PBKDF2 (600K iterations) — no silent downgrades',
        'Refactored URL validation to protocol allowlist (http:, https:, mailto:) instead of denylist',
        'Encryption now requires a passphrase (min 8 chars) and throws typed errors on failure — no silent base64 fallback',
        'Decryption uses AES-GCM authenticated encryption — wrong passphrase or tampered data throws DecryptionError',
        'Added encodeLocalOnly() as an explicit, honesty-named escape hatch for non-sensitive local data',
        'Created main-process capability-controller.js (CommonJS) matching Security.ts TypeScript implementation',
        'Security docs stats updated to reflect audit reality: 22 gated + 9 monitoring-only channels',
      ],
      docs: [
        'Created docs-audit/action-inventory.md — comprehensive inventory of all 31 AI-action IPC channels',
        'Updated security docs with PBKDF2 parameters, capability-scoped execution model, and wiring details',
      ],
    }
  },
  {
    version: '0.2.9.4.3',
    date: '2026-04-23',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Enhanced CLI with model selection - Reads configured models from browser',
        'Interactive model selection - Choose model by number',
        'Chat sessions with history - Stored in ~/.aartiq/',
        'Live streaming output',
        'Last used model saved automatically',
        'Supports all providers: ollama, openai, anthropic, gemini, xai, groq'
      ],
      fix: [
        'Fixed scripts not found in packaged app - Copy to temp before execution',
        'Added scripts/ to build files'
      ],
      docs: [
        'Added Aartiq CLI documentation'
      ]
    }
  },
  {
    version: '0.2.9.4.2',
    date: '2026-04-23',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      fix: [
        'Fixed macOS app not launching - removed restricted entitlements',
        'Removed com.apple.security.cs.allow-jit',
        'Removed com.apple.security.cs.allow-unsigned-executable-memory',
        'Removed com.apple.security.cs.disable-library-validation',
        'App now works with ad-hoc code signing (no Apple Developer required)'
      ],
      docs: [
        'Created v0.2.9.4.2 release notes in /release_notes/'
      ]
    }
  },
  {
    version: '0.2.9.4.1',
    date: '2026-04-23',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Desktop Control from Mobile - Control desktop AI chat from mobile app',
        'Enhanced QR Scanner - Improved QR code scanning for pairing',
        'AI Streaming - Real-time AI response streaming to mobile',
        'Sync Settings UI - Connection status and settings management'
      ],
      fix: [
        'Improved camera handling on iOS for QR scanning',
        'Fixed TypeScript types for WiFiSyncService',
        'Fixed clipboard sync loop prevention',
        'Added proper echo prevention for desktop control'
      ],
      change: [
        'Updated WiFiSyncService with desktop-control handler',
        'Updated ConnectDesktopPage with improved QR scanner',
        'Updated SyncService with AI streaming support'
      ],
      docs: [
        'Created v0.2.9.4.1 release notes in /release_notes/'
      ]
    }
  },
  {
    version: '0.2.9.4.4',
    date: '2026-04-23',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Aartiq CLI - Powerful terminal-based browser control (comet ask, comet search)',
        'Automatic Response Continuation - Fixed AI interruptions with seamless "Keep-Alive" stitching',
        'Finalized Siri & Apple Shortcuts - Zero-setup AppIntents for hands-free automation',
        'Secure CLI Authentication - Token-based authorization via ~/.aartiq-token',
        'Deep Link Sync - Unified routing for CLI, Siri, and deep-link triggers'
      ],
      fix: [
        'Fixed AI mid-task interruption issues by implementing auto-continuation loop',
        'Fixed permission errors in CLI command execution',
        'Resolved deep link routing conflicts in packaged builds'
      ],
      change: [
        'Updated main.js with CLI native bridge endpoints',
        'Enhanced AIChatSidebar with recursive generation support',
        'Synchronized versioning to v0.2.9.4 across all components'
      ],
      docs: [
        'Updated README.md with comprehensive CLI usage guide',
        'Updated Apple Integration docs with Siri phrase reference',
        'Synchronized AI-GUIDE.md with latest stable version standards'
      ]
    }
  },
  {
    version: '0.2.9.3',
    date: '2026-04-20',
    codename: 'Omni',
    channel: 'stable',
    changes: {
      new: [
        'Siri Shortcuts Integration - Native macOS App Intents with 12 pre-configured shortcuts',
        'URL Scheme Handler - aartiq:// protocol for Shortcuts app triggers',
        'AppleScript Bridge - Voice command automation via osascript',
        'Voice Input Handler - macOS Dictation + Text-to-Speech integration',
        'Shortcuts Templates - Pre-built templates for common AI actions',
        'Windows Shortcuts Integration - Windows Shortcuts, Voice Control, Copilot',
        'Windows Voice Recognition - System.Speech for TTS/STT',
        'Windows Copilot Integration - com.microsoft.copilot: protocol',
        'Linux Integration - GNOME/KDE desktop integration',
        'Linux Voice (TTS) - espeak with 80+ voices',
        'Linux Notifications - notify-send, kdialog support',
        'Linux Desktop Shortcuts - .desktop file generation',
        'Native Click Alternatives - Platform-specific automation (macOS steve, Windows nut.js/xa11y)',
        'Native OCR Alternatives - uniOCR, RustO! (PaddleOCR) with 99.3% accuracy',
        'Cross-Platform Automation Fallback Chain - nut.js → xa11y → robotjs',
        'Cross-Platform OCR Fallback Chain - uniOCR → RustO! → Platform Native → Tesseract'
      ],
      fix: [
        'Removed Protected Ecosystem footer from PDF generation',
        'Fixed macOS build with ad-hoc signing (--c mac.signingIdentity=-)',
        'Fixed GitHub Actions build error: empty password for code signing'
      ],
      change: [
        'Main.js: 8,290 lines (current), Preload.js: 682 lines',
        'Robot-service.js: 292 lines, Tesseract-service.js: 1,125 lines',
        'Automation index.js: 147 lines',
        'Linux integration.js: 495 lines, Windows integration.js: 385 lines',
        'SiriShortcutsIntegration.js: 260 lines',
        'All platform integrations now have consistent API structure'
      ],
      docs: [
        'Created Apple Integration docs page (/docs/apple-integration)',
        'Created Windows Integration docs page (/docs/windows-integration)',
        'Created Linux Integration docs page (/docs/linux-integration)',
        'Updated search index with all platform integration entries',
        'Updated components page with correct line counts'
      ],
      security: [
        'Updated security contact: preetjgfilj2@gmail.com'
      ]
    }
  },
  {
    version: '0.2.9.1',
    date: '2026-04-17',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Native AI Sidebar V2 - Thuki-inspired SwiftUI floating assistant',
        'Morphing Container - Spotlight-style input bar transforms to full chat',
        'Command Suggestions - /screen, /think, /search, /summarize with real-time filtering',
        'Multi-Provider LLM Integration - Ollama, OpenAI, Anthropic, Gemini',
        'Auto-Start Login Item Integration - Start sidebar at system login',
        'Native Swift Module - N-API bridge for Electron + SwiftUI',
        'Context Quotes - Selected text pre-fills as quoted context',
        'Smart Auto-Scroll - Follows content unless user scrolls up',
        'Typing Indicator - Pulsing dots animation during AI response',
        'Conversation History - Date-grouped organization'
      ],
      fix: [
        'Fixed BrowserView not appearing after app launch - added immediate addBrowserView call',
        'Fixed hasSeenWelcomePage/hasCompletedStartupSetup defaults blocking BrowserView bounds'
      ],
      change: [

        'Modular IPC Handlers: Moved all handlers to src/main/handlers/ modules (14+ modules)',
        'Lazy Service Loading: Services now load on-demand for faster startup',
        'Removed landing page from default startup - app now opens directly to browser',
        'Added Sidebar Version selector to macOS menu (Comet > Sidebar Version)',
        'Added Sidebar Version toggle in settings panel'
      ],
      docs: [
        'Created comprehensive release notes',
        'Added full Apache 2.0 attribution for Thuki',
        'Updated README with Native Sidebar V2 documentation and main.js refactor',
        'Updated AI-GUIDE.md with main.js refactor details',
        'Created ACKNOWLEDGMENTS.md with Thuki license compliance'
      ],
      security: [
        'Thuki is Apache 2.0 licensed - attribution added per Section 4d'
      ]
    }
  },
  {
    version: '0.2.9',
    date: '2026-04-13',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Context-Aware BrowserView Virtualization - Detaches engine when using internal tools to save 40-60% CPU',
        'Professional PDF Orchestration with automated Table of Contents (TOC) and native structural analysis',
        'SecureDOM Reader & In-Page DOM Search - Sanitized page analysis with XSS filtering',
        'Standardized 56px UI Header Architecture for consistent vertical rhythm'
      ],
      fix: [
        'CRITICAL: Fixed "App not working" crash caused by React hook (useEffect) dependency mismatch in Sidebar',
        'Fixed transparent logo visibility in production/packaged builds using nativeImage',
        'Fixed double-header gap between TitleBar and main workspace'
      ],
      change: [
        'Updated landing page "Get Started" flow to integrate with StartupSetupUI',
        'Gated window resize events to improve responsiveness when BrowserView is detached'
      ],
      docs: [
        'Updated AI-GUIDE.md with SecureDOM and In-Page search documentation',
        'Updated Security docs with new Sandbox + Filtering architectural details',
        'Synchronized versioning to v0.2.9 across all platforms'
      ]
    }
  },
  {
    version: '0.2.8.2',
    date: '2026-04-12',
    codename: 'Nebula',
    channel: 'stable',
    changes: {
      new: [
        'Advanced Document Generation Engine with PDF, Excel (XLSX), PowerPoint (PPTX), and Mermaid diagram support',
        'Mermaid to PDF converter with SVG rendering and multi-page PDF export',
        'Custom typing animation hooks (useTypingAnimation, useStreamingParser) with multiple cursor styles',
        'Raycast extension with 6 commands (chat, browse, ocr, pdf, automation, settings)'
      ],
      fix: [
        'Fixed Google Cloud Sync sign-in - added frontend auth-callback listener',
        'Fixed OCR collapsible display using explicit type casting',
        'Fixed thinking indicator to use theme-specific colors from gradient preset',
        'Fixed mobile shell approval deep link handler for QR codes'
      ],
      change: [
        'Updated TypeScript target to ES2020 for better compatibility',
        'Added AI streaming parser hook for smooth message parsing during streaming'
      ],
      docs: [
        'Updated AI-GUIDE.md with complete documentation workflow',
        'Updated all search indexes with new commands and features',
        'Updated version to 0.2.8.2'
      ]
    }
  },
  {
    version: '0.2.8',
    date: '2026-04-08',
    codename: 'Nebula',
    channel: 'alpha',
    changes: {
      new: [
        'Created comprehensive Automation Layer documentation (docs/AUTOMATION.md)',
        'Created Plugin System API documentation (docs/PLUGIN_API.md)',
        'Added Jest test suite with 79 passing tests',
        'Extracted shared types to AIChatSidebar/types.ts for modularization',
        'Created AIChatSidebar/helpers.ts with utility functions'
      ],
      fix: [],
      change: [
        'Updated GitHub Actions to use Node.js 20 LTS for stability',
        'Changed CI/CD to use npm ci for deterministic installs',
        'Added test job dependency before build in CI pipeline',
        'Updated package.json with npm test, npm run test:watch, npm run test:coverage scripts',
        'Updated GitHub Actions action versions to v4',
        'Added proper Linux dependencies (libx11-xcb-dev, libxcb-dri3-dev, etc.)'
      ],
      docs: [
        'Updated ARCHITECTURE.md with references to AUTOMATION.md and PLUGIN_API.md',
        'Updated AI-GUIDE.md last updated date'
      ]
    }
  },
  {
    version: '0.2.7.1',
    date: '2026-04-06',
    codename: 'Stardust',
    channel: 'alpha',
    changes: {
      new: [],
      fix: [
        'Fixed Next.js 16 Turbopack/webpack config conflict - added turbopack: {} to next.config.js',
        'Fixed "Can\'t resolve fs" build errors in user-preferences module',
        'Fixed package.json duplicate optionalDependencies JSON parse error',
        'Fixed TypeScript compilation errors for npm run dev',
        'Added complete plugins API type definitions to electron.d.ts',
        'Fixed PluginSettings.tsx type mapping and callback annotations',
        'Fixed AIChatSidebar.tsx result property access (output → result)',
        'Fixed AIUtils.ts data.title undefined reference',
        'Replaced ES2018 gs regex flags with compatible [\\s\\S]*? pattern'
      ],
      change: [
        'Updated tsconfig.json target from ES2017 to ES2020'
      ],
      docs: [
        'Updated AI-GUIDE.md with TypeScript compilation guide'
      ]
    }
  },
  {
    version: '0.2.7',
    date: '2026-04-05',
    codename: 'Stardust',
    channel: 'alpha',
    changes: {
      new: [
        'Added Components documentation page with overview of all UI components and services',
        'Enhanced SEO with JSON-LD structured data for better AI crawler indexing',
        'Created robots.txt allowing all AI crawlers (GPTBot, ClaudeBot, Gemini, Perplexity)',
        'Added PWA manifest.json for app install capability',
        'Added AI-GUIDE.md for AI code writers'
      ],
      fix: [
        'Fixed document-generation broken link (now points to /docs/ai-commands#pdf)',
        'Fixed Components tab in docs sidebar navigation',
        'Removed macOS-only @next/swc-darwin-arm64 causing Vercel build failure'
      ],
      change: [
        'Updated sitemap.xml with all doc pages for better indexing',
        'Enhanced metadata with OpenGraph, Twitter cards, and canonical URLs',
        'Updated docs layout to use dynamic version from version.ts'
      ],
      docs: [
        'Created comprehensive Components reference page',
        'Updated docs sidebar with Components tab',
        'Added SEO optimization guide in AI-GUIDE.md'
      ]
    }
  },
  {
    version: '0.2.6',
    date: '2026-04-01',
    codename: 'Stardust',
    channel: 'alpha',
    changes: {
      new: [
        'Added Swift UI improvements with THINK UI',
        'Added Liquid Glass Theme for macOS native UI',
        'Added MermaidView for Swift (MermaidJS via WKWebView)',
        'Added macOS menu with direct settings access'
      ],
      fix: [
        'Fixed OCR click JSON parsing with regex fallback',
        'Added robotJS for external app clicking',
        'Fixed AI message rendering on Swift (br, bold, math)',
        'Removed Swift title bar (.windowStyle(.hiddenTitleBar))'
      ],
      docs: [
        'Added cross-app OCR/click documentation in AI guide',
        'Updated AIConstants.ts with cross-app documentation'
      ]
    }
  },
  {
    version: '0.2.5',
    date: '2026-03-29',
    codename: 'Stardust',
    channel: 'stable',
    changes: {
      new: [
        'Initial stable release',
        'Core AI agent with chain-of-thought reasoning',
        'Triple-lock security model',
        'WiFi Sync between desktop and mobile',
        'PDF generation with 5 templates'
      ]
    }
  }
];

export function getLatestRelease(): ReleaseEntry {
  return releases[0];
}

export function getReleaseByVersion(version: string): ReleaseEntry | undefined {
  return releases.find(r => r.version === version);
}