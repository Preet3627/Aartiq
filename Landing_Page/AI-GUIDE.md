# Comet AI - AI Agent Guide

This guide helps AI code writers understand the Comet AI project structure, write proper release notes, maintain documentation, and ensure the landing page and docs stay consistent.

## Project Structure

```
Comet-AI/
├── comet-browser/           # Electron Desktop App (main)
├── flutter_browser_app/      # Flutter Mobile App
├── Landing_Page/             # Next.js Landing Page + Docs (THIS REPO)
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── docs/         # Documentation pages
│   │   │   ├── api/          # API routes
│   │   │   └── llms.txt/     # Dynamic llms.txt generation
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities, constants, data
│   │   └── public/          # Static assets
│   └── public/
│       ├── sitemap.xml       # XML sitemap for SEO
│       ├── robots.txt        # AI crawler permissions
│       ├── llms.txt          # AI-readable index
│       └── .well-known/     # AI plugin manifest
├── presenton/               # FastAPI Backend
└── README.md
```

---

## Version System

### Current Version
- **Version:** `0.2.9.4.3` (Stable)
- **Codename:** Nebula
- **Release Date:** 2026-04-23

### Version Pattern
- Format: `Major.Minor.Patch` (e.g., `0.2.7`)
- Channels: `alpha` → `beta` → `stable`
- Versions defined in: `src/lib/version.ts`

### Files to Update on Version Change
```typescript
// src/lib/version.ts
export const APP_VERSION = {
  version: '0.2.8',      // UPDATE THIS
  codename: 'Nebula',     // Optional codename
  releaseDate: '2026-04-10',
  channel: 'alpha',
};
```

---

## Documentation Structure

### All Docs Pages (`/docs/*`)

| Page | Path | Description | When to Update |
|------|------|-------------|----------------|
| Getting Started | `/docs/getting-started` | Installation, setup, AI providers | New platform support |
| Overview | `/docs/overview` | Features, architecture, tech stack | Major features |
| Components | `/docs/components` | UI components, services | New components |
| Changelog | `/docs/changelog` | Release notes | Every release |
| Cloud Sync | `/docs/cloud-sync` | WiFi P2P, E2EE sync, mobile | Sync changes |
| AI Commands | `/docs/ai-commands` | All JSON commands for AI | New/modified commands |
| Security | `/docs/security` | Triple-lock security model | Security changes |
| Automation | `/docs/automation` | Background scheduling, cron | New automation features |
| Native API | `/docs/native-api` | macOS SwiftUI panels, IPC | New APIs |
| Apple Integration | `/docs/apple-integration` | Siri, Shortcuts, Voice, Raycast | macOS integration |
| Windows Integration | `/docs/windows-integration` | Shortcuts, Voice, Copilot | Windows integration |
| Deep Links | `/docs/deep-links` | URL schemes (`comet-browser://`) | New protocols |
| Plugins | `/docs/plugins` | Plugin system, SDK, hooks | Plugin changes |
| Extensions | `/docs/extensions` | Browser extensions | Extension features |
| API Reference | `/docs/api-reference` | Full IPC/API documentation | Any API changes |
| Troubleshooting | `/docs/troubleshooting` | Common issues, solutions | New issues found |
| Contributing | `/docs/contributing` | Development guide, standards | Dev process changes |
| Comet CLI | `/docs/native-api#cli` | Terminal-based browser control | CLI feature changes |

---

## Landing Page Structure

### Key Pages

| Page | Path | Purpose |
|------|------|---------|
| Home | `/` | Landing page with features, download |
| Downloads | `/downloads` | All platform downloads |
| Auth | `/auth` | Firebase authentication |
| Docs | `/docs` | Documentation hub |

### Components Location
```
src/components/
├── docs/
│   └── SearchModal.tsx      # Docs search modal
├── layout/
│   └── ...                 # Layout components
└── ui/
    └── ...                 # Shared UI components
```

---

## AI Commands Reference

### Command Format
Comet AI uses structured JSON commands. Always respond with JSON format:

```json
{
  "command": "COMMAND_NAME",
  "params": {
    "key": "value"
  }
}
```

### All Supported Commands

| Command | Category | Description |
|---------|----------|-------------|
| `NAVIGATE` | Navigation | Go to URL |
| `SEARCH` | Navigation | Web search |
| `WEB_SEARCH` | Navigation | Real-time search with RAG |
| `RELOAD` | Navigation | Refresh page |
| `GO_BACK` | Navigation | Back in history |
| `GO_FORWARD` | Navigation | Forward in history |
| `READ_PAGE_CONTENT` | Browser | Extract page text |
| `LIST_OPEN_TABS` | Browser | Get open tabs |
| `CLICK_ELEMENT` | Browser | Click on page element |
| `FIND_AND_CLICK` | Browser | Find text and click |
| `FILL_FORM` | Browser | Fill form fields |
| `CREATE_PDF_JSON` | PDF | Generate PDF document |
| `CREATE_FILE_JSON` | PDF | Create file |
| `SHELL_COMMAND` | Shell | Execute terminal command |
| `SET_VOLUME` | System | Set system volume |
| `SET_BRIGHTNESS` | System | Set display brightness |
| `OPEN_APP` | System | Launch application |
| `OCR_SCREEN` | OCR | Screen recognition |
| `OCR_COORDINATES` | OCR | Get element coordinates |
| `CLICK_APP_ELEMENT` | OCR | Click in external app |
| `SCHEDULE_TASK` | Scheduling | Schedule automation task |
| `LIST_AUTOMATIONS` | Automation | List scheduled tasks |
| `DELETE_AUTOMATION` | Automation | Remove scheduled task |
| `THINK` | Meta | Chain-of-thought reasoning |
| `PLAN` | Meta | Plan execution steps |
| `PLUGIN_COMMAND` | Integration | Execute plugin command |

---

### Triple-Lock Architecture

1. **Visual Sandbox & SecureDOM** - AI uses `OCR_SCREEN` for external apps and a dedicated **SecureDOM Reader** (`READ_PAGE_CONTENT`) for internal pages. Raw HTML is filtered via a PII-stripping sanitization layer before reaching the agent.
2. **In-Page DOM Search** - AI can perform targeted `SEARCH_DOM` queries to find specific text without loading the entire page into context, minimizing token usage and security exposure.
3. **Syntactic Firewall** - Pattern analysis blocks dangerous shell commands and prompt injection attempts.
4. **Human-in-the-Loop** - User approval required for critical actions (Shell, Native Clicks).

### Risk Levels

| Level | Approval | Examples |
|-------|----------|----------|
| Low | Instant | Navigation, screenshots |
| Medium | Shift+Tab | Clicking, form filling |
| High | QR Code | Shell commands, external app clicks |

### When to Update Security Docs

- New permission types added
- New risk levels or approval workflows
- Changes to encryption or authentication
- New blocked patterns in firewall

---

## LLM/AI Crawlability

### Files for AI Crawlers

| File | Location | Purpose |
|------|----------|---------|
| `llms.txt` | `/public/llms.txt` | Plain text index for LLMs |
| `sitemap.xml` | `/public/sitemap.xml` | XML sitemap for search engines |
| `robots.txt` | `/public/robots.txt` | AI crawler permissions |
| `ai-plugin.json` | `/public/.well-known/` | AI plugin manifest |

### Dynamic Routes
- `/llms.txt` - Generated at `src/app/llms.txt/route.ts`
- `/api/search` - Search API at `src/app/api/search/route.ts`

### Update When
- New doc pages added → Update sitemap.xml, llms.txt
- New features → Update llms.txt content
- New AI commands → Update both llms.txt and search-index.ts

---

## Keyboard Shortcuts

### Docs Search
| Shortcut | Action |
|----------|--------|
| `⌘K` (Mac) / `Ctrl+K` (Windows) | Open search |
| `Esc` | Close search modal |
| `↑` / `↓` | Navigate results |
| `Enter` | Select result |

### Docs Navigation
| Shortcut | Action |
|----------|--------|
| Mobile hamburger | Open sidebar |
| Sidebar links | Navigate to doc pages |

---

## Search Index

### Location
`src/lib/search-index.ts`

### Structure
```typescript
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  content: string;        // Keywords for search
  url: string;            // Full URL path
  section?: string;       // Section name
  keywords: string[];    // Search keywords
  type: "page" | "section" | "command" | "api" | "guide";
}
```

### When to Update Search Index

1. **New doc page** → Add full SearchResult entry
2. **New section** → Add section entry with type: "section"
3. **New AI command** → Add command entry with type: "command"
4. **New API** → Add API entry with type: "api"
5. **Feature change** → Update relevant entry's content/keywords

### Example Search Entry for New Command
```typescript
{
  id: "ai-command-example",
  title: "EXAMPLE_COMMAND",
  description: "Description of what it does",
  content: "command keywords for search",
  url: "/docs/ai-commands#category",
  section: "Category Name",
  keywords: ["keyword1", "keyword2", "keyword3"],
  type: "command"
}
```

---

## Release Notes Format

### Location
`src/lib/release-notes.ts`

### Structure
```typescript
export interface ReleaseEntry {
  version: string;
  date: string;
  codename: string;
  channel: 'alpha' | 'beta' | 'stable';
  changes: {
    new?: string[];        // New features
    fix?: string[];        // Bug fixes
    change?: string[];     // Changes/modifications
    docs?: string[];        // Documentation updates
    security?: string[];    // Security patches
  };
}
```

### Example Release Entry
```typescript
{
  version: '0.2.8',
  date: '2026-04-10',
  codename: 'Nebula',
  channel: 'alpha',
  changes: {
    new: [
      'Added new AI command EXAMPLE_COMMAND',
      'Implemented new security feature',
    ],
    fix: [
      'Fixed issue with search functionality',
    ],
    change: [
      'Updated search index structure',
    ],
    docs: [
      'Added documentation for new command',
      'Updated keyboard shortcuts guide',
    ]
  }
}
```

---

## Release Checklist

When preparing a new release, ensure all these are updated:

### 1. Version Update
- [ ] Update `src/lib/version.ts` with new version number
- [ ] Add entry to `src/lib/release-notes.ts`

### 2. Documentation
- [ ] Update relevant doc pages in `/docs/`
- [ ] Add new doc pages if needed
- [ ] Update sidebar navigation in `layout.tsx`

### 3. Search Index
- [ ] Add new entries to `src/lib/search-index.ts`
- [ ] Update keywords for changed features
- [ ] Add new command/API entries

### 4. AI Crawlability
- [ ] Update `public/sitemap.xml` with new pages
- [ ] Update `public/llms.txt` with new features
- [ ] Update `src/app/llms.txt/route.ts` if needed

### 5. Build & Test
- [ ] Run `npm run build` to verify no errors
- [ ] Test search functionality
- [ ] Verify all links work

### 6. GitHub
- [ ] Create git tag: `git tag v{x.y.z}`
- [ ] Push: `git push origin v{x.y.z}`
- [ ] Create GitHub release with notes

---

## Common Patterns

### Adding New Doc Page

1. Create file: `src/app/docs/{name}/page.tsx`
2. Add to sidebar: Update `navigation` array in `layout.tsx`
3. Add to search: Add entry in `search-index.ts`
4. Add to sitemap: Update `public/sitemap.xml`
5. Add to llms.txt: Update both file and route

### Adding New AI Command

1. Add to `comet-browser/src/components/AIConstants.ts`
2. Add handler in `comet-browser/src/lib/AICommandParser.ts`
3. Document in `src/app/docs/ai-commands/page.tsx`
4. Add to search index with type: "command"
5. Add to llms.txt documentation

### Adding New API/Feature

1. Implement in `comet-browser/`
2. Document in relevant doc page
3. Add to `src/app/docs/api-reference/page.tsx`
4. Update search index
5. Update llms.txt

### Adding New IPC Handler (User Preferences Pattern)

When adding new features that need server-side storage:

1. **Add IPC handler in main.js**: Use `ipcMain.handle('feature:action', async (event, data) => {...})`
2. **Add preload API in preload.js**: Expose via `contextBridge.exposeInMainWorld('electronAPI', {...})`
3. **Add TypeScript types in electron.d.ts**: Add to the `electronAPI` interface
4. **Add client API in lib/**: Create a client-side module that calls `window.electronAPI`
5. **Avoid Node.js in renderer**: Never import `fs`, `electron-store`, or similar in `.ts` files used by renderer

**Why?** Next.js 16+ with Turbopack cannot bundle Node.js modules. Use IPC to main process instead.

---

## Component Automation

### Auto-Updating Component Line Counts

We use a script to automatically scan and update component metadata in the documentation.

#### Location
`comet-browser/scripts/component-scanner.js`

#### Usage
```bash
# Scan and output JSON
cd comet-browser
node scripts/component-scanner.js

# Preview changes (dry run)
node scripts/component-scanner.js --dry

# Update component-data.json
node scripts/component-scanner.js --update
```

#### Features
- **Auto-detects tags**: React, Node.js, Swift, macOS, Windows, Linux, AI, Security, etc.
- **Line counting**: Automatically counts lines in all source files
- **Description extraction**: Reads JSDoc comments or guesses from filename
- **Categories**: Groups by directory (components, core, automation, service, lib)

#### Output
The script generates `component-data.json` with:
```json
{
  "generated": "2026-04-08T12:00:00.000Z",
  "version": "0.2.8",
  "components": [
    {
      "name": "AIChatSidebar.tsx",
      "path": "AIChatSidebar.tsx",
      "lines": 4419,
      "description": "Main chat interface with real-time streaming",
      "tags": ["React", "AI", "Core"],
      "lastModified": "2026-04-08"
    }
  ],
  "summary": {
    "total": 179,
    "totalLines": 45000
  }
}
```

#### Adding New Components to Documentation

1. **Create the component** in `comet-browser/src/components/`
2. **Add JSDoc description** (optional but recommended):
   ```javascript
   /**
    * @description Brief description of what this component does
    */
   export default function MyComponent() { }
   ```
3. **Run the scanner** to update line counts:
   ```bash
   node scripts/component-scanner.js --update
   ```
4. **Manually add** to `docs/components/page.tsx` if not auto-included

#### For AI Agents (LLMs)

When asked to document new components or update the component list:

1. **Run the scanner first**: `node scripts/component-scanner.js --dry`
2. **Identify new/changed files** from the output
3. **Update components/page.tsx** with accurate line counts
4. **Use the generated tags** for proper categorization
5. **Verify** with `npm run build`

---

## Code Standards

### File Naming
- Components: PascalCase (`SearchModal.tsx`)
- Pages: kebab-case (`getting-started/page.tsx`)
- Utilities: camelCase (`searchIndex.ts`)

### Component Structure
```typescript
// Use client directive for interactive components
"use client";

import { useState, useEffect } from "react";
// ... imports

export default function PageName() {
  // ... component logic
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Styling
- Use Tailwind CSS classes
- Follow existing color scheme (sky, purple, amber accents)
- Use `font-outfit` class for text

---

## Quick Reference

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/version.ts` | Version info |
| `src/lib/release-notes.ts` | Release history |
| `src/lib/search-index.ts` | Search data |
| `src/app/docs/layout.tsx` | Docs layout & sidebar |
| `src/app/layout.tsx` | Root layout & SEO |
| `src/components/docs/SearchModal.tsx` | Search UI |

### Important URLs
- Website: https://browser.ponsrischool.in
- Docs: https://browser.ponsrischool.in/docs
- GitHub: https://github.com/Preet3627/Comet-AI
- Releases: https://github.com/Preet3627/Comet-AI/releases

---

## App Stability Fixes (2026-04-13)

### React Hook Mismatch
- **Issue:** The app would crash on `npm run dev` with "The final argument passed to useEffect changed size between renders".
- **Fix:** Purged the `idle-minimization` state dependencies and stabilized the `useEffect` hooks in `AIChatSidebar.tsx` and `ClientOnlyPage.tsx`.

### Transperent Logo Correction
- **Issue:** Packaged/Production builds showed a white background behind the logo instead of transparency.
- **Fix:** Updated `main.js` to correctly initialize the app icon using `nativeImage` from the correct asset path.

---

*Last Updated: 2026-04-13*
*For AI code writers - maintain consistency and update all related files*
