/**
 * AgentRegistry — live multi-agent session registry for one browser.
 *
 * Tracks connected agents (MCP clients, remote agents, in-product assistants),
 * their trust, and coordinates tab locks via TabLockManager. This is the
 * coordination layer that lets "multiple agents connected to the same browser at
 * once" operate without stepping on each other.
 */

import { AgentTrustRegistry } from '../guardrails/agent-trust';
import type { RegisteredAgent, RegisterAgentInput, TrustLevel } from '../guardrails/agent-trust';
import { TabLockManager } from './tab-lock';
import type { Verb } from '../guardrails/origin-guard';

export interface AgentConnection {
  id: string;
  transport: 'mcp' | 'http' | 'websocket' | 'in-product';
  remote?: boolean;
  userAgent?: string;
  pairedAt: number;
}

export class AgentRegistry {
  readonly trust: AgentTrustRegistry;
  readonly locks: TabLockManager;
  private connections = new Map<string, AgentConnection>();

  constructor(trust?: AgentTrustRegistry) {
    this.trust = trust ?? new AgentTrustRegistry();
    this.locks = new TabLockManager();
  }

  /** Register an agent and open a connection. Default trust = limited. */
  connect(input: RegisterAgentInput & { transport?: AgentConnection['transport']; remote?: boolean; userAgent?: string }): RegisteredAgent {
    const agent = this.trust.register({ id: input.id, name: input.name, trust: input.trust, capabilities: input.capabilities });
    this.connections.set(input.id, {
      id: input.id,
      transport: input.transport ?? 'mcp',
      remote: input.remote ?? false,
      userAgent: input.userAgent,
      pairedAt: Date.now(),
    });
    return agent;
  }

  disconnect(agentId: string): void {
    this.locks.releaseAllForAgent(agentId);
    this.connections.delete(agentId);
    // Keep the trust record for behavioral history, but revoke live access.
    const a = this.trust.get(agentId);
    if (a) this.trust.revoke(agentId, 'disconnected');
  }

  getConnection(agentId: string): AgentConnection | undefined {
    return this.connections.get(agentId);
  }

  connectedAgents(): AgentConnection[] {
    return [...this.connections.values()];
  }

  /** Convenience: gate an action for a connected agent (trust + tab lock). */
  async authorize(agentId: string, tabId: string, verb: Verb, origin?: string): Promise<{ ok: boolean; reason: string; heldBy?: string | null }> {
    const agent = this.trust.get(agentId);
    if (!agent || agent.revoked) return { ok: false, reason: 'Agent not connected or revoked.' };
    if (!this.trust.can(agentId, verb, origin)) {
      return { ok: false, reason: `Agent "${agent.trust}" cannot perform "${verb}".` };
    }
    const heldBy = this.locks.ownerOf(tabId);
    if (heldBy && heldBy !== agentId) {
      return { ok: false, reason: 'Tab is locked by another agent.', heldBy };
    }
    return { ok: true, reason: 'authorized' };
  }

  /** Acquire a tab lock as part of authorizing an action. */
  lockTab(tabId: string, agentId: string, ttlMs?: number): { ok: boolean; heldBy?: string; reason?: string } {
    return this.locks.acquire({ tabId, agentId, ttlMs });
  }
}

export type { TrustLevel };
