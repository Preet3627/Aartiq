import { List, Icon, open, getPreferenceValues, useState } from "@raycast/api";
import { closeMainWindow } from "@raycast/utils";

interface Preferences {
  apiKey: string;
  defaultTemplate: string;
  outputPath: string;
}

interface PDFOptions {
  template: string;
  title: string;
  content: string;
}

const templates = [
  { id: "professional", name: "Professional", description: "Clean, business-ready format" },
  { id: "executive", name: "Executive", description: "High-impact executive summary" },
  { id: "academic", name: "Academic", description: "Research paper format" },
  { id: "minimalist", name: "Minimalist", description: "Simple, no-frills design" },
  { id: "dark", name: "Dark Mode", description: "Dark theme document" },
];

export default function PDFCommand() {
  const [content, setContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("professional");
  const prefs = getPreferenceValues<Preferences>();

  const handleCreatePDF = async () => {
    const options: PDFOptions = {
      template: selectedTemplate,
      title: "New Document",
      content: content,
    };
    
    await open(`aartiq://pdf?template=${selectedTemplate}&content=${encodeURIComponent(content)}`);
    await closeMainWindow();
  };

  return (
    <List>
      <List.Section title="Templates">
        {templates.map((t) => (
          <List.Item
            key={t.id}
            title={t.name}
            subtitle={t.description}
            icon={Icon.Document}
            onAction={() => {
              setSelectedTemplate(t.id);
              open(`aartiq://pdf?template=${t.id}`);
              closeMainWindow();
            }}
          />
        ))}
      </List.Section>
      <List.Section title="Recent Documents">
        <List.Item title="Q1 Report" icon={Icon.Document} />
        <List.Item title="Meeting Notes" icon={Icon.Document} />
        <List.Item title="Project Brief" icon={Icon.Document} />
      </List.Section>
      <List.Item
        title="Open PDF Generator"
        subtitle="Full PDF creation interface"
        icon={Icon.Plus}
        onAction={() => {
          open("aartiq://pdf?mode=full");
          closeMainWindow();
        }}
      />
    </List>
  );
}