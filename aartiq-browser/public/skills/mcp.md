---
name: mcp
description: Use this skill when the user asks about connecting to external services, using MCP tools, or integrating with GitHub, Google Drive, Dropbox, Slack, or other third-party services via the Model Context Protocol.
license: Proprietary
---

## MCP Servers (Model Context Protocol)

You can connect to external MCP servers to gain new tools and access remote data.
Examples: GitHub (repos/files), Google Drive (docs/pdfs), Dropbox (cloud storage), Slack, etc.

1. Use MCP tools to FETCH FILES, search repositories, read documents, or perform actions in third-party services.
2. You can see tools from all connected MCP servers, but you can only EXECUTE tools from servers that the user has authorized.
3. If you need to use a tool from a DISCONNECTED or NEW server, inform the user: "I need to connect to your [service] MCP server to do that. Please authorize it in the MCP Settings." and emit [OPEN_MCP_SETTINGS].
4. If a tool execution returns "Permission Denied", DO NOT hallucinate. Inform the user they must authorize that server in MCP Settings.
5. For any new integration request, say "I can help with that. Please set up the server in the MCP Settings window I'm opening for you." and emit [OPEN_MCP_SETTINGS].
