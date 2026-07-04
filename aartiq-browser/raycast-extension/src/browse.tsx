import { List, Icon, showToast, Toast, open, getPreferenceValues } from "@raycast/api";
import { useState } from "react";
import { runAppleScript, closeMainWindow } from "@raycast/utils";

interface Preferences {
  apiKey: string;
}

export default function BrowseCommand() {
  const [query, setQuery] = useState("");
  const prefs = getPreferenceValues<Preferences>();

  const handleNavigate = async (url: string) => {
    try {
      await runAppleScript(`
        tell application "Aartiq"
          activate
          if exists then
            tell application "System Events"
              tell process "Aartiq"
                keystroke "n" using command down
              end tell
            end tell
          end if
        end tell
      `);
      await open(`aartiq://navigate?url=${encodeURIComponent(url)}`);
      await closeMainWindow();
    } catch {
      await open(`aartiq://navigate?url=${encodeURIComponent(url)}`);
      await closeMainWindow();
    }
  };

  return (
    <List
      searchBarPlaceholder="Enter URL or search query..."
      onSearchTextChange={setQuery}
    >
      <List.Item
        title="Go to URL"
        subtitle={query || "Enter a URL"}
        icon={Icon.Globe}
        onAction={() => {
          const url = query.startsWith("http") ? query : `https://${query}`;
          handleNavigate(url);
        }}
      />
      <List.Item
        title="Search Google"
        subtitle={`Search "${query}" on Google`}
        icon={Icon.MagnifyingGlass}
        onAction={() => {
          const url = `https://google.com/search?q=${encodeURIComponent(query)}`;
          handleNavigate(url);
        }}
      />
      <List.Item
        title="Quick Actions"
        subtitle="Common navigation shortcuts"
        icon={Icon.Lightning}
      >
        <List.Item title="YouTube" icon={Icon.Video} onAction={() => handleNavigate("https://youtube.com")} />
        <List.Item title="GitHub" icon={Icon.GitHub} onAction={() => handleNavigate("https://github.com")} />
        <List.Item title="Twitter/X" icon={Icon.At} onAction={() => handleNavigate("https://twitter.com")} />
        <List.Item title="Reddit" icon={Icon.Comment} onAction={() => handleNavigate("https://reddit.com")} />
      </List.Item>
    </List>
  );
}