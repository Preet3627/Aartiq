/**
 * Snapshot types — a compact, ref-indexed accessibility tree for AI agents.
 * Inspired by agent-browser / Playwright MCP: refs are identity-bound (stable
 * per backend node, never reused within a page) so a remembered ref keeps
 * meaning the same element across re-snapshots.
 */

export type AxRole = string;

export interface RawAxNode {
  role: AxRole;
  name?: string;
  value?: string;
  description?: string;
  states?: string[];
  attributes?: Record<string, string>;
  backendNodeId?: string | number;
  selector?: string;
  href?: string;
  children?: RawAxNode[];
}

export interface SnapshotNode {
  ref: string;
  role: AxRole;
  name: string;
  value?: string;
  description?: string;
  href?: string;
  interactive: boolean;
  depth: number;
  backendNodeId?: string | number;
  selector?: string;
  children: SnapshotNode[];
}

export interface SnapshotOptions {
  interactiveOnly?: boolean;
  compact?: boolean;
  depth?: number;
  scopeSelector?: string;
}

export interface SnapshotResult {
  nodes: SnapshotNode[];
  refs: Record<string, SnapshotNode>;
  text: string;
}
