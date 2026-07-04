import { List, Icon, open, getPreferenceValues } from "@raycast/api";
import { closeMainWindow } from "@raycast/utils";

interface Preferences {
  apiKey: string;
  autoLaunch: boolean;
}

export default function SettingsCommand() {
  const prefs = getPreferenceValues<Preferences>();

  return (
    <List>
      <List.Section title="Quick Settings">
        <List.Item
          title="AI Provider"
          subtitle="Configure AI model"
          icon={Icon.Brain}
          onAction={() => {
            open("aartiq://settings?tab=ai");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Appearance"
          subtitle="Theme and display settings"
          icon={Icon.Paintbrush}
          onAction={() => {
            open("aartiq://settings?tab=appearance");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Permissions"
          subtitle="Command and automation permissions"
          icon={Icon.Shield}
          onAction={() => {
            open("aartiq://settings?tab=permissions");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Sync"
          subtitle="WiFi Sync and cloud settings"
          icon={Icon.Sync}
          onAction={() => {
            open("aartiq://settings?tab=sync");
            closeMainWindow();
          }}
        />
      </List.Section>
      <List.Section title="API Keys">
        <List.Item
          title="OpenAI"
          subtitle="Configure OpenAI API key"
          icon={Icon.Key}
          onAction={() => {
            open("aartiq://settings?key=openai");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Anthropic (Claude)"
          subtitle="Configure Claude API key"
          icon={Icon.Key}
          onAction={() => {
            open("aartiq://settings?key=anthropic");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Google Gemini"
          subtitle="Configure Gemini API key"
          icon={Icon.Key}
          onAction={() => {
            open("aartiq://settings?key=gemini");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Ollama"
          subtitle="Configure local Ollama"
          icon={Icon.Desktop}
          onAction={() => {
            open("aartiq://settings?key=ollama");
            closeMainWindow();
          }}
        />
      </List.Section>
      <List.Section title="Advanced">
        <List.Item
          title="Extensions"
          subtitle="Browser extensions"
          icon={Icon.Extension}
          onAction={() => {
            open("aartiq://extensions");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Plugins"
          subtitle="AI plugins and MCP servers"
          icon={Icon.Plug}
          onAction={() => {
            open("aartiq://settings?tab=plugins");
            closeMainWindow();
          }}
        />
        <List.Item
          title="Automation Workflows"
          subtitle="Manage automation workflows"
          icon={Icon.Gear}
          onAction={() => {
            open("aartiq://automation");
            closeMainWindow();
          }}
        />
      </List.Section>
    </List>
  );
}
