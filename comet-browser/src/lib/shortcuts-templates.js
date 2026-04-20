const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const SHORTCUTS_TEMPLATES_DIR = path.join(app.getPath('userData'), 'ShortcutsTemplates');

function ensureTemplatesDir() {
  if (!fs.existsSync(SHORTCUTS_TEMPLATES_DIR)) {
    fs.mkdirSync(SHORTCUTS_TEMPLATES_DIR, { recursive: true });
  }
}

function generateShortcutTemplate(id, name, description, steps) {
  return {
    id,
    name,
    description,
    version: '1.0',
    createdAt: new Date().toISOString(),
    steps,
  };
}

function exportAllTemplates() {
  ensureTemplatesDir();
  
  const templates = [
    {
      id: 'chat-with-ai',
      name: 'Chat with Comet AI',
      description: 'Send a message to Comet AI and get a response',
      steps: [
        {
          name: 'Ask for input',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'What do you want to ask AI?',
            defaultAnswer: '',
          },
        },
        {
          name: 'Open Comet AI',
          type: 'openURL',
          config: {
            url: 'comet-ai://chat?message={{Step1}}',
          },
        },
      ],
    },
    {
      id: 'smart-search',
      name: 'Smart AI Search',
      description: 'Search the web using Comet AI',
      steps: [
        {
          name: 'Enter search query',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'What do you want to search for?',
          },
        },
        {
          name: 'Send to Comet',
          type: 'openURL',
          config: {
            url: 'comet-ai://search?query={{Step1}}',
          },
        },
      ],
    },
    {
      id: 'create-pdf',
      name: 'Create PDF Document',
      description: 'Create a PDF from content',
      steps: [
        {
          name: 'Get content',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'What content for the PDF?',
          },
        },
        {
          name: 'Get title',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'PDF title?',
            defaultAnswer: 'Document',
          },
        },
        {
          name: 'Create PDF',
          type: 'openURL',
          config: {
            url: 'comet-ai://create-pdf?content={{Step1}}&title={{Step2}}',
          },
        },
      ],
    },
    {
      id: 'voice-chat',
      name: 'Voice Chat with AI',
      description: 'Dictate and send to AI',
      steps: [
        {
          name: 'Dictate',
          type: 'dictateText',
          config: {
            prompt: 'Speak your message to AI',
            language: 'en-US',
          },
        },
        {
          name: 'Send to AI',
          type: 'openURL',
          config: {
            url: 'comet-ai://chat?message={{Dictation}}&speak=true',
          },
        },
      ],
    },
    {
      id: 'ask-and-speak',
      name: 'Ask AI + Speak Response',
      description: 'Ask AI question and hear spoken response',
      steps: [
        {
          name: 'Question',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'What do you want to ask?',
          },
        },
        {
          name: 'Ask + Speak',
          type: 'openURL',
          config: {
            url: 'comet-ai://ask-ai?prompt={{Step1}}&speak=true',
          },
        },
      ],
    },
    {
      id: 'run-terminal-command',
      name: 'Run Terminal Command',
      description: 'Execute a terminal command (with confirmation)',
      steps: [
        {
          name: 'Command',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'Terminal command to run?',
          },
        },
        {
          name: 'Confirm',
          type: 'showAlert',
          config: {
            title: 'Confirm',
            message: 'Run this command?',
            buttons: ['Cancel', 'Run'],
          },
        },
        {
          name: 'Execute',
          type: 'openURL',
          config: {
            url: 'comet-ai://run-command?command={{Step1}}&confirm=true',
          },
        },
      ],
    },
    {
      id: 'schedule-task',
      name: 'Schedule AI Task',
      description: 'Schedule an AI task',
      steps: [
        {
          name: 'Task',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'What task to schedule?',
          },
        },
        {
          name: 'Schedule',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'When? (daily at 8am, every hour, weekdays)',
            defaultAnswer: 'daily',
          },
        },
        {
          name: 'Schedule',
          type: 'openURL',
          config: {
            url: 'comet-ai://schedule?task={{Step1}}&cron={{Step2}}',
          },
        },
      ],
    },
    {
      id: 'open-app',
      name: 'Open Application',
      description: 'Launch an application',
      steps: [
        {
          name: 'App name',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'Which app to open?',
          },
        },
        {
          name: 'Open app',
          type: 'openURL',
          config: {
            url: 'comet-ai://open-app?appName={{Step1}}',
          },
        },
      ],
    },
    {
      id: 'set-volume',
      name: 'Set Volume',
      description: 'Control system volume',
      steps: [
        {
          name: 'Volume level',
          type: 'askForInput',
          inputConfig: {
            type: 'number',
            prompt: 'Volume (0-100)',
            defaultAnswer: '50',
          },
        },
        {
          name: 'Set volume',
          type: 'openURL',
          config: {
            url: 'comet-ai://volume?level={{Step1}}',
          },
        },
      ],
    },
    {
      id: 'take-screenshot',
      name: 'Take Screenshot',
      description: 'Capture screen',
      steps: [
        {
          name: 'Screenshot',
          type: 'openURL',
          config: {
            url: 'comet-ai://screenshot',
          },
        },
      ],
    },
    {
      id: 'navigate',
      name: 'Navigate to Website',
      description: 'Open a URL in Comet AI',
      steps: [
        {
          name: 'URL',
          type: 'askForInput',
          inputConfig: {
            type: 'text',
            prompt: 'Enter URL or search query',
          },
        },
        {
          name: 'Navigate',
          type: 'openURL',
          config: {
            url: 'comet-ai://navigate?url={{Step1}}',
          },
        },
      ],
    },
  ];

  const exported = [];

  for (const template of templates) {
    const filepath = path.join(SHORTCUTS_TEMPLATES_DIR, `${template.id}.shortcut`);
    fs.writeFileSync(filepath, JSON.stringify(template, null, 2));
    exported.push({
      id: template.id,
      name: template.name,
      filename: `${template.id}.shortcut`,
    });
  }

  return exported;
}

function generateImportMarkdown() {
  return `# Comet AI Shortcuts Templates

## Installation

1. Open Shortcuts app on macOS
2. Click the + button to create new shortcut
3. Add actions and configure as shown below

## Available Templates

### 1. Chat with AI
- **Trigger:** "Ask Comet AI"
- **URL:** comet-ai://chat?message={message}
- **Use:** Send any question to AI

### 2. Smart Search
- **URL:** comet-ai://search?query={query}
- **Use:** Search the web with AI

### 3. Create PDF
- **URL:** comet-ai://create-pdf?content={content}&title={title}
- **Use:** Generate PDF documents

### 4. Voice Chat
- **URL:** comet-ai://chat?message={message}&speak=true
- **Use:** Dictate and hear response

### 5. Ask + Speak
- **URL:** comet-ai://ask-ai?prompt={prompt}&speak=true
- **Use:** Ask question, hear answer

### 6. Run Command
- **URL:** comet-ai://run-command?command={command}&confirm=true
- **Use:** Execute terminal commands

### 7. Schedule Task
- **URL:** comet-ai://schedule?task={task}&cron={schedule}
- **Use:** Schedule AI tasks

### 8. Open App
- **URL:** comet-ai://open-app?appName={appName}
- **Use:** Launch applications

### 9. Set Volume
- **URL:** comet-ai://volume?level={0-100}
- **Use:** Control volume

### 10. Screenshot
- **URL:** comet-ai://screenshot
- **Use:** Capture screen

### 11. Navigate
- **URL:** comet-ai://navigate?url={url}
- **Use:** Open websites

## Voice Commands with Siri

Once shortcuts are added, you can say:
- "Hey Siri, ask Comet AI [question]"
- "Hey Siri, search [query] with Comet AI"
- "Hey Siri, create PDF in Comet AI"

## URL Parameters

| Parameter | Description | Example |
|-----------|------------|---------|
| message | Chat message | Hello AI |
| query | Search query | Python tutorial |
| content | PDF content | Hello World |
| title | Document title | My Report |
| url | Website URL | google.com |
| command | Shell command | ls -la |
| task | Task description | Generate report |
| cron | Schedule | daily at 8am |
| level | Volume (0-100) | 75 |
| speak | Enable TTS | true |
| model | AI model | gemini |
`;
}

function getTemplatesList() {
  return [
    { id: 'chat-with-ai', name: 'Chat with AI', description: 'Send message to Comet AI' },
    { id: 'smart-search', name: 'Smart Search', description: 'Search web with AI' },
    { id: 'create-pdf', name: 'Create PDF', description: 'Generate PDF document' },
    { id: 'voice-chat', name: 'Voice Chat', description: 'Dictate and send to AI' },
    { id: 'ask-and-speak', name: 'Ask + Speak', description: 'Ask and hear response' },
    { id: 'run-terminal-command', name: 'Run Command', description: 'Execute terminal' },
    { id: 'schedule-task', name: 'Schedule Task', description: 'Schedule AI tasks' },
    { id: 'open-app', name: 'Open App', description: 'Launch applications' },
    { id: 'set-volume', name: 'Set Volume', description: 'Control volume' },
    { id: 'take-screenshot', name: 'Screenshot', description: 'Capture screen' },
    { id: 'navigate', name: 'Navigate', description: 'Open websites' },
  ];
}

module.exports = {
  exportAllTemplates,
  generateImportMarkdown,
  getTemplatesList,
  SHORTCUTS_TEMPLATES_DIR,
};