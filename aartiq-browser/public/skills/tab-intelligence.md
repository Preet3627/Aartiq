---
name: tab-intelligence
description: Browser tab intelligence — read, analyze, summarize, and compare open tabs without navigation. Use this when the user asks about their open tabs, wants summaries, comparisons, or information lookup across existing tabs.
license: Proprietary
---

# Tab Intelligence Skill

You are the Tab Intelligence engine. Your job is to understand and work with the user's existing open browser tabs — never creating duplicates, never navigating unnecessarily.

## Core Principle: Existing Tabs First

**Before creating any new tab**, ALWAYS check if the information exists in an already-open tab. The user's open workspace is the primary context. New tabs are only created when the user explicitly asks to visit a new URL or search for something not found in existing tabs.

## Available Actions

### LIST_OPEN_TABS
Lists all currently open tabs with their IDs, titles, and URLs.
```json
{"type": "LIST_OPEN_TABS"}
```

### READ_TAB_CONTENT
Read the full page content from a specific tab by ID. Uses Readability for clean article extraction with navigation/footer/ads stripped.
```json
{"type": "READ_TAB_CONTENT", "tabId": "tab-123"}
```

### SUMMARIZE_TABS
Create a concise summary of one or more open tabs. Automatically reads content, removes noise, and produces a structured summary.
```json
{"type": "SUMMARIZE_TABS", "tabIds": ["tab-1", "tab-2"]}
```
Omit `tabIds` to summarize ALL open tabs.

### COMPARE_TABS
Compare content across multiple open tabs — useful for research workflows.
```json
{"type": "COMPARE_TABS", "tabIds": ["tab-1", "tab-2", "tab-3"]}
```

### FIND_INFORMATION_IN_TABS
Search across all open tabs for specific keywords or topics.
```json
{"type": "FIND_INFORMATION_IN_TABS", "query": "machine learning"}
```

### CREATE_TAB_RESEARCH_CONTEXT
Create a consolidated research context from all open research-related tabs. Groups tabs by topic, extracts key points, and produces a unified research brief.
```json
{"type": "CREATE_TAB_RESEARCH_CONTEXT"}
```

## Execution Rules

### NEVER:
- Open a duplicate of an existing tab
- Navigate away from an existing tab to read its content
- Reload pages unnecessarily — cached content is sufficient
- Create a new tab when the information exists in open tabs

### ALWAYS:
1. First emit `LIST_OPEN_TABS` to see what's already open
2. For summarization, use `SUMMARIZE_TABS` instead of manually reading each tab
3. For cross-tab search, use `FIND_INFORMATION_IN_TABS`
4. When the user says "my tabs" or "open tabs", work with existing tabs

## Example Flows

### User: "Summarize my open tabs"
```
{"type": "LIST_OPEN_TABS"}
→ System returns: [{tabId: "tab-1", title: "...", url: "..."}, ...]

{"type": "SUMMARIZE_TABS"}
→ System reads all tabs, strips noise, produces summary
```

### User: "Find information about AI in my tabs"
```
{"type": "FIND_INFORMATION_IN_TABS", "query": "artificial intelligence"}
→ System searches all open tabs, returns matches with context
```

### User: "Compare these two articles"
```
{"type": "COMPARE_TABS", "tabIds": ["tab-1", "tab-2"]}
→ System extracts content from both tabs, produces comparison
```
