"use client";

import React, { createContext, useContext } from "react";
import type { ActionChainStep } from "@/components/ai/ActionChainTimeline";
import type { TabInfo, HistoryEntry } from "@/lib/homeIntelligence";

export type AttentionType =
  | "permission"
  | "login"
  | "confirmation"
  | "paused"
  | "failed"
  | "info";

export interface NeedsAttentionItem {
  id: string;
  type: AttentionType;
  title: string;
  detail?: string;
  severity?: "info" | "warning" | "error";
  actionLabel?: string;
  onAction?: () => void;
}

export interface SidebarData {
  agentState: string;
  currentTask?: string;
  progress?: number; // 0..1
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  actionChainSteps: ActionChainStep[];
  goal?: { text: string; confidence?: number; constraints?: string[] };
  needsAttention: NeedsAttentionItem[];
  tabs: TabInfo[];
  activeTabId?: string;
  history?: HistoryEntry[];
  onAction: (cmd: string) => void;
  isWorking?: boolean;
  sessionLabel?: string;
  showSecondaryInfo?: boolean;
}

const DEFAULT_DATA: SidebarData = {
  agentState: "idle",
  actionChainSteps: [],
  needsAttention: [],
  tabs: [],
  onAction: () => {},
};

export const SidebarDataContext = createContext<SidebarData>(DEFAULT_DATA);

export function useSidebarData(): SidebarData {
  return useContext(SidebarDataContext);
}

export const SidebarDataProvider = SidebarDataContext.Provider;
