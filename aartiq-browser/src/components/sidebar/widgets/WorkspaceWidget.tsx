"use client";

import React, { memo } from "react";
import { useSidebarData } from "../SidebarContext";
import WorkspaceIntelligenceWidget from "./home/WorkspaceIntelligenceWidget";
import SessionResumeWidget from "./home/SessionResumeWidget";

const WorkspaceWidget = memo(function WorkspaceWidget() {
  const { tabs, activeTabId, history, onAction, showSecondaryInfo } = useSidebarData();

  return (
    <div className="space-y-3">
      <WorkspaceIntelligenceWidget tabs={tabs} onAction={onAction} />
      {showSecondaryInfo && (
        <SessionResumeWidget history={history ?? []} onAction={onAction} />
      )}
    </div>
  );
});

export default WorkspaceWidget;
