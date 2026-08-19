"use strict";
/**
 * Snapshot types — a compact, ref-indexed accessibility tree for AI agents.
 * Inspired by agent-browser / Playwright MCP: refs are identity-bound (stable
 * per backend node, never reused within a page) so a remembered ref keeps
 * meaning the same element across re-snapshots.
 */
Object.defineProperty(exports, "__esModule", { value: true });
