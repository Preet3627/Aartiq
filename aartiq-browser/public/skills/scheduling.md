---
name: scheduling
description: Use this skill when the user wants to schedule recurring tasks, set alarms, or automate workflows at specific times. Activate when keywords like "schedule", "remind", "every day", "cron", "recurring" are detected.
license: Proprietary
---

## Scheduling Tasks (SCHEDULE_TASK)

When user asks to schedule something (e.g., "open X at 8am", "daily", "every hour"):

**Step 1:** Extract the schedule (cron expression), task type, and any parameters from the user's request.
**Step 2:** Emit [SCHEDULE_TASK: <JSON>] with the proper format.
**Step 3:** The system will show a scheduling modal pre-filled with your values for the user to confirm.
**Step 4:** Task is registered and will run automatically at scheduled times.

ALWAYS use SCHEDULE_TASK for scheduling. Do NOT create shell scripts or give manual cron instructions.

### SCHEDULE_TASK JSON Format

```json
{
  "schedule": "cron expression",
  "type": "task type",
  "name": "Task Name",
  "description": "What this task does (optional)",
  "url": "https://...",
  "command": "shell command"
}
```

### Supported Task Types

| Type | Description | Required Fields |
|------|-------------|----------------|
| `open-url` | Opens a URL in the browser at scheduled time | `url` |
| `shell` | Runs a shell command | `command` |
| `pdf-generate` | Generates a PDF report | `prompt` |
| `web-scrape` | Scrapes website content | `prompt` |
| `ai-prompt` | Runs an AI prompt | `prompt` |
| `daily-brief` | Generates daily summary | `prompt` |
| `workflow` | Runs a recorded workflow | — |

### Examples

**Open a URL daily at 11:50 AM:**
```
[SCHEDULE_TASK: {"schedule": "50 11 * * *", "type": "open-url", "url": "https://web.whatsapp.com", "name": "Open WhatsApp"}]
```

**Run a shell command every hour:**
```
[SCHEDULE_TASK: {"schedule": "0 * * * *", "type": "shell", "command": "open https://news.ycombinator.com", "name": "Open HN"}]
```

**Generate PDF weekly:**
```
[SCHEDULE_TASK: {"schedule": "0 9 * * 1", "type": "pdf-generate", "name": "Weekly Report", "description": "Generate weekly PDF report"}]
```

### Cron Format Examples
- `0 8 * * *` — Daily at 8am
- `50 11 * * *` — Daily at 11:50am
- `0 9 * * 1-5` — Weekdays at 9am
- `*/30 * * * *` — Every 30 minutes
- `0 0 * * 0` — Every Sunday at midnight
