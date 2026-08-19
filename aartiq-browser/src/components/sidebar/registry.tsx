"use client";

import React from "react";
import type { WidgetId } from "./types";
import CurrentTaskWidget from "./widgets/CurrentTaskWidget";
import LiveActivityWidget from "./widgets/LiveActivityWidget";
import GoalIntentWidget from "./widgets/GoalIntentWidget";
import WorkspaceWidget from "./widgets/WorkspaceWidget";
import MemoryInsightsWidget from "./widgets/MemoryInsightsWidget";
import AISuggestionsWidget from "./widgets/AISuggestionsWidget";
import NeedsAttentionWidget from "./widgets/NeedsAttentionWidget";
import AutomationMonitorWidget from "./widgets/AutomationMonitorWidget";

/** id → component. Every component reads live data via useSidebarData(). */
export const WIDGET_COMPONENTS: Record<WidgetId, React.ComponentType> = {
  "current-task": CurrentTaskWidget,
  "live-activity": LiveActivityWidget,
  "goal-intent": GoalIntentWidget,
  workspace: WorkspaceWidget,
  "memory-insights": MemoryInsightsWidget,
  "ai-suggestions": AISuggestionsWidget,
  "needs-attention": NeedsAttentionWidget,
  "automation-monitor": AutomationMonitorWidget,
};
