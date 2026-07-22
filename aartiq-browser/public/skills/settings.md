---
name: settings
description: Use this skill when the user wants to change Aartiq settings, configure preferences, adjust search behavior, or customize any aspect of the app. Activate when the user says "change settings", "update preferences", "configure", "adjust", or similar.
license: Proprietary
---

## Settings Management Workflow

### Permission Gating (MANDATORY)
ALL settings changes MUST go through the user approval flow. NEVER skip this step.

**Step 1:** Use [SETTINGS_QUERY] to read current settings for the relevant category.
**Step 2:** Present the user with a clear summary of WHAT will change and WHY.
**Step 3:** Use [SETTINGS_UPDATE] with the changes. The system will show a confirmation dialog.
**Step 4:** Report back whether the changes were approved or denied.

### Available Settings Categories

#### Web Search Settings (`webSearch`)
Control how AI web search behaves:
- `maxPages` (number, default 10): Max websites to scrape from search results. Can be increased up to 20 if user requests.
- `maxCharsPerResult` (number, default 6000): Max characters extracted per page.
- `totalBudget` (number, default 30000): Total character budget across ALL search results. Prevents context overflow.
- `defaultDepth` ("summary" | "full" | "auto", default "auto"): How much content to extract per page.
  - `summary`: ~1000 chars, quick overview
  - `full`: Up to maxCharsPerResult, complete extraction
  - `auto`: Relevance-based paragraph selection (best for research)
- `autoSummarize` (boolean, default false): Pre-summarize content before returning.
- `deduplicateContent` (boolean, default true): Remove duplicate sentences.
- `enableQueryRelevance` (boolean, default true): Score paragraphs by query relevance.
- `searchEngine` ("duckduckgo" | "google", default "duckduckgo"): Default search engine.

#### AI Settings (`ai`)
Control AI behavior:
- `maxTokens` (number, default 8192): Max tokens for AI responses.
- `temperature` (number, default 0.7): AI creativity level.
- `autoApproveLowRisk` (boolean, default false): Auto-approve low-risk actions.

#### UI Settings (`ui`)
Control interface:
- `theme` (string, default "dark"): App theme.
- `compactMode` (boolean, default false): Compact UI mode.

### Examples

**User: "Search 15 websites for AI news"**
→ Use [SETTINGS_QUERY] to check current maxPages
→ Explain: "I'll increase maxPages from 10 to 15 for this search."
→ Use [SETTINGS_UPDATE: category="webSearch", updates={"maxPages": 15}]
→ After approval, use [WEB_SEARCH: AI news | pages=15]

**User: "I want deeper search results"**
→ Explain: "I'll set depth to 'full' so each page extracts up to 6000 chars."
→ Use [SETTINGS_UPDATE: category="webSearch", updates={"defaultDepth": "full"}]

**User: "Change the search engine to Google"**
→ Explain: "I'll switch the default search engine from DuckDuckGo to Google."
→ Use [SETTINGS_UPDATE: category="webSearch", updates={"searchEngine": "google"}]

**User: "Show me current search settings"**
→ Use [SETTINGS_QUERY: category="webSearch"]
→ Present the results clearly

### Anti-Hallucination Rules
- NEVER change settings without showing the user what will change
- NEVER set maxPages above 20 without explicit user confirmation (explain performance impact)
- NEVER change security-related settings (autoApproveLowRisk) without strong justification
- ALWAYS use [SETTINGS_QUERY] before making changes to show current vs proposed values
- If a setting change would affect performance, warn the user (e.g., "Searching 15 pages takes longer than 3")

### Context Memory
- Settings persist across sessions (stored in electron-store)
- Changes take effect immediately for subsequent commands
- Use [SETTINGS_QUERY] to verify changes were applied
