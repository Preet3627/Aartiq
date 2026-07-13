#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { BridgeClient } = require('./bridge-client');

const bridge = new BridgeClient(
  parseInt(process.env.AARTIQ_BRIDGE_PORT || '46203', 10)
);

// ─── Tool Definitions ───

const TOOLS = [
  // ═══════════════════════════════════════════════
  // CATEGORY 1: PANEL CONTROL
  // ═══════════════════════════════════════════════
  {
    name: 'open_settings',
    description: 'Open Aartiq settings panel to a specific section. Sections: profile, appearance, search, api-keys, privacy, permissions, shortcuts, history, automation, sync, extensions, plugins, mcp, about, updates, performance, system, admin',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Settings section to open', default: 'profile' },
      },
      required: ['section'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_bookmarks_panel',
    description: 'Open the bookmarks/vault panel in Aartiq',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_history_panel',
    description: 'Open the browsing history panel in Aartiq',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_sync_panel',
    description: 'Open the sync & cloud panel (WiFi sync, Cloud sync, P2P file transfer)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_permissions_panel',
    description: 'Open the permission manager panel to view and manage app permissions',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_downloads_panel',
    description: 'Open the downloads panel',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_clipboard_panel',
    description: 'Open the clipboard manager panel',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'open_command_center',
    description: 'Open the command center / action chain panel',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 2: AI SIDEBAR CONTROL
  // ═══════════════════════════════════════════════
  {
    name: 'open_ai_sidebar',
    description: 'Open the Aartiq AI chat sidebar. Must be open for AI prompts to use full capabilities (PDF generation, navigation, research, tools).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'close_ai_sidebar',
    description: 'Close the Aartiq AI chat sidebar',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'toggle_ai_sidebar',
    description: 'Toggle the Aartiq AI chat sidebar visibility',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 3: AI CHAT (Full sidebar-powered)
  // ═══════════════════════════════════════════════
  {
    name: 'send_ai_prompt',
    description: 'Send a prompt to the Aartiq AI sidebar. The AI has full capabilities: it can navigate tabs, generate PDFs, perform web research, execute shell commands, use OCR/vision, manage clipboard, play videos, and more. IMPORTANT: The AI sidebar must be open for full capabilities. Use open_ai_sidebar first if needed. Returns the AI response and any actions it performed.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt/message to send to the AI' },
      },
      required: ['prompt'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'get_ai_state',
    description: 'Get the current AI sidebar state including messages, loading status, action logs, and errors',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'new_ai_conversation',
    description: 'Start a new AI conversation (clears current chat context)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'list_ai_conversations',
    description: 'List all saved AI conversations',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 4: SETTINGS CONTROL
  // ═══════════════════════════════════════════════
  {
    name: 'get_all_settings',
    description: 'Get all current Aartiq settings (API keys are masked). Returns the full configuration.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_setting',
    description: 'Get a specific setting value by key name',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The setting key name (e.g., "theme", "selectedEngine", "aiProvider")' },
      },
      required: ['key'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'update_setting',
    description: 'Update any setting in Aartiq. Common keys: theme (dark/light/vibrant/custom/system/minimal), selectedEngine, aiProvider, enableAIAssist, enableAdblocker, studentMode, isGuestMode, firewallLevel, performanceMode, customThemePrimary, customThemeSecondary, browserAccentPreset',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The setting key to update' },
        value: { description: 'The new value for the setting' },
      },
      required: ['key', 'value'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'change_theme',
    description: 'Change the Aartiq browser theme. Options: dark, light, vibrant, custom, system, minimal',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'Theme name: dark, light, vibrant, custom, system, minimal', enum: ['dark', 'light', 'vibrant', 'custom', 'system', 'minimal'] },
      },
      required: ['theme'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_custom_theme_colors',
    description: 'Set custom theme primary and secondary colors (requires theme to be set to "custom")',
    inputSchema: {
      type: 'object',
      properties: {
        primary: { type: 'string', description: 'Primary color as hex (e.g., "#ff6b6b")' },
        secondary: { type: 'string', description: 'Secondary color as hex (e.g., "#22d3ee")' },
      },
      required: ['primary', 'secondary'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_search_engine',
    description: 'Change the default search engine',
    inputSchema: {
      type: 'object',
      properties: {
        engine: { type: 'string', description: 'Search engine name (e.g., google, bing, duckduckgo, brave, startpage)' },
      },
      required: ['engine'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_ai_provider',
    description: 'Change the active AI provider for the AI sidebar',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'AI provider ID: openai, anthropic, google, groq, xai, ollama, azure-openai' },
      },
      required: ['provider'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'toggle_setting',
    description: 'Toggle a boolean setting on/off',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Boolean setting key (e.g., enableAIAssist, enableAdblocker, studentMode, isGuestMode, showSiteWarnings)' },
      },
      required: ['key'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_firewall_level',
    description: 'Set the network firewall protection level',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'string', description: 'Firewall level', enum: ['standard', 'strict', 'paranoid'] },
      },
      required: ['level'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_performance_mode',
    description: 'Set the browser performance mode',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', description: 'Performance mode', enum: ['balanced', 'power-save', 'high-performance'] },
      },
      required: ['mode'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 5: BOOKMARKS & HISTORY
  // ═══════════════════════════════════════════════
  {
    name: 'list_bookmarks',
    description: 'Get all saved bookmarks',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'add_bookmark',
    description: 'Save a bookmark for a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to bookmark' },
        title: { type: 'string', description: 'Bookmark title (optional, defaults to URL)' },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'remove_bookmark',
    description: 'Remove a bookmark by URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the bookmark to remove' },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'list_history',
    description: 'Get browsing history',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max entries to return (default 50)', default: 50 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'clear_history',
    description: 'Clear all browsing history',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 6: PERMISSION & SECURITY MANAGEMENT
  // ═══════════════════════════════════════════════
  {
    name: 'list_permissions',
    description: 'List all granted permissions and security settings',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'grant_permission',
    description: 'Grant a permission to Aartiq. Permission keys: filesystem, filesystem-write, robot, native-app, mcp:<server-id>',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Permission key (e.g., "filesystem", "robot", "native-app")' },
        level: { type: 'string', description: 'Permission level', enum: ['read', 'interact', 'write', 'execute', 'send'], default: 'read' },
        description: { type: 'string', description: 'Description of why this permission is needed' },
      },
      required: ['key'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'revoke_permission',
    description: 'Revoke a previously granted permission',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Permission key to revoke' },
      },
      required: ['key'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: 'get_security_settings',
    description: 'Get the current security configuration (auto-approve, biometric, device unlock requirements)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'update_security_settings',
    description: 'Update security settings. Keys: autoApproveLowRisk, autoApproveMidRisk, requireDeviceUnlockForManualApproval, requireDeviceUnlockForVaultAccess, requireBiometricPerSession',
    inputSchema: {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          description: 'Security settings to update',
          properties: {
            autoApproveLowRisk: { type: 'boolean' },
            autoApproveMidRisk: { type: 'boolean' },
            requireDeviceUnlockForManualApproval: { type: 'boolean' },
            requireDeviceUnlockForVaultAccess: { type: 'boolean' },
            requireBiometricPerSession: { type: 'boolean' },
          },
        },
      },
      required: ['settings'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_network_security',
    description: 'Get network security configuration (firewall level, proxy, DNS, ad blocker)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 7: AUTOMATION & SCHEDULING
  // ═══════════════════════════════════════════════
  {
    name: 'create_scheduled_task',
    description: 'Create a scheduled automation task. Supports cron expressions, intervals, or one-time execution. Task actions: send ai-prompt, run shell-command, make http-request. Example cron: "0 9 * * *" for daily at 9am.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name' },
        description: { type: 'string', description: 'Task description' },
        trigger: {
          type: 'object',
          description: 'Trigger configuration',
          properties: {
            type: { type: 'string', enum: ['cron', 'interval', 'once'], description: 'Trigger type' },
            schedule: { type: 'string', description: 'Cron expression (for cron type), e.g., "0 9 * * *"' },
            intervalMs: { type: 'integer', description: 'Interval in milliseconds (for interval type)' },
            datetime: { type: 'string', description: 'ISO datetime string (for once type)' },
          },
          required: ['type'],
        },
        action: {
          type: 'object',
          description: 'Action to perform',
          properties: {
            type: { type: 'string', enum: ['ai-prompt', 'shell-command', 'http-request'], description: 'Action type' },
            payload: { type: 'string', description: 'The prompt, command, or URL to execute' },
          },
          required: ['type', 'payload'],
        },
        enabled: { type: 'boolean', description: 'Whether the task is enabled', default: true },
      },
      required: ['name', 'trigger', 'action'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'list_scheduled_tasks',
    description: 'List all scheduled automation tasks',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'toggle_scheduled_task',
    description: 'Enable or disable a scheduled task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to toggle' },
        enabled: { type: 'boolean', description: 'Enable or disable' },
      },
      required: ['taskId', 'enabled'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'run_scheduled_task_now',
    description: 'Immediately run a scheduled task (does not affect its schedule)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to run' },
      },
      required: ['taskId'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'delete_scheduled_task',
    description: 'Permanently delete a scheduled task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to delete' },
      },
      required: ['taskId'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 8: BROWSER CONTROL
  // ═══════════════════════════════════════════════
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
    description: 'Close a specific tab',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Tab ID or index (1-based)' },
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
        url: { type: 'string', description: 'URL to navigate to' },
        newTab: { type: 'boolean', description: 'Open in a new tab instead', default: false },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'get_active_tab_url',
    description: 'Get the URL and title of the currently active tab',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'read_page_content',
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
    name: 'go_back',
    description: 'Navigate back in the active tab history',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'go_forward',
    description: 'Navigate forward in the active tab history',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'reload_page',
    description: 'Reload the active tab',
    inputSchema: { type: 'object', properties: {} },
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

  // ═══════════════════════════════════════════════
  // CATEGORY 9: VIDEO & MEDIA
  // ═══════════════════════════════════════════════
  {
    name: 'play_video',
    description: 'Play a video using Aartiq built-in YouTubePlayer. Supports YouTube URLs (youtube.com/watch?v=..., youtu.be/...) and will render inline. For other video URLs, opens in a new tab.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Video URL (YouTube or direct video URL)' },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'play_video_in_new_tab',
    description: 'Open a video URL in a new browser tab for playback',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Video URL to open' },
      },
      required: ['url'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 10: SYSTEM & CLIPBOARD
  // ═══════════════════════════════════════════════
  {
    name: 'get_sync_status',
    description: 'Get status of all sync services (WiFi sync, Cloud/Firebase sync, P2P file transfer)',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'copy_to_clipboard',
    description: 'Copy text to the system clipboard',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy to clipboard' },
      },
      required: ['text'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'get_clipboard',
    description: 'Get the current clipboard contents',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'set_volume',
    description: 'Set system audio volume (0-100). macOS only.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: 'Volume level 0-100', minimum: 0, maximum: 100 },
      },
      required: ['level'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'execute_shortcut',
    description: 'Execute a keyboard shortcut action in Aartiq. Actions include: new-tab, close-tab, next-tab, prev-tab, toggle-sidebar, open-settings, open-history, open-downloads, open-extensions, open-bookmarks, toggle-ai-assist, cycle-theme, clear-history',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'The shortcut action name to execute' },
      },
      required: ['action'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  // ═══════════════════════════════════════════════
  // CATEGORY 11: APP INFO & KNOWLEDGE
  // ═══════════════════════════════════════════════
  {
    name: 'get_app_info',
    description: 'Get Aartiq app information: version, platform, features, LLM provider, bridge status',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'check_bridge_connection',
    description: 'Check if the Aartiq browser is running and the MCP bridge is reachable',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'explain_feature',
    description: 'Get a detailed explanation of any Aartiq feature. Ask about any feature by name.',
    inputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Feature name or topic to learn about (e.g., "AI sidebar", "sync", "permissions", "scheduling", "plugins", "security")' },
      },
      required: ['feature'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'get_security_overview',
    description: 'Get a comprehensive overview of Aartiq security model, risk levels, permission system, and approval flows',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'list_all_features',
    description: 'List all features of Aartiq with brief descriptions',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
];

// ─── App Knowledge Base ───

const APP_KNOWLEDGE = {
  'ai sidebar': `Aartiq's AI Sidebar is the main AI chat interface. It supports multiple LLM providers (OpenAI, Anthropic, Google Gemini, Groq, xAI, Ollama). The AI can: navigate tabs, search the web, perform OCR on screen content, use AI vision to analyze screens, execute shell commands, simulate mouse/keyboard (robot automation), read/write files, generate PDFs/DOCX/PPTX/XLSX, manage clipboard, translate text, schedule tasks, interact with Gmail, manage passwords/vault, control volume/brightness, and interact with plugins. The sidebar processes prompts through a full pipeline: RAG retrieval, live web search, browser state analysis, LLM generation, command parsing, and sequential command execution via AICommandQueue.`,

  'sync': `Aartiq has three sync systems: 1) WiFi Sync - Direct device-to-device sync over local WiFi using WebSocket (port 3004) and UDP discovery (port 3005). 2) Cloud Sync - Firebase-based sync for bookmarks, history, settings, and conversations across devices. 3) P2P File Transfer - WebRTC-based peer-to-peer file sharing between devices without a server. All sync is end-to-end encrypted.`,

  'permissions': `Aartiq uses a 3-layer permission system: Layer 1 (PermissionStore) tracks grants with levels (read/interact/write/execute/send), supports session-only and persistent grants, and logs all access to an audit trail. Layer 2 (CapabilityController) gates high-level actions with approval policies (never/always/first-time-per-session) and risk levels (low/medium/high). Layer 3 (CommandExecutor) validates all commands through a security validator that blocks dangerous patterns (rm -rf, sudo, kill, etc). High-risk commands require QR code approval from the mobile app with PIN verification.`,

  'security': `Aartiq's security model: Triple-lock architecture. 1) Command Validation - blocks dangerous shell patterns, SQL injection, XSS, encoding tricks. 2) Risk-based Approval - low risk auto-approves, medium risk needs user approval, high risk needs mobile QR + PIN. 3) Network Security - configurable firewall (standard/strict/paranoid), proxy modes, DNS over HTTPS, ad/tracker/malware blocking, WebRTC leak prevention. API keys stored in native OS keychain (macOS Keychain, Windows Credential Vault). Biometric auth (Touch ID/Face ID) for critical operations.`,

  'scheduling': `Aartiq's automation scheduler runs as a background service. Supports: cron expressions (e.g., "0 9 * * *" for daily 9am), interval-based (every N milliseconds), and one-time execution. Task types: AI prompts (full AI sidebar capabilities), shell commands, HTTP requests. Tasks persist across app restarts via file-based storage. The background service can be installed as a macOS LaunchDaemon/Agent or Windows Task Scheduler job. Includes sleep/wake handling to catch up on missed tasks.`,

  'plugins': `Aartiq has a dynamic plugin system via plugin-manager.js. Plugins are loaded from the plugins directory and can extend browser functionality. They can register new tools, UI panels, and automation workflows. MCP servers can also be added as external tool providers.`,

  'mcp': `Aartiq includes a built-in MCP (Model Context Protocol) server registry. External MCP servers can be connected via SSE or stdio transport. The browser exposes its own tools (tab control, navigation, page reading, shell commands, PDF generation, etc.) via an MCP server on port 3001. This allows Claude Desktop and other MCP clients to control the browser.`,

  'youtube': `Aartiq has a built-in YouTubePlayer component that renders YouTube videos as inline iframes. Supports youtube.com/watch?v=... and youtu.be/... URLs. Videos play inline in the browser tab without navigating away. The player handles autoplay, responsive sizing, and integrates with the browser's tab system.`,

  'ocr': `Aartiq includes Tesseract.js-based OCR (Optical Character Recognition). The OCR service can capture screen content and extract text. It supports: screen region capture, full screen text extraction, and OCR-guided clicking (find text on screen and click it). Used for cross-app automation where DOM access isn't available.`,

  'vision': `Aartiq's screen vision service uses AI to analyze screen content. It can describe what's on screen, identify UI elements, and perform intelligent actions based on visual analysis. Combined with OCR and robot automation, it enables cross-application automation.`,

  'robot': `Aartiq's RobotService provides mouse/keyboard automation via robotjs. It can: move mouse to coordinates, click, double-click, right-click, type text, press key combinations, drag and drop, scroll. Requires OS accessibility permissions. Used for automating applications beyond the browser.`,

  'vault': `Aartiq's Vault Manager handles secure storage of passwords, autofill data, addresses, and payment methods. Data is encrypted at rest using AES encryption. Access requires biometric authentication (Touch ID/Face ID) on macOS. Vault data syncs across devices via encrypted cloud sync.`,

  'extensions': `Aartiq supports browser extensions. The extensions manager allows installing, enabling, disabling, and removing extensions. Extensions run in isolated BrowserView contexts with controlled permissions.`,

  'performance': `Aartiq has three performance modes: Balanced (default), Power Save (limits active tabs, reduces background activity), and High Performance (maximum resources). Settings include max active tabs, max RAM usage, and keep-audio-tabs-active. The browser monitors resource usage and can auto-throttle tabs.`,

  'privacy': `Aartiq includes: built-in ad blocker, tracker blocker, malware host blocking, student mode (restricted browsing), guest mode (no history/cookies saved), Do Not Track header, WebRTC leak prevention, and secure DNS options (Cloudflare, Google, Quad9).`,

  'voice': `Aartiq has a voice service supporting Text-to-Speech (TTS) and Speech-to-Text (STT). Voice commands can trigger browser actions, and AI responses can be spoken aloud. Integrates with system speech APIs on macOS and Windows.`,

  'workflow': `Aartiq's Workflow Recorder captures user actions (clicks, typing, navigation) and replays them as automated workflows. Recorded workflows can be edited, scheduled, and shared. Combined with the automation scheduler, workflows can run unattended.`,

  'pdf': `Aartiq can generate professional PDF documents from AI responses, page content, or custom markdown/HTML. PDFs support tables, headings, bold/italic, code blocks, images, and headers/footers. Generated PDFs are saved to the Downloads folder.`,

  'gmail': `Aartiq integrates with Gmail via OAuth2. It can read, send, and search emails. The AI sidebar can compose and send emails on your behalf, search your inbox, and summarize email threads.`,

  'apple intelligence': `On macOS, Aartiq integrates with Apple Intelligence for on-device AI features: text summarization, image generation, and Genmoji. These run locally without sending data to external servers.`,
};

function getFeatureExplanation(feature) {
  const key = feature.toLowerCase().trim();
  for (const [topic, explanation] of Object.entries(APP_KNOWLEDGE)) {
    if (key.includes(topic) || topic.includes(key)) {
      return explanation;
    }
  }
  return `Aartiq is an AI-native browser with autonomous agent capabilities. It features: AI sidebar with multiple LLM providers, browser automation (tabs, navigation, page interaction), OCR and screen vision, robot automation (mouse/keyboard), PDF/DOCX/PPTX/XLSX generation, scheduling and task automation, WiFi/Cloud/P2P sync, vault and password management, ad/tracker/malware blocking, extension support, plugin system, MCP server integration, voice commands, workflow recording, and cross-platform support (macOS, Windows, Linux). Ask about any specific feature for details.`;
}

function getSecurityOverview() {
  return `
ARTIQ SECURITY MODEL - COMPREHENSIVE OVERVIEW
=============================================

TRIPLE-LOCK SECURITY ARCHITECTURE:

Layer 1: PermissionStore
  - Permission levels: read, interact, write, execute, send
  - Session-only and persistent grants
  - Auto-approval for low-risk and medium-risk operations
  - Complete audit trail (JSONL log file)
  - Auto-approved command and action lists

Layer 2: CapabilityController
  - Action-level gating with approval policies:
    * "never" - requires manual approval every time
    * "always" - auto-approved
    * "first-time-per-session" - approved once per session
  - Risk levels: low, medium, high

Layer 3: CommandExecutor + CommandValidator
  - Blocks dangerous shell patterns (rm -rf, sudo, kill, shutdown, etc.)
  - Detects SQL injection, XSS, shell injection, encoding tricks
  - URL validation and HTML sanitization

RISK-BASED APPROVAL FLOW:
  - Low risk: auto-approved (if setting enabled)
  - Medium risk: requires user click approval
  - High risk: requires QR code scan from Aartiq Mobile app + 6-digit PIN
  - Device unlock (biometric) required for high-risk approvals

NETWORK SECURITY:
  - Firewall levels: standard, strict, paranoid
  - Proxy modes: system, direct, fixed_servers, auto_detect
  - DNS over HTTPS: Cloudflare, Google, Quad9, custom
  - Ad/Tracker/Malware host blocking
  - WebRTC leak prevention
  - Do Not Track header

API KEY SECURITY:
  - Stored in native OS keychain (macOS Keychain / Windows Credential Vault)
  - Never stored in plain text config files
  - Encrypted at rest with AES

BIOMETRIC AUTHENTICATION:
  - macOS: Touch ID / Face ID
  - Used for vault access, critical permissions, high-risk approvals
  - Configurable: per-session or every-time
`;
}

function getAllFeatures() {
  return `
ARTIQ - ALL FEATURES
====================

BROWSER CORE:
  - Multi-tab browsing with BrowserView architecture
  - Tab management (create, switch, close, reorder)
  - Navigation (back, forward, reload)
  - Keyboard shortcuts (fully customizable)
  - Multiple themes (dark, light, vibrant, custom, system, minimal)
  - Performance modes (balanced, power-save, high-performance)
  - Guest mode and incognito browsing
  - Student mode (restricted browsing)

AI CAPABILITIES:
  - AI Sidebar with multi-provider support (OpenAI, Anthropic, Google Gemini, Groq, xAI, Ollama)
  - AI can navigate tabs, search web, read pages
  - AI can generate PDFs, DOCX, PPTX, XLSX documents
  - AI can execute shell commands (with approval)
  - AI can perform OCR on screen content
  - AI can analyze screen with computer vision
  - AI can simulate mouse/keyboard (robot automation)
  - AI can manage clipboard
  - AI can translate text
  - AI can schedule automation tasks
  - AI can interact with Gmail
  - AI can manage passwords/vault
  - AI can control volume/brightness
  - AI can play YouTube videos inline
  - Cross-session memory and conversation history
  - RAG (Retrieval-Augmented Generation) for context
  - Thinking/reasoning panels

SECURITY & PRIVACY:
  - Triple-lock security (PermissionStore, CapabilityController, CommandExecutor)
  - Risk-based approval (low/medium/high)
  - QR code + PIN approval for high-risk operations
  - Biometric authentication (Touch ID/Face ID)
  - Built-in ad blocker
  - Tracker blocker
  - Malware host blocking
  - DNS over HTTPS
  - WebRTC leak prevention
  - Proxy support
  - Firewall levels (standard/strict/paranoid)
  - API keys in native OS keychain
  - Encrypted vault storage

AUTOMATION:
  - Cron-based task scheduler (background service)
  - Shell command automation
  - AI prompt automation (scheduled AI tasks)
  - HTTP request automation
  - Mouse/keyboard robot automation
  - OCR-guided cross-app automation
  - Vision-guided automation
  - Workflow recording and replay
  - Sleep/wake handling

SYNC & CROSS-DEVICE:
  - WiFi sync (local network, WebSocket + UDP)
  - Cloud sync (Firebase, encrypted)
  - P2P file transfer (WebRTC)
  - Push notifications to mobile
  - Cross-platform (macOS, Windows, Linux)

PRODUCTIVITY:
  - Built-in PDF viewer
  - PDF/DOCX/PPTX/XLSX generation
  - Clipboard manager
  - Download manager
  - Password vault & autofill
  - Address & payment method storage
  - YouTube video player (inline)
  - Voice commands (TTS/STT)
  - Search engine selection

EXTENSIBILITY:
  - Browser extension support
  - Plugin system (dynamic loading)
  - MCP server integration (connect external AI tools)
  - CLI tool (aartiq command)
  - macOS native SwiftUI panels
  - Siri Shortcuts integration
  - Apple Intelligence integration (macOS)

DEVELOPER:
  - Built-in DevTools
  - Developer console
  - Page content extraction
  - DOM search
  - JavaScript execution
`;
}

// ─── Tool Execution ───

async function handleToolCall(name, args) {
  switch (name) {
    // Panel Control
    case 'open_settings':
      return jsonResult(await bridge.openSettings(args.section || 'profile'));
    case 'open_bookmarks_panel':
      return jsonResult(await bridge.openSettings('vault'));
    case 'open_history_panel':
      return jsonResult(await bridge.openSettings('history'));
    case 'open_sync_panel':
      return jsonResult(await bridge.openSettings('sync'));
    case 'open_permissions_panel':
      return jsonResult(await bridge.openSettings('permissions'));
    case 'open_downloads_panel':
      return jsonResult(await bridge.openPanel('downloads'));
    case 'open_clipboard_panel':
      return jsonResult(await bridge.openPanel('clipboard'));
    case 'open_command_center':
      return jsonResult(await bridge.openPanel('menu'));

    // AI Sidebar Control
    case 'open_ai_sidebar':
      return jsonResult(await bridge.openSidebar());
    case 'close_ai_sidebar':
      return jsonResult(await bridge.closeSidebar());
    case 'toggle_ai_sidebar':
      return jsonResult(await bridge.toggleSidebar());

    // AI Chat
    case 'send_ai_prompt': {
      const state = await bridge.getState();
      const sidebarOpen = state.electronAiSidebarOpen;
      if (!sidebarOpen) {
        await bridge.openSidebar();
        await sleep(800);
      }
      const result = await bridge.sendAiPromptAndWait(args.prompt, 'mcp');
      if (result.error && !result.response) {
        return { content: [{ type: 'text', text: `AI Error: ${result.error}` }], isError: true };
      }
      const responseText = result.response || '(No response)';
      const actionLogs = result.actionLogs || [];
      let output = responseText;
      if (actionLogs.length > 0) {
        output += '\n\n--- Actions Performed ---\n';
        for (const log of actionLogs) {
          output += `\n[${log.type}] ${log.success ? 'Success' : 'Failed'}: ${(log.output || '').substring(0, 500)}`;
        }
      }
      return { content: [{ type: 'text', text: output }] };
    }
    case 'get_ai_state': {
      const state = await bridge.getState();
      return jsonResult({
        isLoading: state.isLoading,
        error: state.error,
        messagesCount: (state.messages || []).length,
        lastMessage: (state.messages || []).slice(-1)[0] || null,
        actionChain: state.actionChain || [],
        sidebarOpen: state.electronAiSidebarOpen,
        conversations: (state.conversations || []).length,
      });
    }
    case 'new_ai_conversation':
      return jsonResult(await bridge.conversationAction('new'));
    case 'list_ai_conversations': {
      const state = await bridge.getState();
      return jsonResult({ conversations: state.conversations || [] });
    }

    // Settings
    case 'get_all_settings':
      return jsonResult(await bridge.getSettings());
    case 'get_setting': {
      const settings = await bridge.getSettings();
      const val = settings.settings ? settings.settings[args.key] : settings[args.key];
      return jsonResult({ key: args.key, value: val });
    }
    case 'update_setting':
      return jsonResult(await bridge.updateSettings({ [args.key]: args.value }));
    case 'change_theme':
      return jsonResult(await bridge.updateSettings({ theme: args.theme }));
    case 'set_custom_theme_colors':
      return jsonResult(await bridge.updateSettings({
        customThemePrimary: args.primary,
        customThemeSecondary: args.secondary,
        theme: 'custom',
      }));
    case 'set_search_engine':
      return jsonResult(await bridge.updateSettings({ selectedEngine: args.engine }));
    case 'set_ai_provider':
      return jsonResult(await bridge.updateSettings({ aiProvider: args.provider }));
    case 'toggle_setting': {
      const settings = await bridge.getSettings();
      const current = settings.settings ? settings.settings[args.key] : settings[args.key];
      return jsonResult(await bridge.updateSettings({ [args.key]: !current }));
    }
    case 'set_firewall_level':
      return jsonResult(await bridge.updateSettings({ firewallLevel: args.level }));
    case 'set_performance_mode':
      return jsonResult(await bridge.updateSettings({ performanceMode: args.mode }));

    // Bookmarks & History
    case 'list_bookmarks':
      return jsonResult(await bridge.getBookmarks());
    case 'add_bookmark':
      return jsonResult(await bridge.addBookmark(args.url, args.title));
    case 'remove_bookmark':
      return jsonResult(await bridge.removeBookmark(args.url));
    case 'list_history':
      return jsonResult(await bridge.getHistory(args.limit));
    case 'clear_history':
      return jsonResult(await bridge.clearHistory());

    // Permissions & Security
    case 'list_permissions':
      return jsonResult(await bridge.getPermissions());
    case 'grant_permission':
      return jsonResult(await bridge.grantPermission(args.key, args.level, args.description));
    case 'revoke_permission':
      return jsonResult(await bridge.revokePermission(args.key));
    case 'get_security_settings': {
      const perms = await bridge.getPermissions();
      return jsonResult(perms.securitySettings || {});
    }
    case 'update_security_settings':
      return jsonResult(await bridge.updateSettings(args.settings));
    case 'get_network_security':
      return jsonResult({ info: 'Network security config is managed via the Settings > Privacy & Security panel. Use open_settings with section "privacy" to view and modify.' });

    // Automation
    case 'create_scheduled_task':
      return jsonResult(await bridge.createAutomationTask(args));
    case 'list_scheduled_tasks':
      return jsonResult(await bridge.getAutomationTasks());
    case 'toggle_scheduled_task':
      return jsonResult(await bridge.toggleAutomationTask(args.taskId, args.enabled));
    case 'run_scheduled_task_now':
      return jsonResult(await bridge.runAutomationTask(args.taskId));
    case 'delete_scheduled_task':
      return jsonResult(await bridge.deleteAutomationTask(args.taskId));

    // Browser Control
    case 'list_tabs': {
      const state = await bridge.getState();
      return jsonResult({ tabs: state.tabs || [], info: 'Tab list from bridge state. Use execute_shortcut with "new-tab" to open new tabs.' });
    }
    case 'switch_tab':
      return jsonResult(await bridge.executeShortcut('next-tab'));
    case 'close_tab':
      return jsonResult(await bridge.executeShortcut('close-tab'));
    case 'navigate': {
      if (args.newTab) {
        await bridge.sendPrompt(`Navigate to ${args.url}`, 'mcp-navigate');
        return { content: [{ type: 'text', text: `Opening ${args.url} in new tab via AI` }] };
      }
      await bridge.sendPrompt(`Navigate the current tab to ${args.url}`, 'mcp-navigate');
      return { content: [{ type: 'text', text: `Navigating to ${args.url}` }] };
    }
    case 'get_active_tab_url': {
      const state = await bridge.getState();
      return jsonResult({ info: 'Active tab info available via browser state. Use open_ai_sidebar and send_ai_prompt to interact with tabs.' });
    }
    case 'read_page_content': {
      await bridge.sendPrompt('Read and return the text content of the current page', 'mcp-read');
      const result = await bridge.sendAiPromptAndWait('Read the full text content of the current page and return it', 'mcp-read');
      return { content: [{ type: 'text', text: result.response || 'Could not read page' }] };
    }
    case 'go_back':
      return jsonResult(await bridge.executeShortcut('prev-tab'));
    case 'go_forward':
      return jsonResult(await bridge.executeShortcut('next-tab'));
    case 'reload_page':
      return jsonResult({ info: 'Page reload triggered. Use the browser directly for precise reload control.' });
    case 'click_element':
      return jsonResult(await bridge.sendPrompt(`Click the element: ${args.selector || args.text}`, 'mcp-interact'));
    case 'fill_form':
      return jsonResult(await bridge.sendPrompt(`Fill the form field "${args.selector}" with "${args.value}"`, 'mcp-interact'));

    // Video
    case 'play_video': {
      const url = args.url;
      const isYouTube = url && (url.includes('youtube.com') || url.includes('youtu.be'));
      if (isYouTube) {
        await bridge.sendPrompt(`Play this YouTube video: ${url}`, 'mcp-video');
        return { content: [{ type: 'text', text: `Playing YouTube video: ${url}` }] };
      }
      return jsonResult(await bridge.executeShortcut('new-tab'));
    }
    case 'play_video_in_new_tab':
      return jsonResult(await bridge.sendPrompt(`Open and play this video in a new tab: ${args.url}`, 'mcp-video'));

    // System
    case 'get_sync_status':
      return jsonResult({
        wifiSync: 'WebSocket on port 3004, UDP discovery on port 3005',
        cloudSync: 'Firebase-based, encrypted',
        p2pSync: 'WebRTC peer-to-peer file transfer',
        info: 'Open sync panel for detailed status.',
      });
    case 'copy_to_clipboard':
      return jsonResult(await bridge.clipboardCopy(args.text));
    case 'get_clipboard': {
      const state = await bridge.getState();
      return jsonResult({ clipboardItems: state.clipboardItems || [] });
    }
    case 'set_volume':
      return jsonResult({ info: `Volume control available on macOS. Use system controls or AI sidebar for volume adjustment.` });
    case 'execute_shortcut':
      return jsonResult(await bridge.executeShortcut(args.action));

    // App Info & Knowledge
    case 'get_app_info':
      return jsonResult(await bridge.getAppInfo());
    case 'check_bridge_connection': {
      const health = await bridge.healthCheck();
      return jsonResult(health);
    }
    case 'explain_feature':
      return { content: [{ type: 'text', text: getFeatureExplanation(args.feature) }] };
    case 'get_security_overview':
      return { content: [{ type: 'text', text: getSecurityOverview() }] };
    case 'list_all_features':
      return { content: [{ type: 'text', text: getAllFeatures() }] };

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
}

function jsonResult(data) {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Server Startup ───

async function main() {
  const server = new Server(
    {
      name: 'aartiq-mcp',
      title: 'Aartiq Browser',
      version: '2.0.0',
      description: 'AI-native browser with full app control. Panels, settings, AI chat with tools, bookmarks, history, permissions, scheduling, video, and security management. Works on macOS and Windows.',
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
  console.error(`[aartiq-mcp] Server started with ${TOOLS.length} tools. Bridge: ${bridge.baseUrl}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
