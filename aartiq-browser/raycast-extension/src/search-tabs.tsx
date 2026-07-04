import React from "react";
import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect } from "react";

interface Tab {
  id: string;
  title: string;
  url: string;
  isActive?: boolean;
  isLoading?: boolean;
}

const RAYCAST_HOST = process.env.RAYCAST_HOST || "127.0.0.1";
const RAYCAST_PORT = process.env.RAYCAST_PORT || "9877";
const RAYCAST_BASE = `http://${RAYCAST_HOST}:${RAYCAST_PORT}/raycast`;

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${RAYCAST_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export default function SearchTabs() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTabs();
  }, []);

  async function loadTabs() {
    setIsLoading(true);
    try {
      const result = await fetchJSON<{ tabs: Tab[] }>("/tabs");
      setTabs(result.tabs || []);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load tabs",
        message: "Is Aartiq Browser running with Raycast support enabled?",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function openTab(url: string) {
    try {
      await fetchJSON("/new-tab", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      await showToast({ style: Toast.Style.Success, title: "Opened in Aartiq" });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open tab",
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search tabs...">
      {tabs.map((tab) => (
        <List.Item
          key={tab.id}
          title={tab.title || "Untitled tab"}
          subtitle={tab.url}
          icon={tab.isActive ? "checkmark" : undefined}
          accessories={[
            { text: tab.isActive ? "Active" : "", tooltip: tab.isLoading ? "Loading" : undefined },
          ]}
          actions={
            <ActionPanel>
              <Action title="Open in Aartiq" onAction={() => openTab(tab.url)} />
              <Action.CopyToClipboard title="Copy URL" content={tab.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
