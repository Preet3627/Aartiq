"use strict";
/**
 * Agent API — shared types for the tool registry and bridge.
 *
 * Feature managers (snapshot, autofill, extensions, agents, guardrails) live in
 * the browser main process. This registry exposes them as tools to MCP clients
 * and the HTTP API, routing every call through the SecurityPipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.textResult = textResult;
exports.jsonResult = jsonResult;
function textResult(text) {
    return { content: [{ type: 'text', text }] };
}
function jsonResult(data) {
    return { content: [{ type: 'json', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}
