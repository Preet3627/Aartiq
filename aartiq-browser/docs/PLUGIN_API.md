# Plugin System Architecture

## Overview

Aartiq features a powerful plugin system that allows extending functionality through modular plugins. Plugins can register AI commands, hook into system events, and provide custom UI components.

## Plugin Structure

```
plugins/
├── manifest.json          # Plugin metadata and configuration
├── index.js              # Plugin entry point
├── commands/             # (optional) Command implementations
├── hooks/                # (optional) Event hook handlers
├── ui/                   # (optional) Custom UI components
└── assets/               # (optional) Plugin assets
```

## manifest.json

Every plugin must have a `manifest.json` file:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample plugin for Aartiq",
  "author": "Your Name",
  "main": "index.js",
  "type": "command",
  "permissions": ["storage", "network", "notifications"],
  "dependencies": {},
  "aiCommands": [
    {
      "name": "MY_COMMAND",
      "description": "Does something useful",
      "parameters": [
        { "name": "param1", "type": "string", "required": true }
      ]
    }
  ]
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique plugin identifier |
| `name` | string | Yes | Display name |
| `version` | string | Yes | Semantic version |
| `description` | string | No | Plugin description |
| `author` | string | No | Author name |
| `main` | string | No | Entry point (default: `index.js`) |
| `type` | string | No | Plugin type |
| `permissions` | array | No | Required permissions |

## Plugin Types

| Type | Description |
|------|-------------|
| `ai-model` | AI model plugins |
| `command` | Command plugins |
| `integration` | Integration plugins |
| `theme` | Theme plugins |
| `automation` | Automation plugins |

## Plugin SDK

The Plugin SDK provides a base class and utilities for creating plugins:

```javascript
const { Plugin, createPlugin, createCommand, createContext } = require('./plugin-sdk');

// Create a new plugin
const myPlugin = createPlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0'
});

// Or extend the Plugin class
class MyPlugin extends Plugin {
  constructor(options) {
    super(options);
    // Initialize plugin
  }

  async onLoad() {
    await super.onLoad();
    // Plugin loaded
  }

  async onUnload() {
    // Cleanup before unload
    await super.onUnload();
  }

  getCommands() {
    return {
      'my-command': async (ctx) => {
        return ctx.success({ result: 'Hello!' });
      }
    };
  }

  getHooks() {
    return {
      'onMessage': async (data) => {
        console.log('Message received:', data);
      }
    };
  }
}

module.exports = MyPlugin;
```

## Plugin Class API

### Constructor

```javascript
const plugin = new Plugin({
  id: 'plugin-id',
  name: 'Plugin Name',
  version: '1.0.0',
  description: 'Plugin description',
  author: 'Author Name'
});
```

### Lifecycle Methods

#### onLoad()

Called when the plugin is loaded. Use for initialization:

```javascript
async onLoad() {
  this.logger.info('Plugin loading...');
  await this.initialize();
}
```

#### onUnload()

Called when the plugin is unloaded. Use for cleanup:

```javascript
async onUnload() {
  this.logger.info('Plugin unloading...');
  await this.cleanup();
}
```

### Command Registration

#### getCommands()

Register AI commands:

```javascript
getCommands() {
  return {
    'hello': async (ctx) => {
      return ctx.success({ message: 'Hello from plugin!' });
    },
    'process': async (ctx) => {
      const { param1, param2 } = ctx.params;
      // Process command
      return ctx.success({ result: 'processed' });
    }
  };
}
```

### Hook System

#### getHooks()

Register event hooks:

```javascript
getHooks() {
  return {
    'onMessage': async (data) => {
      // Handle incoming message
    },
    'onCommand': async (command) => {
      // Handle command execution
    },
    'onNotification': async (notification) => {
      // Handle notification
    }
  };
}
```

### Available Hooks

| Hook | Parameters | Description |
|------|------------|-------------|
| `onLoad` | - | Plugin loaded |
| `onUnload` | - | Plugin unloading |
| `onMessage` | `{ message, role }` | AI message sent |
| `onCommand` | `{ command, params }` | Command executed |
| `onNotification` | `{ title, body }` | Notification shown |
| `onError` | `{ error, context }` | Error occurred |
| `beforeNavigate` | `{ url }` | Before navigation |
| `afterNavigate` | `{ url }` | After navigation |

### Plugin Utilities

#### callAPI(apiName, ...args)

Call Electron IPC APIs:

```javascript
const result = await this.callAPI('get-app-version');
```

#### emit(event, data)

Emit events to the main process:

```javascript
await this.emit('plugin-event', { key: 'value' });
```

#### request(url, options)

Make HTTP requests:

```javascript
const data = await this.request('https://api.example.com/data');
```

#### readFile(filePath)

Read a file:

```javascript
const content = await this.readFile('/path/to/file');
```

#### writeFile(filePath, content)

Write a file:

```javascript
await this.writeFile('/path/to/file', 'content');
```

#### showNotification(title, body, options)

Show a notification:

```javascript
await this.showNotification('Title', 'Body text', { silent: true });
```

#### updateConfig(newConfig)

Update plugin configuration:

```javascript
this.updateConfig({ setting1: 'value1' });
```

#### requestPermission(permission)

Request a permission:

```javascript
const granted = await this.requestPermission('storage');
```

## Command Context

When a command is executed, it receives a `CommandContext`:

```javascript
async myCommand(ctx) {
  // Access parameters
  const { param1, param2 } = ctx.params;
  
  // Access plugin instance
  ctx.plugin.logger.info('Command executed');
  
  // Return success
  return ctx.success({ result: 'success' });
  
  // Or return error
  return ctx.error('Something went wrong');
}
```

### CommandContext Properties

| Property | Type | Description |
|----------|------|-------------|
| `plugin` | Plugin | Plugin instance |
| `params` | object | Command parameters |
| `logger` | Logger | Plugin logger |

### CommandContext Methods

#### success(result)

Return a successful result:

```javascript
return ctx.success({ key: 'value' });
```

#### error(message)

Return an error:

```javascript
return ctx.error('Error message');
```

## AICommandBuilder

Create AI commands programmatically:

```javascript
const { createCommand } = require('./plugin-sdk');

const command = createCommand()
  .setName('my-ai-command')
  .setDescription('Does something useful')
  .addParameter('input', 'string', true, 'Input text')
  .addParameter('count', 'number', false, 'Count')
  .setHandler(async (ctx) => {
    const { input, count } = ctx.params;
    return ctx.success({ output: input.repeat(count || 1) });
  })
  .build();
```

## Permissions

Plugins can request permissions in `manifest.json`:

```json
{
  "permissions": ["storage", "network", "notifications", "file-system"]
}
```

### Available Permissions

| Permission | Description |
|------------|-------------|
| `storage` | Access electron-store |
| `network` | Make HTTP requests |
| `notifications` | Show notifications |
| `file-system` | Read/write files |
| `clipboard` | Access clipboard |
| `automation` | Use automation APIs |

## Preload APIs

Plugins have access to these preload APIs:

```javascript
// Plugin management
window.electronAPI.plugins.list();
window.electronAPI.plugins.get(pluginId);
window.electronAPI.plugins.install(source, options);
window.electronAPI.plugins.uninstall(pluginId);
window.electronAPI.plugins.enable(pluginId);
window.electronAPI.plugins.disable(pluginId);
window.electronAPI.plugins.update(pluginId);
window.electronAPI.plugins.getCommands();
window.electronAPI.plugins.executeCommand(commandId, params);
window.electronAPI.plugins.updateConfig(pluginId, config);
```

## Example Plugin

### Weather Plugin Structure

```
plugins/weather-plugin/
├── manifest.json
└── index.js
```

### manifest.json

```json
{
  "id": "weather-plugin",
  "name": "Weather Plugin",
  "version": "1.0.0",
  "description": "Get weather information via AI",
  "author": "Aartiq",
  "type": "command",
  "permissions": ["network"],
  "main": "index.js"
}
```

### index.js

```javascript
const { Plugin } = require('../../src/lib/plugin-sdk');

class WeatherPlugin extends Plugin {
  getCommands() {
    return {
      'get-weather': async (ctx) => {
        const { city } = ctx.params;
        try {
          const response = await this.request(
            `https://api.weather.example.com?city=${encodeURIComponent(city)}`
          );
          return ctx.success({
            city: response.city,
            temp: response.temperature,
            conditions: response.conditions
          });
        } catch (error) {
          return ctx.error(`Failed to get weather: ${error.message}`);
        }
      }
    };
  }
}

module.exports = WeatherPlugin;
```

## Installation

### From Local Directory

```javascript
await window.electronAPI.plugins.install('/path/to/plugin');
```

### From URL

```javascript
await window.electronAPI.plugins.install('https://example.com/plugin.zip');
```

## Best Practices

1. **Error Handling**: Always wrap operations in try/catch
2. **Logging**: Use the plugin logger for debugging
3. **Configuration**: Store settings in plugin config, not hardcoded
4. **Permissions**: Only request necessary permissions
5. **Cleanup**: Properly clean up resources in `onUnload`
6. **Validation**: Validate all user input
7. **Async**: Use async/await for all async operations
