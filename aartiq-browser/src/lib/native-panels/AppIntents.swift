import Foundation
import AppIntents
import SwiftUI

// MARK: - Entities

@available(macOS 13.0, *)
struct AartiqPanelEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Aartiq Panel"
    static var defaultQuery = AartiqPanelQuery()
    
    let id: String
    let name: String
    let symbol: String
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "Aartiq Panel", image: .init(systemName: symbol))
    }
}

@available(macOS 13.0, *)
struct AartiqPanelQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AartiqPanelEntity] {
        return allPanels().filter { identifiers.contains($0.id) }
    }
    
    func suggestedEntities() async throws -> [AartiqPanelEntity] {
        return allPanels()
    }
    
    private func allPanels() -> [AartiqPanelEntity] {
        [
            AartiqPanelEntity(id: "sidebar", name: "Sidebar", symbol: "sparkles.rectangle.stack"),
            AartiqPanelEntity(id: "menu", name: "Command Center", symbol: "square.grid.2x2"),
            AartiqPanelEntity(id: "apple-ai", name: "Apple Intelligence", symbol: "appleintelligence"),
            AartiqPanelEntity(id: "action-chain", name: "Action Chain", symbol: "point.3.filled.connected.trianglepath.dotted"),
            AartiqPanelEntity(id: "downloads", name: "Downloads", symbol: "arrow.down.circle"),
            AartiqPanelEntity(id: "clipboard", name: "Clipboard", symbol: "doc.on.clipboard"),
            AartiqPanelEntity(id: "settings", name: "Settings", symbol: "slider.horizontal.3")
        ]
    }
}

// MARK: - Intents

@available(macOS 13.0, *)
struct AartiqConversationEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Aartiq Conversation"
    static var defaultQuery = AartiqConversationQuery()
    
    let id: String
    let title: String
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

@available(macOS 13.0, *)
struct AartiqConversationQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AartiqConversationEntity] {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        let state = try? await bridge.getState()
        return (state?.conversations ?? []).filter { identifiers.contains($0.id) }.map {
            AartiqConversationEntity(id: $0.id, title: $0.title)
        }
    }
    
    func suggestedEntities() async throws -> [AartiqConversationEntity] {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        let state = try? await bridge.getState()
        return (state?.conversations ?? []).prefix(10).map {
            AartiqConversationEntity(id: $0.id, title: $0.title)
        }
    }
}

// MARK: - Intents

@available(macOS 13.0, *)
struct AskAartiqIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Aartiq"
    static var description = IntentDescription("Send a prompt to Aartiq and get a response.")
    
    @Parameter(title: "Prompt", description: "What do you want to ask Aartiq?")
    var prompt: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Ask Aartiq \(\.$prompt)")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let result = try await bridge.sendPrompt(prompt)
            // HIG: Attribution and assessing accuracy
            return .result(value: result, dialog: "Aartiq generated this response: \(result)")
        } catch {
            return .result(value: "Connection error", dialog: "I couldn't connect to Aartiq right now.")
        }
    }
}

@available(macOS 13.0, *)
struct RefineAartiqResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Refine Aartiq Response"
    static var description = IntentDescription("Ask Aartiq to change the style or length of the last response.")
    
    @Parameter(title: "Instruction", description: "e.g., 'Make it shorter', 'More professional', 'Explain like I'm 5'")
    var instruction: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Refine response: \(\.$instruction)")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let result = try await bridge.sendPrompt("Please refine your previous response with this instruction: \(instruction)")
            return .result(value: result, dialog: "Here is the refined response from Aartiq: \(result)")
        } catch {
            return .result(value: "Error", dialog: "I couldn't refine the response right now.")
        }
    }
}

@available(macOS 13.0, *)
struct RegenerateAartiqResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Regenerate Aartiq Response"
    static var description = IntentDescription("Ask Aartiq to try answering the last prompt again.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            _ = try await bridge.conversationAction("regenerate")
            // Wait for new response
            try await Task.sleep(nanoseconds: 1_000_000_000)
            let result = try await bridge.waitForResponse()
            return .result(value: result, dialog: "Aartiq regenerated the response: \(result)")
        } catch {
            return .result(value: "Error", dialog: "I couldn't regenerate the response.")
        }
    }
}

@available(macOS 13.0, *)
struct ReadLatestAartiqResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Read Latest Aartiq Response"
    static var description = IntentDescription("Hear the last message sent by Aartiq.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let state = try await bridge.getState()
            if let lastModelMsg = state.messages.last(where: { $0.role == "model" }) {
                return .result(value: lastModelMsg.content, dialog: "Aartiq's latest response was: \(lastModelMsg.content)")
            } else {
                return .result(value: "No messages found.", dialog: "I couldn't find any recent responses from Aartiq.")
            }
        } catch {
            return .result(value: "Connection error", dialog: "I couldn't access Aartiq to read the response.")
        }
    }
}

@available(macOS 13.0, *)
struct SearchWebIntent: AppIntent {
    static var title: LocalizedStringResource = "Search Web with Aartiq"
    static var description = IntentDescription("Perform an AI-powered web search.")
    
    @Parameter(title: "Query", description: "What do you want to search for?")
    var query: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Search for \(\.$query) in Aartiq")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        let result = try await bridge.sendPrompt("Search the web for: \(query)")
        return .result(value: result, dialog: "Search results from Aartiq: \(result)")
    }
}

@available(macOS 13.0, *)
struct SetModelIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Aartiq Model"
    static var description = IntentDescription("Change the active AI model.")
    
    @Parameter(title: "Model", description: "e.g., GPT-4, Claude 3, Gemini Pro")
    var model: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Set Aartiq model to \(\.$model)")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try await bridge.post("/native-mac-ui/preferences", body: ["activeModel": model])
        return .result(dialog: "Aartiq model set to \(model).")
    }
}

@available(macOS 13.0, *)
struct CaptureScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture Aartiq Screenshot"
    static var description = IntentDescription("Take a screenshot of the current browser page.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        let data = try await bridge.post("/native-mac-ui/screenshot", body: [:])
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let path = json["path"] as? String {
            return .result(value: path, dialog: "Screenshot captured and saved to Downloads.")
        }
        throw NSError(domain: "AartiqBridge", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to capture screenshot"])
    }
}

@available(macOS 13.0, *)
struct CreateDocumentIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Document with Aartiq"
    static var description = IntentDescription("Generate a PDF, Excel, or PowerPoint document.")
    
    @Parameter(title: "Format", default: "pdf")
    var format: String
    
    @Parameter(title: "Topic", description: "What should the document be about?")
    var topic: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Create \(\.$format) about \(\.$topic) in Aartiq")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try await bridge.sendPrompt("Generate a \(format) document about: \(topic)")
        return .result(dialog: "Aartiq is generating your \(format) document.")
    }
}

@available(macOS 13.0, *)
struct ResetAartiqChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Reset Aartiq Chat"
    static var description = IntentDescription("Clear the current conversation context.")
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try? await bridge.conversationAction("new")
        return .result(dialog: "Aartiq chat context has been reset.")
    }
}

@available(macOS 13.0, *)
struct SummarizeCurrentPageIntent: AppIntent {
    static var title: LocalizedStringResource = "Summarize Page in Aartiq"
    static var description = IntentDescription("Summarize the content of the currently active browser page.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let summary = try await bridge.summarizePage()
            return .result(value: summary, dialog: "Here is a summary generated by Aartiq: \(summary)")
        } catch {
            return .result(value: "Failed to summarize", dialog: "I couldn't summarize the page.")
        }
    }
}

@available(macOS 13.0, *)
struct OpenAartiqPanelIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Aartiq Panel"
    static var description = IntentDescription("Open a specific Aartiq interface.")
    
    @Parameter(title: "Panel")
    var panel: AartiqPanelEntity
    
    static var parameterSummary: some ParameterSummary {
        Summary("Open Aartiq \(\.$panel)")
    }
    
    @MainActor
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try? await bridge.openPanel(panel.id)
        return .result(dialog: "Opening \(panel.name).")
    }
}

@available(macOS 13.0, *)
struct ListAartiqConversationsIntent: AppIntent {
    static var title: LocalizedStringResource = "List Aartiq Conversations"
    static var description = IntentDescription("Show a list of your recent Aartiq conversations.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<[AartiqConversationEntity]> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let state = try await bridge.getState()
            let conversations = (state.conversations ?? []).map {
                AartiqConversationEntity(id: $0.id, title: $0.title)
            }
            
            if conversations.isEmpty {
                return .result(value: [], dialog: "You don't have any recent conversations in Aartiq.")
            }
            
            let titles = conversations.map { $0.title }.joined(separator: ", ")
            return .result(value: conversations, dialog: "You have \(conversations.count) recent conversations: \(titles)")
        } catch {
            return .result(value: [], dialog: "I couldn't list your conversations right now.")
        }
    }
}

@available(macOS 13.0, *)
struct OpenAartiqConversationIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Aartiq Conversation"
    static var description = IntentDescription("Open a specific chat session in Aartiq.")
    
    @Parameter(title: "Conversation")
    var conversation: AartiqConversationEntity
    
    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$conversation) in Aartiq")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try? await bridge.conversationAction("load", id: conversation.id)
        _ = try? await bridge.openPanel("sidebar")
        return .result(dialog: "Opening your conversation \"\(conversation.title)\".")
    }
}


@available(macOS 13.0, *)
struct NewAartiqChatIntent: AppIntent {
    static var title: LocalizedStringResource = "New Aartiq Chat"
    static var description = IntentDescription("Start a fresh conversation with Aartiq.")
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try? await bridge.conversationAction("new")
        _ = try? await bridge.openPanel("sidebar")
        return .result(dialog: "Started a new conversation.")
    }
}

@available(macOS 13.0, *)
struct RunAartiqCommandIntent: AppIntent {
    static var title: LocalizedStringResource = "Run Command in Aartiq"
    static var description = IntentDescription("Execute a shell command via Aartiq.")
    
    @Parameter(title: "Command")
    var command: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Run \(\.$command) in Aartiq")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        // Commands are sensitive, we send them as prompts for AI to handle with permission UI
        _ = try await bridge.sendPrompt("Run this shell command: \(command)")
        return .result(dialog: "Executing command via Aartiq. Please check for permission prompts if required.")
    }
}

// MARK: - What Can You Do Intent

@available(macOS 13.0, *)
struct WhatCanAartiqDoIntent: AppIntent {
    static var title: LocalizedStringResource = "What Can Aartiq Do"
    static var description = IntentDescription("Learn about all the things Aartiq can help you with.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let capabilities = """
        Aartiq can help you with many tasks:

        🤖 AI Conversations - Ask questions, get help with coding, writing, or any topic

        🔍 Smart Search - Search the web with AI-powered results

        📄 Create Documents - Generate PDFs, Excel, and PowerPoint files

        💻 Run Commands - Execute terminal commands safely

        📸 Screenshot - Capture screenshots of your current page

        📧 Read & Write Email - Manage your Gmail through voice

        🎯 Automate Tasks - Schedule recurring AI tasks

        🔊 Control Volume - Adjust system audio

        📱 Open Apps - Launch applications by name

        💬 Voice Chat - Talk to AI hands-free

        📖 Summarize Pages - Get quick summaries of any webpage

        💬 Chat Management - Start new chats, view past conversations

        Just say "Ask Aartiq [your question]" to get started!
        """
        
        return .result(value: capabilities, dialog: "Aartiq is your AI-powered browser assistant. You can ask questions, create documents, search the web, run commands, and much more using voice or the Shortcuts app.")
    }
}

// MARK: - Volume Control Intent

@available(macOS 13.0, *)
struct SetVolumeIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Aartiq Volume"
    static var description = IntentDescription("Adjust system volume through Aartiq.")
    
    @Parameter(title: "Volume Level", description: "0-100")
    var level: Int
    
    static var parameterSummary: some ParameterSummary {
        Summary("Set volume to \(\.$level) percent")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try await bridge.post("/native-mac-ui/volume", body: ["level": level])
        return .result(dialog: "Volume set to \(level) percent.")
    }
}

// MARK: - Open App Intent

@available(macOS 13.0, *)
struct OpenApplicationIntent: AppIntent {
    static var title: LocalizedStringResource = "Open App with Aartiq"
    static var description = IntentDescription("Open an application using Aartiq.")
    
    @Parameter(title: "Application Name", description: "e.g., Safari, Notes, VS Code")
    var appName: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$appName) with Aartiq")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try await bridge.openApp(appName)
        return .result(dialog: "Opening \(appName).")
    }
}

// MARK: - Schedule Task Intent

@available(macOS 13.0, *)
struct ScheduleAartiqTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Schedule Aartiq Task"
    static var description = IntentDescription("Schedule an AI task to run automatically.")
    
    @Parameter(title: "Task", description: "What should the AI do?")
    var task: String
    
    @Parameter(title: "Schedule", description: "e.g., daily, hourly, at 8am")
    var schedule: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Schedule \(\.$task) \(\.$schedule)")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        _ = try await bridge.sendPrompt("Schedule this task: \(task). Run it: \(schedule)")
        return .result(dialog: "Your task has been scheduled for \(schedule).")
    }
}

// MARK: - Get Clipboard Intent

@available(macOS 13.0, *)
struct GetClipboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Read Aartiq Clipboard"
    static var description = IntentDescription("Read the current clipboard content from Aartiq.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = AartiqBridgeClient(config: config)
        
        do {
            let data = try await bridge.get("/native-mac-ui/clipboard")
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let content = json["content"] as? String {
                let preview = String(content.prefix(100))
                 return .result(value: content, dialog: "Clipboard contains: \(preview)")
            }
            return .result(value: "Clipboard is empty", dialog: "The clipboard appears to be empty.")
        } catch {
            return .result(value: "Error reading clipboard", dialog: "Couldn't read the clipboard.")
        }
    }
}

// MARK: - Shortcuts Provider

@available(macOS 13.0, *)
struct AartiqShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskAartiqIntent(),
            phrases: [
                "Ask \(.applicationName) \(\.$prompt)",
                "Tell \(.applicationName) \(\.$prompt)",
                "Query \(.applicationName) \(\.$prompt)"
            ],
            shortTitle: "Ask Aartiq",
            systemImageName: "sparkles"
        )
        
        AppShortcut(
            intent: RefineAartiqResponseIntent(),
            phrases: [
                "Refine \(.applicationName) response",
                "Make \(.applicationName) response \(\.$instruction)",
                "Change \(.applicationName) response"
            ],
            shortTitle: "Refine Response",
            systemImageName: "wand.and.stars"
        )
        
        AppShortcut(
            intent: RegenerateAartiqResponseIntent(),
            phrases: [
                "Regenerate \(.applicationName) response",
                "Try again in \(.applicationName)",
                "Redo \(.applicationName) response"
            ],
            shortTitle: "Regenerate",
            systemImageName: "arrow.clockwise"
        )
        
        AppShortcut(
            intent: SearchWebIntent(),
            phrases: [
                "Search web with \(.applicationName) for \(\.$query)",
                "Find \(\.$query) using \(.applicationName)",
                "Look up \(\.$query) in \(.applicationName)"
            ],
            shortTitle: "Smart Search",
            systemImageName: "magnifyingglass.circle"
        )
        
        AppShortcut(
            intent: SetModelIntent(),
            phrases: [
                "Switch \(.applicationName) model to \(\.$model)",
                "Use \(\.$model) in \(.applicationName)",
                "Change \(.applicationName) engine to \(\.$model)"
            ],
            shortTitle: "Switch Model",
            systemImageName: "cpu"
        )
        
        AppShortcut(
            intent: CreateDocumentIntent(),
            phrases: [
                "Create a \(\.$format) in \(.applicationName) about \(\.$topic)",
                "Generate \(\.$format) on \(\.$topic) with \(.applicationName)"
            ],
            shortTitle: "Create Document",
            systemImageName: "doc.badge.plus"
        )
        
        AppShortcut(
            intent: ReadLatestAartiqResponseIntent(),
            phrases: [
                "What did \(.applicationName) say?",
                "Read latest response from \(.applicationName)",
                "Last message in \(.applicationName)"
            ],
            shortTitle: "Read Response",
            systemImageName: "speaker.wave.2"
        )
        
        AppShortcut(
            intent: SummarizeCurrentPageIntent(),
            phrases: [
                "Summarize this page with \(.applicationName)",
                "Summarize page in \(.applicationName)",
                "What is this page about in \(.applicationName)"
            ],
            shortTitle: "Summarize Page",
            systemImageName: "doc.text.magnifyingglass"
        )
        
        AppShortcut(
            intent: ListAartiqConversationsIntent(),
            phrases: [
                "List my conversations in \(.applicationName)",
                "Show my recent chats in \(.applicationName)",
                "What are my chats in \(.applicationName)"
            ],
            shortTitle: "List Chats",
            systemImageName: "list.bullet.rectangle.portrait"
        )
        
        AppShortcut(
            intent: OpenAartiqConversationIntent(),
            phrases: [
                "Open my \(\.$conversation) in \(.applicationName)",
                "Show \(\.$conversation) in \(.applicationName)"
            ],
            shortTitle: "Open Conversation",
            systemImageName: "bubble.left.and.bubble.right"
        )
        
        AppShortcut(
            intent: NewAartiqChatIntent(),
            phrases: [
                "New chat in \(.applicationName)",
                "Start new conversation with \(.applicationName)"
            ],
            shortTitle: "New Chat",
            systemImageName: "plus.bubble"
        )
        
        AppShortcut(
            intent: WhatCanAartiqDoIntent(),
            phrases: [
                "What can you do with \(.applicationName)",
                "What can \(.applicationName) do",
                "Tell me about \(.applicationName)",
                "How does \(.applicationName) work",
                "Show me \(.applicationName) features"
            ],
            shortTitle: "What Can It Do",
            systemImageName: "questionmark.circle"
        )
        
        AppShortcut(
            intent: SetVolumeIntent(),
            phrases: [
                "Set volume to \(\.$level) in \(.applicationName)",
                "Volume \(\.$level) in \(.applicationName)",
                "Change \(.applicationName) volume to \(\.$level)"
            ],
            shortTitle: "Set Volume",
            systemImageName: "speaker.wave.3"
        )
        
        AppShortcut(
            intent: OpenApplicationIntent(),
            phrases: [
                "Open \(\.$appName) with \(.applicationName)",
                "Launch \(\.$appName) via \(.applicationName)",
                "Start \(\.$appName) in \(.applicationName)"
            ],
            shortTitle: "Open App",
            systemImageName: "app.badge"
        )
        
        AppShortcut(
            intent: ScheduleAartiqTaskIntent(),
            phrases: [
                "Schedule \(\.$task) \(\.$schedule) in \(.applicationName)",
                "Set up \(\.$task) \(\.$schedule) with \(.applicationName)",
                "Remind me to \(\.$task) \(\.$schedule) using \(.applicationName)"
            ],
            shortTitle: "Schedule Task",
            systemImageName: "calendar.badge.clock"
        )
        
        AppShortcut(
            intent: GetClipboardIntent(),
            phrases: [
                "Read clipboard in \(.applicationName)",
                "What's on my clipboard in \(.applicationName)",
                "Show clipboard from \(.applicationName)"
            ],
            shortTitle: "Read Clipboard",
            systemImageName: "doc.on.clipboard"
        )
        
        AppShortcut(
            intent: CaptureScreenshotIntent(),
            phrases: [
                "Take screenshot with \(.applicationName)",
                "Screenshot in \(.applicationName)",
                "Capture screen in \(.applicationName)"
            ],
            shortTitle: "Screenshot",
            systemImageName: "camera.viewfinder"
        )
        
        AppShortcut(
            intent: ResetAartiqChatIntent(),
            phrases: [
                "Reset \(.applicationName) chat",
                "Clear \(.applicationName) conversation",
                "New chat in \(.applicationName)"
            ],
            shortTitle: "Reset Chat",
            systemImageName: "trash"
        )
    }
}

// MARK: - Bridge Client Helper

class AartiqBridgeClient {
    let config: LaunchConfiguration
    
    init(config: LaunchConfiguration) {
        self.config = config
    }
    
    func waitForResponse() async throws -> String {
        var attempts = 0
        while attempts < 30 {
            try await Task.sleep(nanoseconds: 1_000_000_000)
            let state = try await getState()
            if !state.isLoading && !state.messages.isEmpty {
                if let last = state.messages.last, last.role == "model" {
                    return last.content
                }
            }
            attempts += 1
        }
        let state = try await getState()
        return state.messages.last?.content ?? "Response timed out."
    }
    
    func sendPrompt(_ prompt: String) async throws -> String {
        let body: [String: Any] = ["prompt": prompt, "source": "siri-intent"]
        _ = try await post("/native-mac-ui/prompt", body: body)
        return try await waitForResponse()
    }
    
    func summarizePage() async throws -> String {
        let data = try await get("/native-mac-ui/summarize-page")
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let content = json["content"] as? String {
            return try await sendPrompt("Summarize this concisely: \(content)")
        }
        throw NSError(domain: "AartiqBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to extract page"])
    }
    
    func openPanel(_ mode: String) async throws -> Bool {
        let body: [String: Any] = ["mode": mode, "relaunchIfRunning": true]
        _ = try await post("/native-mac-ui/panels/open", body: body)
        return true
    }
    
    func conversationAction(_ action: String, id: String? = nil) async throws -> Bool {
        var body: [String: Any] = ["action": action]
        if let id { body["id"] = id }
        _ = try await post("/native-mac-ui/conversations/action", body: body)
        return true
    }
    
    func openApp(_ appName: String) async throws -> Bool {
        let body: [String: Any] = ["appName": appName]
        _ = try await post("/native-mac-ui/open-app", body: body)
        return true
    }
    
    func getState() async throws -> NativePanelState {
        let data = try await get("/native-mac-ui/state?mode=sidebar")
        let envelope = try JSONDecoder().decode(BridgeStateEnvelope.self, from: data)
        if let state = envelope.state { return state }
        throw NSError(domain: "AartiqBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "No state returned"])
    }
    
    func get(_ path: String) async throws -> Data {
        let url = url(path: path)
        var request = URLRequest(url: url)
        request.addValue(config.token, forHTTPHeaderField: "X-Aartiq-Native-Token")
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }
    
    func post(_ path: String, body: [String: Any]) async throws -> Data {
        let url = url(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(config.token, forHTTPHeaderField: "X-Aartiq-Native-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }
    
    private func url(path: String) -> URL {
        let normalizedBase = config.bridgeURL.absoluteString.hasSuffix("/") ? config.bridgeURL.absoluteString : config.bridgeURL.absoluteString + "/"
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return URL(string: normalizedPath, relativeTo: URL(string: normalizedBase))!.absoluteURL
    }
}


