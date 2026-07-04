import { List, Icon, open, useState } from "@raycast/api";
import { closeMainWindow, runAppleScript, showHUD } from "@raycast/utils";

interface Automation {
  id: string;
  name: string;
  description: string;
  schedule?: string;
}

const automations: Automation[] = [
  { id: "daily-brief", name: "Daily Brief", description: "Morning news summary", schedule: "8:00 AM" },
  { id: "weekly-report", name: "Weekly Report", description: "Generate weekly status report", schedule: "Friday 5 PM" },
  { id: "screenshot-archive", name: "Screenshot Archive", description: "Auto-organize screenshots", schedule: "Daily" },
  { id: "bookmark-sync", name: "Bookmark Sync", description: "Sync browser bookmarks", schedule: "Every hour" },
];

export default function AutomationCommand() {
  const [search, setSearch] = useState("");

  const filteredAutomations = automations.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
  );

  const runAutomation = async (automation: Automation) => {
    try {
      await runAppleScript(`
        tell application "Aartiq"
          activate
        end tell
      `);
      await open(`aartiq://automation/${automation.id}/run`);
      await showHUD(`Running "${automation.name}"...`);
      await closeMainWindow();
    } catch (e) {
      await open(`aartiq://automation/${automation.id}/run`);
      await closeMainWindow();
    }
  };

  return (
    <List searchBarPlaceholder="Search automations..." onSearchTextChange={setSearch}>
      <List.Section title="Run Automation">
        {filteredAutomations.map((a) => (
          <List.Item
            key={a.id}
            title={a.name}
            subtitle={a.description}
            icon={Icon.Play}
            onAction={() => runAutomation(a)}
          />
        ))}
      </List.Section>
      <List.Section title="Manage">
        <List.Item
          title="View All Automations"
          subtitle="Open automation dashboard"
          icon={Icon.List}
          onAction={() => {
            open("aartiq://automation");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Create New Automation"
          subtitle="Build a custom automation"
          icon={Icon.Plus}
          onAction={() => {
            open("aartiq://automation/new");
            closeMainWindow();
          }}
        />
      </List.Section>
      <List.Section title="Schedules">
        {automations
          .filter((a) => a.schedule)
          .map((a) => (
            <List.Item
              key={`schedule-${a.id}`}
              title={a.schedule || ""}
              subtitle={a.name}
              icon={Icon.Clock}
            />
          ))}
      </List.Section>
    </List>
  );
}