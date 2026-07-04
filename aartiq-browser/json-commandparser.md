# JSON Command Parser - Aartiq Browser

This document describes the JSON command formats used by Aartiq Browser for various actions.

## Table of Contents
1. [Action Tags](#action-tags)
2. [PDF Commands](#pdf-commands)
3. [Shell Commands](#shell-commands)
4. [Command Categories](#command-categories)

---

## Action Tags

Action tags are used to trigger specific browser or system actions.

### Format
```json
{
  "type": "ACTION_TAG",
  "action": "ACTION_NAME",
  "value": "action_value"
}
```

### Available Actions

#### Navigation
| Action | Description | Example |
|--------|-------------|---------|
| `NAVIGATE` | Navigate to a URL | `[NAVIGATE: https://example.com]` |
| `SEARCH` | Search on current page | `[SEARCH: query]` |
| `WEB_SEARCH` | Web search | `[WEB_SEARCH: query]` |
| `RELOAD` | Reload current page | `[RELOAD]` |
| `GO_BACK` | Navigate back | `[GO_BACK]` |
| `GO_FORWARD` | Navigate forward | `[GO_FORWARD]` |

#### Browser Automation
| Action | Description | Example |
|--------|-------------|---------|
| `READ_PAGE_CONTENT` | Extract page text | `[READ_PAGE_CONTENT]` |
| `SCREENSHOT_ANALYZE` | Take and analyze screenshot | `[SCREENSHOT_ANALYZE]` |
| `EXTRACT_DATA` | Extract data using selector | `[EXTRACT_DATA: .classname]` |
| `SCROLL_TO` | Scroll to element | `[SCROLL_TO: selector]` |
| `FIND_AND_CLICK` | Find and click element | `[FIND_AND_CLICK: button text]` |
| `CLICK_ELEMENT` | Click by selector | `[CLICK_ELEMENT: #submit]` |
| `FILL_FORM` | Fill form field | `[FILL_FORM: #email | test@example.com]` |
| `CREATE_NEW_TAB_GROUP` | Create tab group | `[CREATE_NEW_TAB_GROUP: Work | url1,url2]` |

#### System Control
| Action | Description | Example |
|--------|-------------|---------|
| `SHELL_COMMAND` | Execute terminal command | `[SHELL_COMMAND: ls -la]` |
| `OPEN_APP` | Open application | `[OPEN_APP: Calculator]` |
| `SET_VOLUME` | Set system volume | `[SET_VOLUME: 50]` |
| `SET_BRIGHTNESS` | Set screen brightness | `[SET_BRIGHTNESS: 80]` |
| `SET_THEME` | Set theme | `[SET_THEME: dark]` |

#### Media
| Action | Description | Example |
|--------|-------------|---------|
| `SHOW_IMAGE` | Display image | `[SHOW_IMAGE: url | caption]` |
| `SHOW_VIDEO` | Display video | `[SHOW_VIDEO: url | title]` |
| `OPEN_PDF` | Open PDF file | `[OPEN_PDF: /path/to/file.pdf]` |
| `GENERATE_PDF` | Generate PDF | `[GENERATE_PDF: Title | content...]` |
| `GENERATE_DIAGRAM` | Generate Mermaid diagram | `[GENERATE_DIAGRAM: graph TD; A-->B;]` |

#### Utility
| Action | Description | Example |
|--------|-------------|---------|
| `WAIT` | Wait for duration | `[WAIT: 2000]` |
| `OPEN_VIEW` | Switch view | `[OPEN_VIEW: workspace]` |
| `OPEN_MCP_SETTINGS` | Open MCP settings | `[OPEN_MCP_SETTINGS]` |
| `EXPLAIN_CAPABILITIES` | Show capabilities | `[EXPLAIN_CAPABILITIES]` |

#### Gmail
| Action | Description | Example |
|--------|-------------|---------|
| `GMAIL_AUTHORIZE` | Authorize Gmail | `[GMAIL_AUTHORIZE]` |
| `GMAIL_LIST_MESSAGES` | List messages | `[GMAIL_LIST_MESSAGES: 10]` |
| `GMAIL_GET_MESSAGE` | Get message | `[GMAIL_GET_MESSAGE: message_id]` |
| `GMAIL_SEND_MESSAGE` | Send email | `[GMAIL_SEND_MESSAGE: to | subject | body]` |

#### Meta
| Action | Description | Example |
|--------|-------------|---------|
| `THINK` | Show reasoning | `[THINK: reasoning text]` |
| `PLAN` | Show plan | `[PLAN: step1, step2]` |

---

## PDF Commands

### Format
```json
{
  "type": "PDF",
  "title": "Document Title",
  "subtitle": "Optional Subtitle",
  "author": "Author Name",
  "content": "PDF content here..."
}
```

### Extended Options
```json
{
  "type": "PDF",
  "title": "Report",
  "subtitle": "Q4 2024",
  "author": "Aartiq",
  "filename": "report.pdf",
  "screenshot": true,
  "attachments": ["file1.pdf"],
  "liveData": {
    "enabled": true,
    "query": "latest news"
  },
  "content": "Main content..."
}
```

---

## Shell Commands

### Format
```json
{
  "type": "SHELL_COMMAND",
  "command": "ls -la"
}
```

### Safe Commands (Whitelisted)
These commands are remembered after first approval:

| Command | Description |
|---------|-------------|
| `ls`, `ls -la`, `ls -l` | List directory contents |
| `cat`, `head`, `tail` | View file contents |
| `cp`, `cp -r` | Copy files |
| `mv` | Move/rename files |
| `mkdir`, `mkdir -p` | Create directories |
| `touch` | Create empty files |
| `find`, `grep` | Search files |
| `tar`, `zip`, `unzip` | Archive operations |
| `git` | Version control |
| `npm`, `node`, `python` | Development tools |
| `curl`, `wget` | Download files |
| `open` | Open with default app |

### Risk Levels
- **Safe**: Read operations (ls, cat, grep), file creation (mkdir, touch)
- **Medium**: Network access (curl, wget), permissions (chmod)
- **High**: Delete operations (rm), system changes
- **Critical**: Recursive deletes (rm -rf), disk formatting

---

## Command Categories

| Category | Actions |
|----------|---------|
| `navigation` | NAVIGATE, SEARCH, WEB_SEARCH, RELOAD, GO_BACK, GO_FORWARD |
| `browser` | READ_PAGE_CONTENT, SCREENSHOT_ANALYZE, EXTRACT_DATA, SCROLL_TO |
| `automation` | FIND_AND_CLICK, CLICK_ELEMENT, FILL_FORM, CREATE_NEW_TAB_GROUP |
| `system` | SHELL_COMMAND, OPEN_APP, SET_VOLUME, SET_BRIGHTNESS, SET_THEME |
| `media` | SHOW_IMAGE, SHOW_VIDEO, OPEN_PDF, GENERATE_PDF, GENERATE_DIAGRAM |
| `utility` | WAIT, OPEN_VIEW, OPEN_MCP_SETTINGS, EXPLAIN_CAPABILITIES |
| `gmail` | GMAIL_* (all Gmail actions) |
| `meta` | THINK, PLAN, EXPLAINCAPABILITIES |

---

## Permission Levels

| Level | Actions |
|-------|---------|
| `low` | Navigation, reading, viewing |
| `medium` | Opening apps, file operations |
| `high` | Shell commands, sending emails |

---

## Examples

### Multi-Command Sequence
```
I'll organize your downloads and open the calculator.

[SHELL_COMMAND: ls ~/Downloads]
[SHELL_COMMAND: mkdir -p ~/Downloads/{Images,Documents,Videos}]
[OPEN_APP: Calculator]
```

### Web Search and Navigation
```
Search for AI news and navigate to the top result.

[WEB_SEARCH: AI news today]
[NAVIGATE: https://news.example.com/ai]
```

### Generate Report
```
Create a PDF report with the current page data.

[GENERATE_PDF: AI Report | author:Comet | This report covers...]
```

---

## Changelog

### v0.2.5 Changes
- Removed `ORGANIZE_FOLDER` command (now uses shell commands)
- Added AI explanations for shell commands
- Safe commands now permanently allowed after first approval
- Shift+Tab now works for all risk levels
