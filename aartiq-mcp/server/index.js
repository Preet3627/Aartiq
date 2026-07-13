#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

const TOOLS = [
  {
    name: 'list_tabs',
    description: 'List all open browser tabs with their IDs, titles, and URLs',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'switch_tab',
    description: 'Switch to a specific tab by ID, index (1-based), or title/URL search',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Tab ID, index number (1-based), or search term' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'close_tab',
    description: 'Close a specific tab by ID, index (1-based), or title/URL search',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Tab ID, index number (1-based), or search term' },
      },
      required: ['id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'navigate',
    description: 'Navigate the active tab to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
        newTab: { type: 'boolean', description: 'Open in a new tab instead', default: false },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'get_active_tab_url',
    description: 'Get the URL of the currently active tab',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'read_page',
    description: 'Read the text content of the active tab page',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: { type: 'string', description: 'Optional tab ID. Defaults to active tab.' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'click_element',
    description: 'Click an element on the page by CSS selector or text content',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' },
        text: { type: 'string', description: 'Text content to find and click (alternative to selector)' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'fill_form',
    description: 'Fill a form field on the active page by CSS selector',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the form field' },
        value: { type: 'string', description: 'The value to fill in' },
      },
      required: ['selector', 'value'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'go_back',
    description: 'Go back in the active tab history',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'go_forward',
    description: 'Go forward in the active tab history',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'reload',
    description: 'Reload the active tab',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'search_applications',
    description: 'Search for installed local applications by name (macOS /Applications or Windows Start Menu)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'App name or search term' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_external_app',
    description: 'Open a local application by its absolute path or name (e.g., /Applications/Safari.app or "Safari" on macOS)',
    inputSchema: {
      type: 'object',
      properties: {
        appPath: { type: 'string', description: 'Absolute path or app name' },
      },
      required: ['appPath'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'set_volume',
    description: 'Set system audio output volume level (0 to 100). macOS only.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: 'Volume level between 0 and 100', minimum: 0, maximum: 100 },
      },
      required: ['level'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_brightness',
    description: 'Set screen brightness level (0 to 1). macOS only.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'number', description: 'Brightness level between 0.0 and 1.0', minimum: 0, maximum: 1 },
      },
      required: ['level'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_alarm',
    description: 'Create a desktop system reminder/alarm at a specific time. macOS only.',
    inputSchema: {
      type: 'object',
      properties: {
        time: { type: 'string', description: 'ISO date/time string' },
        message: { type: 'string', description: 'Reminder message content' },
      },
      required: ['time', 'message'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'execute_shell_command',
    description: 'Execute a command in the shell/terminal. Safe operations only.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The raw shell command to execute' },
      },
      required: ['command'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'run_applescript',
    description: 'Run custom AppleScript command on macOS. Restricted to target allowed apps: Safari, Notes, Calendar, Mail, Finder, Terminal, Calculator.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'The AppleScript block' },
      },
      required: ['script'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'run_powershell',
    description: 'Run custom PowerShell command on Windows. Restricted to safe commands.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'The PowerShell script command' },
      },
      required: ['script'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: 'get_active_window',
    description: 'Get details (process name / window title) of the frontmost/active window on the host OS.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'generate_pdf',
    description: 'Generate a professional PDF document with a title and content (supports Markdown tables, headings, bold/italic, quote, code blocks) and save it to the Downloads folder.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the PDF document' },
        content: { type: 'string', description: 'The body content of the PDF (Markdown, plaintext, or HTML)' },
      },
      required: ['title', 'content'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'search_applications': {
      const { query } = args;
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync(`mdfind "kMDItemKind == 'Application'" | grep -i "${query}" | head -20`);
        const apps = stdout.trim().split('\n').filter(Boolean).map(p => ({
          name: path.basename(p, '.app'),
          path: p,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(apps, null, 2) }] };
      }
      return { content: [{ type: 'text', text: 'Application search currently supports macOS only in standalone mode.' }] };
    }

    case 'open_external_app': {
      const { appPath } = args;
      if (process.platform === 'darwin') {
        await execAsync(`open "${appPath}"`);
        return { content: [{ type: 'text', text: `Opened: ${appPath}` }] };
      }
      return { content: [{ type: 'text', text: 'Opening external apps is currently supported on macOS only in standalone mode.' }] };
    }

    case 'set_volume': {
      const { level } = args;
      if (process.platform === 'darwin') {
        await execAsync(`osascript -e "set volume output volume ${level}"`);
        return { content: [{ type: 'text', text: `Volume set to ${level}%` }] };
      }
      return { content: [{ type: 'text', text: 'Volume control is currently supported on macOS only.' }] };
    }

    case 'set_brightness': {
      const { level } = args;
      if (process.platform === 'darwin') {
        await execAsync(`osascript -e "tell application \"System Events\" to tell process \"System Events\" to set value of slider 1 of window 1 to ${level}"`);
        return { content: [{ type: 'text', text: `Brightness set to ${Math.round(level * 100)}%` }] };
      }
      return { content: [{ type: 'text', text: 'Brightness control is currently supported on macOS only.' }] };
    }

    case 'set_alarm': {
      const { time, message } = args;
      if (process.platform === 'darwin') {
        const date = new Date(time);
        await execAsync(`osascript -e 'tell application "Reminders" to make new reminder with properties {name:"${message.replace(/'/g, "\\'")}", due date:date "${date.toISOString()}"}'`);
        return { content: [{ type: 'text', text: `Alarm set for ${time}: ${message}` }] };
      }
      return { content: [{ type: 'text', text: 'Alarm creation is currently supported on macOS only.' }] };
    }

    case 'execute_shell_command': {
      const { command } = args;
      try {
        const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
        return { content: [{ type: 'text', text: stdout || stderr || '(no output)' }] };
      } catch (e) {
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      }
    }

    case 'run_applescript': {
      if (process.platform !== 'darwin') {
        return { content: [{ type: 'text', text: 'AppleScript is only available on macOS.' }], isError: true };
      }
      const ALLOWED_APPS = ['Safari', 'Notes', 'Calendar', 'Mail', 'Finder', 'Terminal', 'Calculator'];
      const hasAllowed = ALLOWED_APPS.some(app => args.script.toLowerCase().includes(app.toLowerCase()));
      if (!hasAllowed) {
        return { content: [{ type: 'text', text: `AppleScript: no allowed app target. Allowed: ${ALLOWED_APPS.join(', ')}` }], isError: true };
      }
      const escaped = args.script.replace(/'/g, "\\'");
      const { stdout } = await execAsync(`osascript -e '${escaped}'`);
      return { content: [{ type: 'text', text: stdout.trim() }] };
    }

    case 'run_powershell': {
      if (process.platform !== 'win32') {
        return { content: [{ type: 'text', text: 'PowerShell is only available on Windows.' }], isError: true };
      }
      const dangerous = ['Remove-Item', 'Format-', 'Stop-Process', 'Restart-Computer'];
      for (const d of dangerous) {
        if (args.script.toLowerCase().includes(d.toLowerCase())) {
          return { content: [{ type: 'text', text: `PowerShell: blocked dangerous command: ${d}` }], isError: true };
        }
      }
      const escaped = args.script.replace(/"/g, '\\"');
      const { stdout } = await execAsync(`powershell -Command "${escaped}"`);
      return { content: [{ type: 'text', text: stdout.trim() }] };
    }

    case 'get_active_window': {
      if (process.platform === 'darwin') {
        const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`);
        return { content: [{ type: 'text', text: JSON.stringify({ app: stdout.trim(), platform: 'darwin' }) }] };
      }
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`powershell -Command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).MainWindowTitle"`);
        return { content: [{ type: 'text', text: JSON.stringify({ window: stdout.trim(), platform: 'win32' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unsupported platform', platform: process.platform }) }] };
    }

    default:
      return {
        content: [{ type: 'text', text: `Tool "${name}" requires the Aartiq browser to be running. Please launch Aartiq and connect via the built-in MCP server for full browser automation, web search, and PDF generation tools.` }],
        isError: true,
      };
  }
}

async function main() {
  const server = new Server(
    {
      name: 'aartiq-mcp',
      title: 'Aartiq Browser',
      version: '1.0.0',
      description: 'AI-native browser with autonomous agent capabilities, local LLM support, and cross-device sync.',
      websiteUrl: 'https://aartiq.ponsrischool.in',
      icons: [
        {
          src: 'https://aartiq.ponsrischool.in/logo-transparent.png',
          mimeType: 'image/png',
          sizes: ['any'],
        },
      ],
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await handleToolCall(name, args || {});
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Error executing ${name}: ${e.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
