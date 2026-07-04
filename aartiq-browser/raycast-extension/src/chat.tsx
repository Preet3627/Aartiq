import { List, Icon, showToast, Toast, open } from "@raycast/api";
import { runAppleScript, closeMainWindow } from "@raycast/utils";

export default function ChatCommand() {
  const handleOpenAIChat = async () => {
    try {
      await runAppleScript(`
        tell application "Aartiq"
          activate
          if exists then
            set bounds of window 1 to {100, 100, 800, 700}
          end if
        end tell
      `);
      await closeMainWindow();
    } catch (e) {
      await open("aartiq://chat");
      await closeMainWindow();
    }
  };

  return (
    <List>
      <List.Item
        title="Open AI Chat"
        subtitle="Open the AI chat sidebar"
        icon={Icon.Chat}
        onAction={handleOpenAIChat}
      />
      <List.Item
        title="Quick Question"
        subtitle="Ask a quick question to AI"
        icon={Icon.QuestionMarkCircle}
        onAction={async () => {
          await open("aartiq://chat?mode=quick");
          await closeMainWindow();
        }}
      />
      <List.Item
        title="Search the Web"
        subtitle="Let AI search the web for you"
        icon={Icon.MagnifyingGlass}
        onAction={async () => {
          await open("aartiq://search");
          await closeMainWindow();
        }}
      />
    </List>
  );
}