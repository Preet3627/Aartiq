import Foundation
import AppIntents
import AVFoundation

struct CometAIAppShortcutsProvider: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskAIIntent(),
            phrases: [
                "Ask \(\.applicationName) a question",
                "Ask \(\.applicationName) to search for \(.parameter(\.$query))",
                "Talk to \(\.applicationName)",
                "Chat with \(\.applicationName)",
                "Ask \(\.applicationName) about \(.parameter(\.$query))"
            ],
            shortTitle: "Ask AI",
            systemImageName: "brain.head.profile"
        )
        
        AppShortcut(
            intent: CreatePDFIntent(),
            phrases: [
                "Create PDF in \(\.applicationName)",
                "Make PDF with \(\.applicationName)",
                "Generate document in \(\.applicationName)"
            ],
            shortTitle: "Create PDF",
            systemImageName: "doc.text.fill"
        )
        
        AppShortcut(
            intent: NavigateIntent(),
            phrases: [
                "Go to \(\.parameter(\.$url)) in \(\.applicationName)",
                "Open \(\.parameter(\.$url)) in \(\.applicationName)",
                "Navigate to \(\.parameter(\.$url)) in \(\.applicationName)"
            ],
            shortTitle: "Navigate",
            systemImageName: "safari.fill"
        )
        
        AppShortcut(
            intent: RunShellCommandIntent(),
            phrases: [
                "Run \(\.parameter(\.$command)) in \(\.applicationName)",
                "Execute \(\.parameter(\.$command)) in \(\.applicationName)",
                "Terminal command \(\.parameter(\.$command)) in \(\.applicationName)"
            ],
            shortTitle: "Run Command",
            systemImageName: "terminal.fill"
        )
        
        AppShortcut(
            intent: ScheduleTaskIntent(),
            phrases: [
                "Schedule \(\.parameter(\.$task)) in \(\.applicationName)",
                "Set reminder \(\.parameter(\.$task)) in \(\.applicationName)",
                "Remind me to \(\.parameter(\.$task)) in \(\.applicationName)"
            ],
            shortTitle: "Schedule Task",
            systemImageName: "calendar.badge.clock"
        )
        
        AppShortcut(
            intent: SetVolumeIntent(),
            phrases: [
                "Set volume to \(\.parameter(\.$level)) in \(\.applicationName)",
                "Volume \(\.parameter(\.$level)) in \(\.applicationName)",
                "Change volume to \(\.parameter(\.$level)) in \(\.applicationName)"
            ],
            shortTitle: "Set Volume",
            systemImageName: "speaker.wave.3.fill"
        )
        
        AppShortcut(
            intent: OpenAppIntent(),
            phrases: [
                "Open \(\.parameter(\.$appName)) with \(\.applicationName)",
                "Launch \(\.parameter(\.$appName)) in \(\.applicationName)",
                "Start \(\.parameter(\.$appName)) in \(\.applicationName)"
            ],
            shortTitle: "Open App",
            systemImageName: "app.fill"
        )
        
        AppShortcut(
            intent: TakeScreenshotIntent(),
            phrases: [
                "Take screenshot in \(\.applicationName)",
                "Capture screen in \(\.applicationName)",
                "Screenshot with \(\.applicationName)"
            ],
            shortTitle: "Screenshot",
            systemImageName: "camera.fill"
        )
        
        AppShortcut(
            intent: VoiceChatIntent(),
            phrases: [
                "Voice chat with \(\.applicationName)",
                "Talk to \(\.applicationName) now",
                "Ask \(\.applicationName) verbally"
            ],
            shortTitle: "Voice Chat",
            systemImageName: "mic.fill"
        )
        
        AppShortcut(
            intent: AskAISpeakingIntent(),
            phrases: [
                "Ask \(\.applicationName) and speak",
                "Ask \(\.applicationName) with voice",
                "Talk to \(\.applicationName) aloud"
            ],
            shortTitle: "Ask + Speak",
            systemImageName: "waveform"
        )
    }
}

struct AskAIIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Comet AI"
    static var description = IntentDescription("Ask a question to Comet AI and get an answer")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Query", description: "What you want to ask")
    var query: String
    
    init() {}
    
    init(query: String) {
        self.query = query
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let result = try await sendToCometAI(query: query)
        return .result(dialog: IntentDialog(stringLiteral: result))
    }
    
    private func sendToCometAI(query: String) async throws -> String {
        let url = URL(string: "comet-ai://chat?message=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)")!
        
        if NSWorkspace.shared.open(url) {
            return "Opening Comet AI with your question..."
        }
        
        return "Sent to Comet AI. Please check the app."
    }
}

struct CreatePDFIntent: AppIntent {
    static var title: LocalizedStringResource = "Create PDF"
    static var description = IntentDescription("Generate a PDF document")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Content", description: "Content for the PDF")
    var content: String
    
    @Parameter(title: "Title", description: "PDF title", default: "Document")
    var title: String
    
    init() {}
    
    init(content: String, title: String = "Document") {
        self.content = content
        self.title = title
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "comet-ai://create-pdf?content=\(content.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? content)&title=\(title.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? title)")!
        
        NSWorkspace.shared.open(url)
        
        return .result(dialog: IntentDialog("Creating PDF: \(title)"))
    }
}

struct NavigateIntent: AppIntent {
    static var title: LocalizedStringResource = "Navigate"
    static var description = IntentDescription("Navigate to a URL")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "URL or Search", description: "Website URL or search query")
    var url: String
    
    init() {}
    
    init(url: String) {
        self.url = url
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        var urlToOpen = url
        
        if !url.hasPrefix("http://") && !url.hasPrefix("https://") {
            let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
            urlToOpen = "https://\(encoded)"
        }
        
        let urlScheme = URL(string: "comet-ai://navigate?url=\(urlToOpen.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlToOpen)")!
        
        NSWorkspace.shared.open(urlScheme)
        
        return .result(dialog: IntentDialog("Opening \(urlToOpen) in Comet AI"))
    }
}

struct RunShellCommandIntent: AppIntent {
    static var title: LocalizedStringResource = "Run Terminal Command"
    static var description = IntentDescription("Execute a terminal command")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Command", description: "Terminal command to run")
    var command: String
    
    init() {}
    
    init(command: String) {
        self.command = command
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "comet-ai://run-command?command=\(command.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? command)&confirm=true")!
        
        NSWorkspace.shared.open(url)
        
        return .result(dialog: IntentDialog("Running command: \(command)"))
    }
}

struct ScheduleTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Schedule Task"
    static var description = IntentDescription("Schedule an AI task")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "Task", description: "Task to schedule")
    var task: String
    
    @Parameter(title: "Schedule", description: "When to run (e.g., daily at 8am)", default: "daily")
    var schedule: String
    
    init() {}
    
    init(task: String, schedule: String = "daily") {
        self.task = task
        self.schedule = schedule
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "comet-ai://schedule?task=\(task.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? task)&cron=\(schedule.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? schedule)")!
        
        NSWorkspace.shared.open(url)
        
        return .result(dialog: IntentDialog("Scheduled task: \(task) at \(schedule)"))
    }
}

struct SetVolumeIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Volume"
    static var description = IntentDescription("Set system volume")
    static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Level", description: "Volume level (0-100)")
    var level: Int
    
    init() {}
    
    init(level: Int) {
        self.level = level
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let volume = max(0, min(100, level))
        
        let script = "set volume output volume \(volume)"
        var error: NSDictionary?
        if let scriptObject = NSAppleScript(source: script) {
            scriptObject.executeAndReturnError(&error)
        }
        
        if error != nil {
            return .result(dialog: IntentDialog("Failed to set volume"))
        }
        
        return .result(dialog: IntentDialog("Volume set to \(volume)%"))
    }
}

struct OpenAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Application"
    static var description = IntentDescription("Open an application")
    static var openAppWhenRun: Bool = true
    
    @Parameter(title: "App Name", description: "Name of the application")
    var appName: String
    
    init() {}
    
    init(appName: String) {
        self.appName = appName
    }
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "comet-ai://open-app?appName=\(appName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? appName)")!
        
        NSWorkspace.shared.open(url)
        
        return .result(dialog: IntentDialog("Opening \(appName)"))
    }
}

struct TakeScreenshotIntent: AppIntent {
    static var title: LocalizedStringResource = "Take Screenshot"
    static var description = IntentDescription("Capture a screenshot")
    static var openAppWhenRun: Bool = true
    
    init() {}
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        NSWorkspace.shared.open(URL(string: "comet-ai://screenshot")!)
        
        return .result(dialog: IntentDialog("Taking screenshot..."))
    }
}

struct VoiceChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Voice Chat"
    static var description = IntentDescription("Chat with AI using voice input")
    static var openAppWhenRun: Bool = true
    
    init() {}
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        NSWorkspace.shared.open(URL(string: "comet-ai://voice-chat")!)
        
        return .result(dialog: IntentDialog("Starting voice chat..."))
    }
}

struct AskAISpeakingIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask AI with Speech"
    static var description = IntentDescription("Ask AI and hear the response")
    static var openAppWhenRun: Bool = true
    
    init() {}
    
    func perform() async throws -> some IntentResult & ProvidesDialog {
        NSWorkspace.shared.open(URL(string: "comet-ai://ask-ai?speak=true")!)
        
        return .result(dialog: IntentDialog("Ask AI a question and I'll speak the answer"))
    }
}

@available(macOS 13.0, *)
extension CometAIAppShortcutsProvider {
}