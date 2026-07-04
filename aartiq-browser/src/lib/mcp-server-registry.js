const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

class McpManager {
  constructor() {
    this.clients = new Map();
    this.tools = {};
  }

  async connect(id, config) {
    const { url, type = 'sse', command, args, env, name = 'MCP Server' } = config;
    console.log(`[MCP-Manager] Connecting to ${id} (${url || command})`);
    
    try {
      const { createMCPClient } = await import('@ai-sdk/mcp');
      let transport;
      
      if (type === 'sse') {
        transport = new SSEClientTransport(new URL(url));
      } else if (type === 'stdio') {
        const transportOptions = { command, args };
        if (env) {
          transportOptions.env = { ...process.env, ...env };
        }
        transport = new StdioClientTransport(transportOptions);
      } else {
        throw new Error(`Unsupported transport type: ${type}`);
      }

      const client = await createMCPClient({ transport });
      this.clients.set(id, { client, url, type, status: 'online', config });
      console.log(`[MCP-Manager] Successfully connected to ${id}`);
      return true;
    } catch (error) {
      const isConfigured = url || command;
      if (isConfigured) {
        console.warn(`[MCP-Manager] ${id} unavailable: ${error.message || 'connection failed'}`);
      }
      this.clients.set(id, { status: 'offline', error: error.message, config });
      return false;
    }
  }

  async disconnect(id) {
    const entry = this.clients.get(id);
    if (entry && entry.client) {
      try {
        await entry.client.close();
      } catch (e) {}
    }
    this.clients.delete(id);
  }

  async getTools(permissionStore) {
    const combinedTools = {};
    for (const [id, entry] of this.clients.entries()) {
      if (entry.status === 'online' && entry.client) {
        try {
          const clientTools = await entry.client.tools();
          for (const [toolName, tool] of Object.entries(clientTools)) {
            const prefixedName = `${id}__${toolName}`;
            const originalExecute = tool.execute;
            
            combinedTools[prefixedName] = {
              ...tool,
              execute: async (args) => {
                if (permissionStore && !permissionStore.isGranted(`mcp:${id}`)) {
                  console.warn(`[MCP-Manager] Permission denied for server ${id} (tool: ${toolName})`);
                  return { 
                    error: `Permission Denied. You must authorize the MCP server "${id}" in settings before the AI can use its tools.`,
                    needs_permission: true,
                    serverId: id
                  };
                }
                return originalExecute(args);
              }
            };
          }
        } catch (e) {
          console.warn(`[MCP-Manager] Failed to fetch tools from ${id}:`, e);
        }
      }
    }
    return combinedTools;
  }

  getStatus(id) {
    const entry = this.clients.get(id);
    return entry ? entry.status : 'offline';
  }

  getAllServers() {
      return Array.from(this.clients.entries()).map(([id, entry]) => ({
          id,
          ...entry.config,
          status: entry.status,
          error: entry.error
      }));
  }
}

const mcpManager = new McpManager();
module.exports = { mcpManager };
