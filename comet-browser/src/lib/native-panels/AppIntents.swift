import Foundation
import AppIntents
import SwiftUI

// MARK: - Entities

@available(macOS 13.0, *)
struct CometPanelEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Comet Panel"
    static var defaultQuery = CometPanelQuery()
    
    let id: String
    let name: String
    let symbol: String
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "Comet AI Panel", image: .init(systemName: symbol))
    }
}

@available(macOS 13.0, *)
struct CometPanelQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CometPanelEntity] {
        return allPanels().filter { identifiers.contains($0.id) }
    }
    
    func suggestedEntities() async throws -> [CometPanelEntity] {
        return allPanels()
    }
    
    private func allPanels() -> [CometPanelEntity] {
        [
            CometPanelEntity(id: "sidebar", name: "Sidebar", symbol: "sparkles.rectangle.stack"),
            CometPanelEntity(id: "menu", name: "Command Center", symbol: "square.grid.2x2"),
            CometPanelEntity(id: "apple-ai", name: "Apple Intelligence", symbol: "appleintelligence"),
            CometPanelEntity(id: "action-chain", name: "Action Chain", symbol: "point.3.filled.connected.trianglepath.dotted"),
            CometPanelEntity(id: "downloads", name: "Downloads", symbol: "arrow.down.circle"),
            CometPanelEntity(id: "clipboard", name: "Clipboard", symbol: "doc.on.clipboard"),
            CometPanelEntity(id: "settings", name: "Settings", symbol: "slider.horizontal.3")
        ]
    }
}

// MARK: - Intents

@available(macOS 13.0, *)
struct CometConversationEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Comet Conversation"
    static var defaultQuery = CometConversationQuery()
    
    let id: String
    let title: String
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

@available(macOS 13.0, *)
struct CometConversationQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CometConversationEntity] {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        let state = try? await bridge.getState()
        return (state?.conversations ?? []).filter { identifiers.contains($0.id) }.map {
            CometConversationEntity(id: $0.id, title: $0.title)
        }
    }
    
    func suggestedEntities() async throws -> [CometConversationEntity] {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        let state = try? await bridge.getState()
        return (state?.conversations ?? []).prefix(10).map {
            CometConversationEntity(id: $0.id, title: $0.title)
        }
    }
}

// MARK: - Intents

@available(macOS 13.0, *)
struct AskCometIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Comet AI"
    static var description = IntentDescription("Send a prompt to Comet AI and get a response.")
    
    @Parameter(title: "Prompt", description: "What do you want to ask Comet?")
    var prompt: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Ask Comet \(\.$prompt)")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            let result = try await bridge.sendPrompt(prompt)
            // HIG: Attribution and assessing accuracy
            return .result(value: result, dialog: "Comet AI generated this response: \(result)")
        } catch {
            return .result(value: "Connection error", dialog: "I couldn't connect to Comet AI right now.")
        }
    }
}

@available(macOS 13.0, *)
struct RefineCometResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Refine Comet Response"
    static var description = IntentDescription("Ask Comet to change the style or length of the last response.")
    
    @Parameter(title: "Instruction", description: "e.g., 'Make it shorter', 'More professional', 'Explain like I'm 5'")
    var instruction: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Refine response: \(\.$instruction)")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            let result = try await bridge.sendPrompt("Please refine your previous response with this instruction: \(instruction)")
            return .result(value: result, dialog: "Here is the refined response from Comet: \(result)")
        } catch {
            return .result(value: "Error", dialog: "I couldn't refine the response right now.")
        }
    }
}

@available(macOS 13.0, *)
struct RegenerateCometResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Regenerate Comet Response"
    static var description = IntentDescription("Ask Comet to try answering the last prompt again.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            _ = try await bridge.conversationAction("regenerate")
            // Wait for new response
            try await Task.sleep(nanoseconds: 1_000_000_000)
            let result = try await bridge.waitForResponse()
            return .result(value: result, dialog: "Comet regenerated the response: \(result)")
        } catch {
            return .result(value: "Error", dialog: "I couldn't regenerate the response.")
        }
    }
}

@available(macOS 13.0, *)
struct ReadLatestCometResponseIntent: AppIntent {
    static var title: LocalizedStringResource = "Read Latest Comet Response"
    static var description = IntentDescription("Hear the last message sent by Comet AI.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            let state = try await bridge.getState()
            if let lastModelMsg = state.messages.last(where: { $0.role == "model" }) {
                return .result(value: lastModelMsg.content, dialog: "Comet AI's latest response was: \(lastModelMsg.content)")
            } else {
                return .result(value: "No messages found.", dialog: "I couldn't find any recent responses from Comet.")
            }
        } catch {
            return .result(value: "Connection error", dialog: "I couldn't access Comet to read the response.")
        }
    }
}

@available(macOS 13.0, *)
struct SearchWebIntent: AppIntent {
    static var title: LocalizedStringResource = "Search Web with Comet"
    static var description = IntentDescription("Perform an AI-powered web search.")
    
    @Parameter(title: "Query", description: "What do you want to search for?")
    var query: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Search for \(\.$query) in Comet")
    }
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        let result = try await bridge.sendPrompt("Search the web for: \(query)")
        return .result(value: result, dialog: "Search results from Comet: \(result)")
    }
}

@available(macOS 13.0, *)
struct SetModelIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Comet AI Model"
    static var description = IntentDescription("Change the active AI model.")
    
    @Parameter(title: "Model", description: "e.g., GPT-4, Claude 3, Gemini Pro")
    var model: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Set Comet model to \(\.$model)")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try await bridge.post("/native-mac-ui/preferences", body: ["activeModel": model])
        return .result(dialog: "Comet AI model set to \(model).")
    }
}

@available(macOS 13.0, *)
struct CaptureScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture Comet Screenshot"
    static var description = IntentDescription("Take a screenshot of the current browser page.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        let data = try await bridge.post("/native-mac-ui/screenshot", body: [:])
        
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let path = json["path"] as? String {
            return .result(value: path, dialog: "Screenshot captured and saved to Downloads.")
        }
        throw NSError(domain: "CometBridge", code: 3, userInfo: [NSLocalizedDescriptionKey: "Failed to capture screenshot"])
    }
}

@available(macOS 13.0, *)
struct CreateDocumentIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Document with Comet"
    static var description = IntentDescription("Generate a PDF, Excel, or PowerPoint document.")
    
    @Parameter(title: "Format", default: "pdf")
    var format: String
    
    @Parameter(title: "Topic", description: "What should the document be about?")
    var topic: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Create \(\.$format) about \(\.$topic) in Comet")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try await bridge.sendPrompt("Generate a \(format) document about: \(topic)")
        return .result(dialog: "Comet is generating your \(format) document.")
    }
}

@available(macOS 13.0, *)
struct ResetCometChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Reset Comet Chat"
    static var description = IntentDescription("Clear the current conversation context.")
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try? await bridge.conversationAction("new")
        return .result(dialog: "Comet chat context has been reset.")
    }
}

@available(macOS 13.0, *)
struct SummarizeCurrentPageIntent: AppIntent {
    static var title: LocalizedStringResource = "Summarize Page in Comet"
    static var description = IntentDescription("Summarize the content of the currently active browser page.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            let summary = try await bridge.summarizePage()
            return .result(value: summary, dialog: "Here is a summary generated by Comet: \(summary)")
        } catch {
            return .result(value: "Failed to summarize", dialog: "I couldn't summarize the page.")
        }
    }
}

@available(macOS 13.0, *)
struct OpenCometPanelIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Comet Panel"
    static var description = IntentDescription("Open a specific Comet AI interface.")
    
    @Parameter(title: "Panel")
    var panel: CometPanelEntity
    
    static var parameterSummary: some ParameterSummary {
        Summary("Open Comet \(\.$panel)")
    }
    
    @MainActor
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try? await bridge.openPanel(panel.id)
        return .result(dialog: "Opening \(panel.name).")
    }
}

@available(macOS 13.0, *)
struct ListCometConversationsIntent: AppIntent {
    static var title: LocalizedStringResource = "List Comet Conversations"
    static var description = IntentDescription("Show a list of your recent Comet AI conversations.")
    
    func perform() async throws -> some IntentResult & ReturnsValue<[CometConversationEntity]> {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        
        do {
            let state = try await bridge.getState()
            let conversations = (state.conversations ?? []).map {
                CometConversationEntity(id: $0.id, title: $0.title)
            }
            
            if conversations.isEmpty {
                return .result(value: [], dialog: "You don't have any recent conversations in Comet.")
            }
            
            let titles = conversations.map { $0.title }.joined(separator: ", ")
            return .result(value: conversations, dialog: "You have \(conversations.count) recent conversations: \(titles)")
        } catch {
            return .result(value: [], dialog: "I couldn't list your conversations right now.")
        }
    }
}

@available(macOS 13.0, *)
struct OpenCometConversationIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Comet Conversation"
    static var description = IntentDescription("Open a specific chat session in Comet.")
    
    @Parameter(title: "Conversation")
    var conversation: CometConversationEntity
    
    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$conversation) in Comet")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try? await bridge.conversationAction("load", id: conversation.id)
        _ = try? await bridge.openPanel("sidebar")
        return .result(dialog: "Opening your conversation \"\(conversation.title)\".")
    }
}


@available(macOS 13.0, *)
struct NewCometChatIntent: AppIntent {
    static var title: LocalizedStringResource = "New Comet Chat"
    static var description = IntentDescription("Start a fresh conversation with Comet AI.")
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        _ = try? await bridge.conversationAction("new")
        _ = try? await bridge.openPanel("sidebar")
        return .result(dialog: "Started a new conversation.")
    }
}

@available(macOS 13.0, *)
struct RunCometCommandIntent: AppIntent {
    static var title: LocalizedStringResource = "Run Command in Comet"
    static var description = IntentDescription("Execute a shell command via Comet AI.")
    
    @Parameter(title: "Command")
    var command: String
    
    static var parameterSummary: some ParameterSummary {
        Summary("Run \(\.$command) in Comet")
    }
    
    func perform() async throws -> some IntentResult {
        let config = LaunchConfiguration.parse()
        let bridge = CometBridgeClient(config: config)
        // Commands are sensitive, we send them as prompts for AI to handle with permission UI
        _ = try await bridge.sendPrompt("Run this shell command: \(command)")
        return .result(dialog: "Executing command via Comet. Please check for permission prompts if required.")
    }
}

// MARK: - Shortcuts Provider

@available(macOS 13.0, *)
struct CometShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskCometIntent(),
            phrases: [
                "Ask \(.applicationName) \(\.$prompt)",
                "Tell \(.applicationName) \(\.$prompt)",
                "Query \(.applicationName) \(\.$prompt)"
            ],
            shortTitle: "Ask Comet",
            systemImageName: "sparkles"
        )
        
        AppShortcut(
            intent: RefineCometResponseIntent(),
            phrases: [
                "Refine \(.applicationName) response",
                "Make \(.applicationName) response \(\.$instruction)",
                "Change \(.applicationName) response"
            ],
            shortTitle: "Refine Response",
            systemImageName: "wand.and.stars"
        )
        
        AppShortcut(
            intent: RegenerateCometResponseIntent(),
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
            intent: ReadLatestCometResponseIntent(),
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
            intent: ListCometConversationsIntent(),
            phrases: [
                "List my conversations in \(.applicationName)",
                "Show my recent chats in \(.applicationName)",
                "What are my chats in \(.applicationName)"
            ],
            shortTitle: "List Chats",
            systemImageName: "list.bullet.rectangle.portrait"
        )
        
        AppShortcut(
            intent: OpenCometConversationIntent(),
            phrases: [
                "Open my \(\.$conversation) in \(.applicationName)",
                "Show \(\.$conversation) in \(.applicationName)"
            ],
            shortTitle: "Open Conversation",
            systemImageName: "bubble.left.and.bubble.right"
        )
        
        AppShortcut(
            intent: NewCometChatIntent(),
            phrases: [
                "New chat in \(.applicationName)",
                "Start new conversation with \(.applicationName)"
            ],
            shortTitle: "New Chat",
            systemImageName: "plus.bubble"
        )
    }
}

// MARK: - Bridge Client Helper

class CometBridgeClient {
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
        throw NSError(domain: "CometBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to extract page"])
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
    
    func getState() async throws -> NativePanelState {
        let data = try await get("/native-mac-ui/state?mode=sidebar")
        let envelope = try JSONDecoder().decode(BridgeStateEnvelope.self, from: data)
        if let state = envelope.state { return state }
        throw NSError(domain: "CometBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "No state returned"])
    }
    
    func get(_ path: String) async throws -> Data {
        let url = url(path: path)
        var request = URLRequest(url: url)
        request.addValue(config.token, forHTTPHeaderField: "X-Comet-Native-Token")
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }
    
    func post(_ path: String, body: [String: Any]) async throws -> Data {
        let url = url(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(config.token, forHTTPHeaderField: "X-Comet-Native-Token")
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


