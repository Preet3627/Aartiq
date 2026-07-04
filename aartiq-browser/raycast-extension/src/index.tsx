import { List, Icon, open, showHUD } from "@raycast/api";
import { closeMainWindow } from "@raycast/utils";

export default function IndexCommand() {
  const handleOpenComet = async () => {
    try {
      await open("aartiq-browser://");
      await closeMainWindow();
    } catch {
      await showHUD("Aartiq not installed");
    }
  };

  return (
    <List>
      <List.Item
        title="Open Aartiq"
        subtitle="Launch the AI-powered browser"
        icon={Icon.Globe}
        onAction={handleOpenAartiq}
      />
      <List.Item
        title="AI Chat"
        subtitle="Open AI chat sidebar"
        icon={Icon.Chat}
        onAction={() => {
          open("aartiq-browser://chat");
          closeMainWindow();
        }}
      />
      <List.Item
        title="Quick Browse"
        subtitle="Navigate to URL or search"
        icon={Icon.MagnifyingGlass}
        onAction={() => {
          open("aartiq-browser://browse");
          closeMainWindow();
        }}
      />
      <List.Item
        title="Screen OCR"
        subtitle="Capture and extract screen text"
        icon={Icon.Eye}
        onAction={() => {
          open("aartiq-browser://ocr");
          closeMainWindow();
        }}
      />
      <List.Item
        title="Create PDF"
        subtitle="Generate PDF documents"
        icon={Icon.Document}
        onAction={() => {
          open("aartiq-browser://pdf");
          closeMainWindow();
        }}
      />
      <List.Item
        title="Automations"
        subtitle="Run automation workflows"
        icon={Icon.Gear}
        onAction={() => {
          open("aartiq-browser://automation");
          closeMainWindow();
        }}
      />
      <List.Item
        title="Settings"
        subtitle="Configure Aartiq"
        icon={Icon.Sliders}
        onAction={() => {
          open("aartiq-browser://settings");
          closeMainWindow();
        }}
      />
    </List>
  );
}