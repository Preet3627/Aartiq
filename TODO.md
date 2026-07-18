# Aartiq UX & Product Polish Checklist (Production Readiness)

> **Rule**: After completing each todo, commit changes to git before starting the next one.

---

## 1. AI Experience

- [x] Make AI feel like an OS instead of a chatbot
- [x] Replace chat bubbles with planning/progress/completion states
- [x] Show: `Planning task... → ✓ Understanding → ✓ Searching → ✓ Reading → ✓ Generating → Waiting for approval → Executing → Completed`
- [x] User should always know: What AI is doing, Why, What happens next

---

## 2. Action Chain

- [x] Replace static `Running...` with Workflow UI
- [x] Each step shows: icon, progress, execution time, expandable logs
- [x] Example:
  ```
  ✓ Search Web        1.8s    3 websites searched    Expand ▼
  ```

---

## 3. Planning Screen

- [x] Show execution plan before AI starts
- [x] Display: estimated browser actions, shell commands, permission requests, time
- [x] Increases trust immediately

---

## 4. Compress Finished Tasks

- [x] Completed actions collapse automatically
- [x] Only active task stays expanded
- [x] Example:
  ```
  ✓ Search
  ✓ PDF Generated
  ✓ Authentication
  ▼ Expand Details
  ```

---

## 5. Better Action Cards

- [x] Visual cards instead of plain text
- [x] Show structured info: device, OS, version, timing
- [x] Example:
  ```
  MacBook Pro | macOS 15 | Version 0.3.3 | Completed in 0.4s
  ```

---

## 6. Live Terminal

- [x] Show executed commands with success/fail status
- [x] Instead of dumping raw terminal output
- [x] Example:
  ```
  mkdir Downloads/Images  ✓ Success
  mv file.pdf PDFs        ✓ Success
  ```

---

## 7. Permission Dialog

- [x] Enhanced dialog with: action, risk level, reason, affected files/folders
- [x] Example:
  ```
  Action: Move 24 files
  Risk: Medium
  Reason: Organizing Downloads
  Touches: Downloads only
  Creates: Images, PDFs, Documents
  ```

---

## 8. Batch Permissions

- [x] Group multiple commands with individual checkboxes
- [x] Granular approve/deny per command
- [x] Example:
  ```
  AI wants to execute 4 Commands
  ☑ mkdir
  ☑ mv
  ☑ cp
  ☐ rm
  Approve Selected
  ```

---

## 9. High Risk Actions

- [x] Dramatic warning UI for destructive/irreversible actions
- [x] Require Touch ID for delete operations
- [x] Example:
  ```
  ⚠ Dangerous Action
  Delete 48 files
  Location: Downloads
  This cannot be undone.
  Touch ID Required.
  ```

---

## 10. Low Risk Automation

- [x] Auto-approve low-risk actions without asking
- [x] Categories: browser navigation, reading pages, scrolling, searching

---

## 11. Medium Risk

- [x] Require approval for: clicks, forms, downloads, clipboard, launch apps

---

## 12. High Risk Always

- [x] Touch ID + manual approval for high-risk actions, no exceptions

---

## 13. Action Timeline

- [x] Timestamped vertical timeline instead of chat log
- [x] Example:
  ```
  9:41  Planning
  9:41  Searching
  9:42  PDF Generated
  9:42  Permission Requested
  9:43  Touch ID
  9:43  Done
  ```

---

## 14. Native Notifications

- [ ] Use OS notifications for completions
- [ ] Include Open/Reveal/Dismiss actions
- [ ] Example: `PDF Generated — Open | Reveal | Dismiss`

---

## 15. Downloads

- [ ] Show download card after file generation
- [ ] Include Reveal/Open/Share actions
- [ ] Example: `Capability Report — Downloads — Reveal | Open | Share`

---

## 16. Browser Overlay

- [ ] Show overlay instead of popup blocking UI
- [ ] Example: `Waiting for Permission — AI paused — Approve to continue`

---

## 17. Agent State

- [x] Always-visible tiny state indicator
- [x] States: Idle, Thinking, Searching, Waiting, Executing, Finished, Paused

---

## 18. Abort Experience

- [ ] Replace simple red button with options:
  - Stop after current step
  - Cancel immediately
  - Rollback possible changes

---

## 19. Better JSON View

- [x] Add tabs: Visual / JSON / Terminal
- [x] Developer-oriented output options

---

## 20. Explain Every Action

- [x] Each action card answers: Why, Risk level, Permission requirement
- [x] Example:
  ```
  Opening Browser
  Reason: Need browser context
  Risk: Low
  Permission: Automatic
  ```

---

## 21. Undo

- [ ] Show undo option after file operations
- [ ] Restore original locations
- [ ] Example: `Organized Downloads — Undo | Restore Original Locations`

---

## 22. Session Summary

- [ ] Post-task summary with:
  - Action count
  - Websites visited
  - Shell commands executed
  - Auth required
  - Failures
  - Total duration
- [ ] Example:
  ```
  Completed: 12 actions, 3 websites, 2 shell commands,
  1 Touch ID, 0 failures, 12 seconds
  ```

---

## 23. Better Empty State

- [x] Show suggested actions instead of blank chat
- [x] Examples: Organize Downloads, Generate PDF, Research AI, Summarize page, Open VS Code, Find duplicates

---

## 24. AI Workspace

- [ ] Dockable panels: Browser, Action Chain, Terminal, Documents, Media, Logs

---

## 25. Browser Integration

- [ ] Live overlays showing clicks, fills, reading, extracting
- [ ] Visual highlights on page elements

---

## 26. Web Search

- [ ] Show step-by-step progress:
  - Searching Google
  - Reading Result 1
  - Reading Result 2
  - Comparing Sources
  - Generating Summary

---

## 27. OCR

- [ ] Visual overlay: Scanning Screen → text regions detected → OCR Complete

---

## 28. PDF Generation

- [ ] Progress stages: Preparing Markdown → Rendering → Embedding Images → Generating PDF → Saving

---

## 29. Authentication

- [ ] After Touch ID, show `Identity Verified, Proceeding...` with tiny animation

---

## 30. Security Dashboard

- [ ] Display: Security Score (95/100), Approvals Today, Touch ID count, Blocked Commands, Last Dangerous Action

---

## 31. Permission History

- [ ] Searchable log of allowed/denied actions grouped by day
- [ ] Example:
  ```
  Yesterday
  ✓ Allowed — Generate PDF
  ✗ Denied — Delete Files
  ✓ Allowed — Open VSCode
  ```

---

## 32. Neural Vault

- [ ] Prominent UI for passwords, API keys, tokens
- [ ] Protected by Touch ID
- [ ] Feels like 1Password

---

## 33. Animations

- [ ] Smooth progress indicators
- [ ] Expanding cards
- [ ] Fade transitions
- [ ] Completion animations (subtle)

---

## 34. Icons

- [ ] Standardize icon language across all UI
- [ ] Consistent: outlined, filled, gradients

---

## 35. Sidebar

- [ ] Allow: resize, pin, pop out, floating mode

---

## 36. Themes

- [ ] Add: OLED Black, Light, Purple, Nord, Dracula, Custom Accent

---

## 37. Performance

- [ ] Virtualized chat for long sessions
- [ ] Lazy rendering
- [ ] Memory cleanup

---

## 38. Keyboard Shortcuts

- [x] `⌘K` — Command Center
- [x] `⌘L` — AI Prompt
- [x] `⌘⇧A` — Autonomous Mode
- [x] `Esc` — Abort
- [x] `⌘/` — Focus AI

---

## 39. AI Personality

- [ ] Friendly conversational tone instead of robotic messages
- [ ] Example: `Planning your request...` instead of `Executing...`

---

## 40. First Launch Onboarding

- [ ] Welcome wizard: Choose AI → Enable Touch ID → Import Bookmarks → Choose Theme → Done

---

## 41. Developer Mode

- [ ] Toggleable panel with: Action Chain, JSON, Logs, HTTP, DOM, Terminal, IPC, Permissions, Performance

---

## 42. Multi-Agent Future

- [ ] Prepare UI for: Research Agent, Browser Agent, Coding Agent, Document Agent, System Agent
- [ ] Support simultaneous execution

---

## 43. Command Palette

- [x] Searchable command palette (`⌘K`) for all actions and settings
- [x] Example: `> Generate PDF | Open Downloads | Toggle AI | Change Theme | Permission Settings`

---

## 44. AI Memory

- [ ] Show remembered context: preferred search engine, theme, permission settings

---

## 45. Mobile Companion

- [ ] Mirror desktop task progress to mobile
- [ ] Remote approval of actions
- [ ] Show: Current Task, Approval Request, Progress, Notifications

---

## 46. Visual Branding

- [ ] Consistent accent gradient
- [ ] Standardize corner radius across dialogs, cards, buttons
- [ ] Recognizable AI element identity (glow, iconography, motion)

---

## 47. Trust & Explainability

- [x] Every autonomous action answers five questions:
  1. **What** is about to happen?
  2. **Why** is it necessary?
  3. **What data** will be accessed?
  4. **What permissions** are required?
  5. **Can it be undone?**

---

## Priority Summary

| Priority | Count | Items |
|----------|-------|-------|
| High | 14 | #1, #2, #3, #7, #8, #9, #12, #17, #20, #21, #37, #38, #43, #47 |
| Medium | 18 | #4, #5, #6, #10, #11, #13, #14, #15, #16, #18, #22, #23, #26, #28, #30, #32, #33, #34, #36, #40, #46 |
| Low | 15 | #19, #24, #25, #27, #29, #31, #35, #39, #41, #42, #44, #45 |

---

*Last updated: 2026-07-18*
