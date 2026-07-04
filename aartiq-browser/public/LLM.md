# Aartiq Browser - LLM Integration Guide (v0.2.5)

## Overview

Aartiq Browser v0.2.5 introduces a **JSON-based command system** for faster parsing and complete separation from chat responses.

## NEW: JSON Command Format (Recommended)

Use JSON format for commands - it's faster to parse and completely separate from chat:

```json
{
  "commands": [
    {"type": "NAVIGATE", "value": "https://example.com"},
    {"type": "WEB_SEARCH", "value": "latest news today"},
    {"type": "GENERATE_PDF", "value": "My Report|author:Me|Content here..."}
  ]
}
```

### JSON Format Rules
- Put JSON in a code block: ```json ... ```
- Use ONLY the `commands` array
- Each command needs: `type` and `value`
- User sees only your text response, not the JSON
- JSON is automatically extracted and executed

---

## Legacy Tag Format (Still Supported)

You can also use the tag format, but JSON is faster:

```
[Your normal response content here...]

<!-- AI_COMMANDS_START -->
[NAVIGATE]:https://example.com
[WEB_SEARCH]:latest news today
[GENERATE_PDF]:My Report | author:Me | This is the report content...
<!-- AI_COMMANDS_END -->
```

---

## Available Commands

### Navigation
- `[NAVIGATE]:https://example.com` - Navigate to URL
- `[OPEN_VIEW]:coding` - Switch workspace view
- `[RELOAD]:` - Reload current page
- `[GO_BACK]:` - Go back in history
- `[GO_FORWARD]:` - Go forward in history

### Browser
- `[SEARCH]:query` - Default engine search
- `[WEB_SEARCH]:latest news today` - Real-time web search with RAG
- `[READ_PAGE_CONTENT]:` - Read active tab content
- `[LIST_OPEN_TABS]:` - List all open tabs
- `[DOM_SEARCH]:query` - Search page DOM
- `[DOM_READ_FILTERED]:query` - Read DOM with filtering

### Automation
- `[CLICK_ELEMENT]:#submit-btn | reason` - Click by CSS selector
- `[FIND_AND_CLICK]:Login | auth task` - Find and click text
- `[FILL_FORM]:#input | value` - Fill form field
- `[SCROLL_TO]:selector` - Scroll to element

### Media
- `[SCREENSHOT_AND_ANALYZE]:` - Capture and analyze screen
- `[OCR_SCREEN]:` - OCR full screen
- `[OCR_COORDINATES]:x,y,w,h` - OCR specific region
- `[SHOW_IMAGE]:url | caption` - Display image in chat
- `[SHOW_VIDEO]:url | title | description` - Display video card

### System
- `[SHELL_COMMAND]:ls -la` - Execute terminal command (requires permission)
- `[SET_VOLUME]:50` - Set system volume (0-100)
- `[SET_BRIGHTNESS]:80` - Set screen brightness (0-100)
- `[OPEN_APP]:Calculator` - Launch application
- `[SET_THEME]:dark` - Change theme

### Utility
- `[GENERATE_PDF]:Title | author:Name | subtitle:Sub | content...` - Create branded PDF
  - **CRITICAL**: MUST use square brackets! Example: `[GENERATE_PDF]:My Report | author:John | Content here...`
  - **WRONG**: `:My Report | author:John | Content` (missing [GENERATE_PDF] prefix!)
- `[GENERATE_DIAGRAM]:graph TD...` - Create Mermaid diagram
- `[OPEN_PDF]:/path/to/file.pdf` - Open PDF in viewer
- `[WAIT]:2000` - Pause execution (milliseconds)

### Gmail
- `[GMAIL_AUTHORIZE]:` - Authorize Gmail access
- `[GMAIL_LIST_MESSAGES]:query | 10` - List messages
- `[GMAIL_GET_MESSAGE]:id` - Get message content
- `[GMAIL_SEND_MESSAGE]:to | subject | body` - Send email

### Meta
- `[THINK]:reasoning` - Show AI reasoning
- `[PLAN]:steps` - Show AI plan
- `[EXPLAIN_CAPABILITIES]:` - List all capabilities
- `[OPEN_MCP_SETTINGS]:` - Open MCP settings

---

## Workflow Examples

### News PDF Generation
```
I'll search for the latest AI news and create a report for you.

<!-- AI_COMMANDS_START -->
[WEB_SEARCH]:AI news today March 2026
[WEB_SEARCH]:latest AI updates
[GENERATE_PDF]:AI News Report | author:Aartiq | Live AI news and updates for March 2026
<!-- AI_COMMANDS_END -->
```

### Web Research
```
Let me research this topic for you.

<!-- AI_COMMANDS_START -->
[NAVIGATE]:https://example.com/research
[READ_PAGE_CONTENT]:
[WEB_SEARCH]:related topic
<!-- AI_COMMANDS_END -->
```

### System Automation
```
I'll organize your Downloads folder and set up your workspace.

<!-- AI_COMMANDS_START -->
[OPEN_APP]:Calculator
[SET_VOLUME]:50
<!-- AI_COMMANDS_END -->
```

---

## Security Notes

### Shell Commands
- `[SHELL_COMMAND]` requires user permission
- Dangerous patterns are blocked automatically
- Only safe commands are executed

### Permission Levels
- **Low**: Navigation, browser, media (auto-approved)
- **Medium**: Automation, system control (requires confirmation)
- **High**: Shell commands (requires explicit approval)

---

## Export Format

Exports include separate JSON sections:

```
[CHAT_EXPORT]
User: Hello
Assistant: Response here...

[ACTION_CHAIN_JSON]
{
  "type": "ACTION_CHAIN_EXPORT",
  "commands": [...]
}

[PDF_COMMANDS_EXPORT]
{
  "type": "PDF_COMMANDS_EXPORT",
  "commands": [...]
}
```
