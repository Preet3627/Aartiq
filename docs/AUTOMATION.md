# Comet-AI Automation System - Complete Specification

## Overview

The Comet-AI Automation System enables scheduled task execution even when the browser is closed. It runs as a lightweight background service that can execute tasks like PDF generation, web scraping, AI prompts, and shell commands on a schedule.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S COMPUTER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  comet-ai-service (Background Service)                              │  │
│   │  • Runs as SYSTEM user (no login required)                         │  │
│   │  • System tray icon only                                           │  │
│   │  • Executes scheduled tasks                                         │  │
│   │  • ~30-50MB RAM                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                         Browser ↔ Service IPC                               │
│                                    │                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  Comet-AI Browser (GUI - Optional)                                  │  │
│   │  • Same tasks can run here too                                     │  │
│   │  • View/manage scheduled tasks                                      │  │
│   │  • Real-time task status                                            │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Task Definition

### Task Schema

```typescript
interface ScheduledTask {
  id: string;                    // UUID
  name: string;                  // Human-readable name
  description?: string;          // Optional description
  
  // Trigger configuration
  trigger: {
    type: 'cron' | 'once' | 'interval';
    schedule?: string;           // cron: "0 8 * * *"
    datetime?: string;           // once: ISO date
    intervalMs?: number;         // interval: milliseconds
  };
  
  timezone: string;              // e.g., "America/New_York"
  
  // Task type and config
  taskType: TaskType;
  config: TaskConfig;
  
  // Behavior
  enabled: boolean;
  maxRetries: number;
  staggerMinutes?: number;
  
  // Notifications
  notification: {
    onStart: boolean;
    onComplete: boolean;
    onError: boolean;
  };
  
  // Output/delivery
  output?: {
    path: string;               // Save location
    filename?: string;           // e.g., "Report_{date}.pdf"
  };
  
  // Model selection
  model?: ModelSelection;
  
  // Execution history
  lastRun?: Date;
  lastStatus?: 'success' | 'failed' | 'skipped';
  lastError?: string;
  nextRun?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type TaskType = 
  | 'ai-prompt'
  | 'web-scrape'
  | 'pdf-generate'
  | 'shell'
  | 'workflow'
  | 'daily-brief';

interface ModelSelection {
  provider: 'ollama' | 'gemini' | 'openai' | 'anthropic' | 'groq' | 'auto';
  model?: string;               // Specific model name
  temperature?: number;
  maxTokens?: number;
}
```

### Workflow Step Schema

```typescript
interface WorkflowStep {
  id: string;
  type: 'scrape' | 'ai-process' | 'generate-pdf' | 'save-file' | 'notify' | 'condition';
  
  config: {
    // Scrape
    urls?: string[];
    selectors?: Record<string, string>;
    
    // AI Process
    prompt?: string;
    model?: ModelSelection;
    
    // Generate PDF
    template?: 'professional' | 'executive' | 'academic' | 'minimalist' | 'dark';
    title?: string;
    
    // Save file
    path?: string;
    format?: 'pdf' | 'txt' | 'json';
    
    // Notify
    message?: string;
    channels?: ('desktop' | 'mobile')[];
    
    // Condition
    expression?: string;
    expected?: any;
  };
  
  onError: 'continue' | 'retry' | 'abort';
  retryCount?: number;
}
```

---

## Supported Task Types

### 1. AI Prompt
Execute an AI query and optionally save/notify the result.

```javascript
{
  taskType: 'ai-prompt',
  config: {
    prompt: 'Give me a summary of top tech news today',
    model: { provider: 'gemini', model: 'gemini-2.0-flash' }
  },
  output: {
    path: '~/Documents/Comet-AI',
    filename: 'tech-news_{date}.txt'
  }
}
```

### 2. Web Scrap + AI
Scrape websites, process with AI, generate output.

```javascript
{
  taskType: 'web-scrape',
  config: {
    urls: [
      'https://news.ycombinator.com',
      'https://techcrunch.com'
    ],
    selectors: {
      title: '.titleline a',
      score: '.score'
    },
    aiProcess: {
      prompt: 'Extract top 5 headlines and summarize',
      model: { provider: 'gemini' }
    }
  }
}
```

### 3. PDF Generation
Generate PDF documents from content.

```javascript
{
  taskType: 'pdf-generate',
  config: {
    title: 'Daily Report',
    template: 'professional',
    content: 'Generated content here...',
    model: { provider: 'ollama', model: 'deepseek-r1:8b' }
  },
  output: {
    path: '~/Desktop',
    filename: 'Report_{date}.pdf'
  }
}
```

### 4. Shell Command
Execute shell commands.

```javascript
{
  taskType: 'shell',
  config: {
    command: 'curl -s https://api.example.com/status',
    timeout: 30000
  }
}
```

### 5. Workflow (Multi-step)
Chain multiple steps together.

```javascript
{
  taskType: 'workflow',
  config: {
    steps: [
      { type: 'scrape', config: { urls: ['https://news.ycombinator.com'] }},
      { type: 'ai-process', config: { prompt: 'Summarize top stories' }},
      { type: 'generate-pdf', config: { template: 'professional' }},
      { type: 'save-file', config: { path: '~/Desktop', format: 'pdf' }},
      { type: 'notify', config: { message: 'Daily news ready!', channels: ['desktop', 'mobile'] }}
    ]
  }
}
```

### 6. Daily Briefing (Pre-built)
Weather + News + Calendar summary.

```javascript
{
  taskType: 'daily-brief',
  config: {
    include: ['weather', 'news', 'calendar'],
    newsSources: ['hn', 'techcrunch'],
    outputFormat: 'pdf',
    model: { provider: 'gemini' }
  }
}
```

---

## Natural Language Scheduling

### Supported Patterns

| User Input | Parsed Schedule |
|-----------|-----------------|
| "at 8am" | `0 8 * * *` |
| "every day at 8am" | `0 8 * * *` |
| "daily at 8:30 AM" | `30 8 * * *` |
| "every hour" | `0 * * * *` |
| "every 30 minutes" | `*/30 * * * *` |
| "every monday at 9" | `0 9 * * 1` |
| "on weekdays at 6pm" | `0 18 * * 1-5` |
| "first day of month" | `0 0 1 * *` |
| "tomorrow at 10am" | `once` with datetime |
| "in 2 hours" | `once` with interval |

### AI Detection Flow

```
User: "Generate daily news PDF at 8am and save to Desktop"

AI Detection:
1. Pattern "at 8am" → cron: "0 8 * * *"
2. Pattern "daily" → recurring task
3. Task type inferred: web-scrape + pdf-generate
4. Output location: ~/Desktop

AI Response:
"Would you like me to schedule this task?
• Schedule: Daily at 8:00 AM
• Task: Generate Daily News PDF
• Save to: ~/Desktop/News_{date}.pdf
• Model: Gemini Flash (free & fast)

[Change Model] [Change Location] [Cancel] [Schedule]"
```

---

## Model Selection

### Supported Providers

| Provider | Models | API Required |
|----------|--------|--------------|
| **Ollama** | deepseek-r1:14b, llama3:8b, mistral:7b, etc. | No (local) |
| **Gemini** | gemini-2.0-flash, gemini-1.5-pro | Yes (free tier) |
| **OpenAI** | gpt-4o, gpt-4o-mini | Yes |
| **Anthropic** | claude-3.5-sonnet | Yes |
| **Groq** | llama-3.1-70b, mixtral-8x7b | Yes (free tier) |

### Model Selector Modal

```
┌────────────────────────────────────────────────────────────┐
│  🤖 Select AI Model                                 [X]  │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Task: Generate Daily News PDF                             │
│                                                             │
│  Select Model:                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🔥 Gemini Flash (Recommended)                    ▼ │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ 🔥 Gemini Flash (Recommended)                      │   │
│  │ 🖥️ Ollama - deepseek-r1:8b                       │   │
│  │ 🖥️ Ollama - llama3:8b                            │   │
│  │ ☁️ GPT-4o-mini (Uses API)                        │   │
│  │ ☁️ Claude 3.5 Sonnet (Uses API)                   │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  Model Info:                                                │
│  • Free & Fast                                              │
│  • Good for: Summaries, PDFs, quick tasks                  │
│  • Powered by Google AI                                     │
│                                                             │
│  ☑ Remember this choice for similar tasks                  │
│                                                             │
│                    [Cancel]  [Use This Model]               │
└────────────────────────────────────────────────────────────┘
```

---

## Storage Structure

```
~/Documents/Comet-AI/
├── tasks.json                    # All scheduled tasks
├── queue.json                   # Pending task queue
├── results/
│   ├── 2026-03-27-news.pdf
│   ├── 2026-03-27-brief.txt
│   └── ...
├── logs/
│   ├── 2026-03-27-execution.json
│   └── ...
└── public/                      # Files accessible to mobile
    └── reports/
```

---

## Service Installation

### Windows (Task Scheduler)

```powershell
# Install as SYSTEM service (runs without login)
schtasks /CREATE /SC ONSTART /TN "Comet-AI-Service" /TR "C:\Program Files\Comet-AI\service.exe" /RU SYSTEM /RL HIGHEST

# Or per-user (runs when user logs in)
schtasks /CREATE /SC LOGON /TN "Comet-AI-Service" /TR "C:\Program Files\Comet-AI\service.exe"
```

### macOS (LaunchDaemon)

```xml
<!-- /Library/LaunchDaemons/com.ai.comet-service.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai.comet-service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Comet-AI.app/Contents/MacOS/comet-ai-service</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### Linux (systemd)

```ini
# ~/.config/systemd/user/comet-ai.service
[Unit]
Description=Comet-AI Background Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/comet-ai-service
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

---

## Notification System

### Desktop Notification

```javascript
{
  type: 'task-complete',
  title: '✅ Task Complete',
  body: 'Daily News PDF generated successfully',
  silent: false,
  actions: [
    { type: 'button', title: 'Open PDF' },
    { type: 'button', title: 'Show in Folder' }
  ],
  data: {
    taskId: 'uuid',
    filePath: '~/Desktop/News_2026-03-27.pdf'
  }
}
```

### Mobile Notification

```javascript
{
  type: 'task-complete',
  title: '📄 Task Complete',
  body: 'Daily News PDF ready',
  data: {
    taskId: 'uuid',
    fileUrl: 'http://desktop-ip:3999/News_2026-03-27.pdf',
    taskName: 'Daily News PDF'
  }
}
```

---

## WiFi Sync Protocol (Task Extensions)

### New Message Types

```javascript
// Mobile → Desktop
{ type: 'task-sync-request' }
{ type: 'task-force-run', taskId: 'uuid' }
{ type: 'task-toggle', taskId: 'uuid', enabled: boolean }
{ type: 'task-delete', taskId: 'uuid' }
{ type: 'task-create', task: ScheduledTask }
{ type: 'task-update', taskId: 'uuid', updates: Partial<ScheduledTask> }

// Desktop → Mobile
{ type: 'task-sync-response', tasks: ScheduledTask[] }
{ type: 'task-created', task: ScheduledTask }
{ type: 'task-updated', task: ScheduledTask }
{ type: 'task-deleted', taskId: 'uuid' }
{ type: 'task-started', taskId: 'uuid', taskName: string }
{ type: 'task-completed', taskId: 'uuid', status: 'success'|'failed', result?: any }
```

---

## Mobile PDF Viewer

### Access Methods

1. **Local HTTP Server** (Port 3999)
   - Service serves files from `~/Documents/Comet-AI/public/`
   - Mobile accesses via `http://desktop-ip:3999/file.pdf`

2. **Firebase Storage** (Future)
   - Files synced to cloud storage
   - Accessible from anywhere

### PDF Viewer Features

- View PDFs from desktop
- Download for offline
- Share to other apps
- Zoom and scroll
- Page navigation

---

## Sleep/Wake Recovery

```javascript
// When system wakes from sleep
powerMonitor.on('resume', () => {
  // 1. Load missed tasks from storage
  const missedTasks = findMissedTasks();
  
  // 2. Execute catch-up for each
  for (const task of missedTasks) {
    executeTask(task, { catchUp: true });
  }
  
  // 3. Update next scheduled runs
  updateAllSchedules();
});

// Timer drift detection
function checkTimerDrift() {
  const expectedNextRun = getNextScheduledRun();
  const actualNow = Date.now();
  
  if (Math.abs(actualNow - expectedNextRun) > 60000) {
    // Drift detected, resync
    resyncScheduler();
  }
}
```

---

## Error Handling

### Retry Strategy

```javascript
{
  maxRetries: 3,
  retryDelays: [
    5000,    // 5 seconds
    30000,   // 30 seconds
    120000   // 2 minutes
  ],
  backoffMultiplier: 1.5
}
```

### Error Types

| Error | Action |
|-------|--------|
| Network timeout | Retry with backoff |
| Model unavailable | Fallback to next model |
| File system error | Log, notify, skip |
| AI error | Log, retry, notify if persistent |

---

## Implementation Checklist

- [ ] Create `src/service/` directory
- [ ] Implement `service-main.js` entry point
- [ ] Add `tray-manager.js` with system tray
- [ ] Create `scheduler.js` with node-cron
- [ ] Implement `task-queue.js` with persistence
- [ ] Add `storage.js` for file management
- [ ] Create `model-selector.js` and `ModelSettings.tsx`
- [ ] Implement `ollama-manager.js` for Ollama integration
- [ ] Add `notifications.js` for desktop notifications
- [ ] Create `mobile-notifier.js` for mobile push
- [ ] Add `pdf-sync.js` for mobile PDF access
- [ ] Implement `sleep-handler.js` for sleep recovery
- [ ] Create Windows installer (`scripts/install-service.js`)
- [ ] Create macOS installer (`scripts/install-service.sh`)
- [ ] Add Flutter automation page (`lib/pages/automation_page.dart`)
- [ ] Add Flutter PDF viewer (`lib/pages/pdf_viewer_page.dart`)
- [ ] Update WiFiSyncService with task sync
- [ ] Add SchedulingModal.tsx for AI scheduling confirmation

---

*Document Version: 1.0*
*Last Updated: 2026-03-26*
