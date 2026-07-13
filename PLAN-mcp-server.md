# Claude MCP Server - Full App Control for Aartiq

## Goal

Build a comprehensive Claude MCP server (`aartiq-mcp/server/index.js`) that gives Claude Desktop full control over every Aartiq panel, setting, AI chat, sync, automation, security, permissions, video playback, and app knowledge. The MCP server communicates with the running Aartiq Electron app via the existing HTTP bridge on port 46203.

## Architecture

```
Claude Desktop ──(stdio)──> aartiq-mcp-server ──(HTTP)──> Aartiq Bridge (port 46203)
                                                           └── main.js (IPC to renderer)
                                                           └── electron-store (settings)
                                                           └── permission-store (security)
                                                           └── scheduler (automation)
                                                           └── ai-engine (LLM)
```

**Transport:** Stdio (for Claude Desktop)  
**Bridge Client:** HTTP requests to `http://127.0.0.1:46203`  
**Aartiq Required:** Yes - all tools require the app to be running  

## Files to Modify/Create

### 1. `aartiq-mcp/server/index.js` - REWRITE (Main MCP Server)
Complete rewrite with 60+ tools organized into categories.

### 2. `aartiq-mcp/server/bridge-client.js` - CREATE (HTTP Bridge Client)
Reusable HTTP client for communicating with the Aartiq bridge.

### 3. `aartiq-browser/main.js` - MODIFY (Add Missing Bridge Endpoints)
Add ~8 new bridge endpoints that are needed but don't exist yet:
- `GET /native-mac-ui/bookmarks` - Read bookmarks
- `POST /native-mac-ui/bookmarks/add` - Add bookmark
- `DELETE /native-mac-ui/bookmarks/remove` - Remove bookmark
- `GET /native-mac-ui/history` - Read history
- `DELETE /native-mac-ui/history/clear` - Clear history
- `GET /native-mac-ui/settings` - Read current settings
- `POST /native-mac-ui/settings/update` - Update specific settings
- `GET /native-mac-ui/permissions` - List permissions and audit log
- `POST /native-mac-ui/permissions/grant` - Grant permission
- `POST /native-mac-ui/permissions/revoke` - Revoke permission
- `POST /native-mac-ui/automation/create` - Create scheduled task
- `GET /native-mac-ui/automation/tasks` - List scheduled tasks
- `POST /native-mac-ui/automation/toggle` - Enable/disable task
- `DELETE /native-mac-ui/automation/delete` - Delete task
- `POST /native-mac-ui/automation/run` - Run task immediately
- `GET /native-mac-ui/app-info` - Full app info (version, features, capabilities)

### 4. `aartiq-mcp/manifest.json` - UPDATE
Update manifest to reflect new tool count and capabilities.

## Tool Categories (60+ Tools)

### Category 1: Panel Control (8 tools)
| Tool | Description |
|------|-------------|
| `open_settings` | Open settings to a specific section (profile, appearance, api-keys, privacy, permissions, shortcuts, history, automation, sync, extensions, plugins, mcp, about, updates) |
| `open_bookmarks_panel` | View all bookmarks |
| `open_history_panel` | View browsing history |
| `open_sync_panel` | Open sync & cloud panel |
| `open_permissions_panel` | Open permission manager |
| `open_downloads_panel` | Open downloads panel |
| `open_clipboard_panel` | Open clipboard manager |
| `open_command_center` | Open command center / action chain |

### Category 2: Settings Control (10 tools)
| Tool | Description |
|------|-------------|
| `get_all_settings` | Get current app settings |
| `get_setting` | Get a specific setting value |
| `update_setting` | Update any setting (theme, search engine, AI provider, etc.) |
| `change_theme` | Change theme (dark/light/vibrant/custom/system/minimal) |
| `set_custom_theme_colors` | Set custom theme primary/secondary colors |
| `set_search_engine` | Change default search engine |
| `set_ai_provider` | Change active AI provider (openai/anthropic/google/groq/xai/ollama) |
| `toggle_setting` | Toggle a boolean setting (adblocker, student mode, guest mode, etc.) |
| `set_performance_mode` | Set performance mode (balanced/power-save/high-performance) |
| `set_firewall_level` | Set firewall level (standard/strict/paranoid) |

### Category 3: Bookmarks & History (5 tools)
| Tool | Description |
|------|-------------|
| `list_bookmarks` | Get all bookmarks |
| `add_bookmark` | Add a bookmark for a URL |
| `remove_bookmark` | Remove a bookmark |
| `list_history` | Get browsing history (with optional date range) |
| `clear_history` | Clear browsing history |

### Category 4: AI Chat (5 tools)
| Tool | Description |
|------|-------------|
| `send_ai_prompt` | Send a prompt to Aartiq's AI and get the LLM response in real-time |
| `send_ai_prompt_with_context` | Send a prompt with specific context (current page, selection, etc.) |
| `get_ai_conversations` | List all AI conversations |
| `new_ai_conversation` | Start a new AI conversation |
| `get_ai_response_status` | Check if AI is still loading / get streaming status |

### Category 5: Permission & Security Management (8 tools)
| Tool | Description |
|------|-------------|
| `list_permissions` | List all granted permissions |
| `grant_permission` | Grant a permission (read/interact/write/execute/send) |
| `revoke_permission` | Revoke a permission |
| `revoke_all_permissions` | Revoke all permissions |
| `get_security_settings` | Get current security settings |
| `update_security_settings` | Update security settings (auto-approve, biometric, etc.) |
| `get_permission_audit_log` | Get permission audit log |
| `get_network_security_config` | Get firewall, proxy, DNS settings |

### Category 6: Automation & Scheduling (7 tools)
| Tool | Description |
|------|-------------|
| `create_scheduled_task` | Create a new scheduled task (cron/interval/once) |
| `list_scheduled_tasks` | List all scheduled tasks |
| `toggle_scheduled_task` | Enable/disable a scheduled task |
| `run_scheduled_task_now` | Run a scheduled task immediately |
| `delete_scheduled_task` | Delete a scheduled task |
| `get_task_execution_logs` | Get logs of past task executions |
| `set_reminder` | Set a reminder/alarm at a specific time |

### Category 7: Browser Control (8 tools)
| Tool | Description |
|------|-------------|
| `list_tabs` | List all open browser tabs |
| `switch_tab` | Switch to a specific tab |
| `close_tab` | Close a tab |
| `navigate` | Navigate active tab to URL |
| `get_active_tab_url` | Get current tab URL and title |
| `read_page_content` | Read text content of the active page |
| `go_back` | Navigate back |
| `go_forward` | Navigate forward |

### Category 8: Video & Media (3 tools)
| Tool | Description |
|------|-------------|
| `play_video` | Play a YouTube/video URL using the built-in YouTubePlayer (supports inline iframe playback) |
| `play_video_in_new_tab` | Open video in a new tab for playback |
| `get_media_status` | Check if media is playing |

### Category 9: System & Sync (5 tools)
| Tool | Description |
|------|-------------|
| `get_sync_status` | Get WiFi sync / cloud sync / P2P sync status |
| `copy_to_clipboard` | Copy text to system clipboard |
| `get_clipboard` | Get clipboard contents |
| `set_volume` | Set system volume (0-100) |
| `get_app_info` | Get app version, platform, features, and architecture details |

### Category 10: App Knowledge & Guidance (5 tools)
| Tool | Description |
|------|-------------|
| `explain_feature` | Get detailed explanation of any Aartiq feature |
| `get_app_guide` | Get a guide for using Aartiq (setup, features, shortcuts) |
| `get_security_overview` | Get comprehensive overview of Aartiq's security model |
| `get_permission_guide` | Get guide on how permissions and risk management works |
| `list_all_features` | List all features of Aartiq with descriptions |

## Implementation Details

### bridge-client.js
- HTTP client with configurable port (default 46203)
- GET/POST/DELETE helpers with error handling
- Connection health check (`GET /native-mac-ui/state`)
- Auto-retry on ECONNREFUSED (clear error: "Aartiq is not running")
- Timeout handling (10s default)

### main.js Bridge Endpoints
Each new endpoint follows the existing pattern:
1. Read from `electron-store` or `permission-store` directly in main process
2. Return JSON response
3. For write operations, update the store and send IPC events to renderer

### AI Chat Flow
The `send_ai_prompt` tool:
1. POST to `/native-mac-ui/cli/ask` with `{ prompt, model }` 
2. This triggers `llmGenerateHandler` in main.js (already implemented)
3. Waits for the response (up to 30s timeout)
4. Returns the plain text response to Claude

### Scheduling Flow
The `create_scheduled_task` tool:
1. POST to `/native-mac-ui/automation/create` with task config
2. Bridge handler stores task via `StorageManager` and schedules via `TaskScheduler`
3. Task supports: `cron`, `interval`, `once` trigger types
4. Task actions: `ai-prompt`, `shell-command`, `http-request`, `file-operation`

### Video Playback
The `play_video` tool:
1. POST to `/native-mac-ui/prompt` with a structured command
2. Or directly send `add-new-tab` event with a video URL
3. YouTubePlayer component auto-detects YouTube URLs and renders inline iframe
4. Supports YouTube, Vimeo, and direct video URLs

### App Knowledge
The `explain_feature` and `list_all_features` tools use a hardcoded knowledge base embedded in the MCP server with comprehensive documentation of:
- All panels and how to open them
- All settings and what they control
- Security model (3 layers: PermissionStore, CapabilityController, CommandExecutor)
- Risk levels (low/medium/high) and approval flows
- AI chat capabilities and supported providers
- Automation system (cron, intervals, one-shot)
- Sync options (WiFi, Cloud/Firebase, P2P)
- Plugin system
- MCP server integration
- Keyboard shortcuts
- OCR, Vision, Robot automation
- macOS native SwiftUI panels

## Risk Map (embedded in MCP server)
Every tool has an associated risk level for Claude's safety awareness:
- **Low:** read_page, list_tabs, get_settings, list_bookmarks, explain_feature
- **Medium:** navigate, change_theme, add_bookmark, update_setting, play_video
- **High:** execute_shell_command, revoke_all_permissions, clear_history, delete_scheduled_task

## Verification

1. **Start Aartiq** and verify bridge is running: `curl http://127.0.0.1:46203/native-mac-ui/state`
2. **Test MCP server standalone:** `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node aartiq-mcp/server/index.js`
3. **Test with Claude Desktop:** Add MCP config to Claude Desktop settings
4. **Test each category:** Ask Claude to open settings, change theme, send AI prompt, create a scheduled task, list permissions, play a video
