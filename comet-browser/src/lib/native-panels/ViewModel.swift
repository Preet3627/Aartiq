import SwiftUI
import AppKit
import LocalAuthentication
import Foundation

@MainActor
final class NativePanelViewModel: ObservableObject {
    @Published var promptText = ""
    @Published var state: NativePanelState
    @Published var isConnected = false
    @Published var isSending = false
    @Published var statusText = "Connecting"
    @Published var compactSidebar = false

    let configuration: LaunchConfiguration
    private let decoder = JSONDecoder()
    private var pollTask: Task<Void, Never>?
    private var lastInteractionAt = Date()
    private var lastSeenUpdatedAt: Double = 0

    init(configuration: LaunchConfiguration) {
        self.configuration = configuration
        self.state = .empty(mode: configuration.mode)
        startPolling()
    }

    deinit {
        pollTask?.cancel()
    }

    func sendPrompt() {
        let trimmed = promptText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        recordInteraction()
        let optimisticMessage = NativePanelState.Message(
            id: "swift-user-\(UUID().uuidString)",
            role: "user",
            content: trimmed,
            timestamp: Date().timeIntervalSince1970 * 1000,
            thinkText: nil,
            isOcr: false,
            ocrLabel: nil,
            ocrText: nil,
            actionLogs: nil,
            mediaItems: nil
        )
        updateLocalState(
            messages: state.messages + [optimisticMessage],
            inputDraft: "",
            isLoading: true
        )
        statusText = "Sending to Comet"
        promptText = ""
        Task {
            isSending = true
            defer { isSending = false }
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/prompt", body: [
                    "prompt": trimmed,
                    "source": "swiftui-sidebar"
                ])
                statusText = "Sent to Comet"
                await refreshState()
            } catch {
                statusText = "Send failed"
                updateLocalState(isLoading: false)
            }
        }
    }

    func openPanel(_ mode: PanelMode) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/panels/open", body: [
                    "mode": mode.rawValue,
                    "relaunchIfRunning": true
                ])
            } catch {
                statusText = "Unable to open panel"
            }
        }
    }
    
    func openSettings(target: String) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/settings/open", body: ["target": target])
            } catch {
                statusText = "Unable to open settings"
            }
        }
    }
    
    func focusBrowser() {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/focus-electron", body: [:])
            } catch {
                statusText = "Unable to focus browser"
            }
        }
    }

    func openExternalURL(_ urlString: String) {
        recordInteraction()
        guard let url = URL(string: urlString) else { return }
        NSWorkspace.shared.open(url)
    }

    func copyClipboardItem(_ text: String) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/clipboard/copy", body: ["text": text])
                statusText = "Copied"
            } catch {
                statusText = "Copy failed"
            }
        }
    }

    func clearClipboardHistory() {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/clipboard/clear", body: [:])
                statusText = "Clipboard cleared"
                await refreshState()
            } catch {
                statusText = "Clear failed"
            }
        }
    }

    func openDownload(path: String?) {
        guard let path, !path.isEmpty else { return }
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/downloads/open", body: ["path": path])
            } catch {
                statusText = "Unable to open file"
            }
        }
    }

    func revealDownload(path: String?) {
        guard let path, !path.isEmpty else { return }
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/downloads/reveal", body: ["path": path])
            } catch {
                statusText = "Unable to reveal file"
            }
        }
    }

    func setPreference(key: String, value: String) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/preferences", body: [key: value])
                await refreshState()
            } catch {
                statusText = "Preference update failed"
            }
        }
    }

    func setPreference(key: String, value: Bool) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/preferences", body: [key: value])
                await refreshState()
            } catch {
                statusText = "Preference update failed"
            }
        }
    }

    func conversationAction(_ action: String, id: String? = nil) {
        recordInteraction()
        Task {
            do {
                var payload: [String: Any] = ["action": action]
                if let id {
                    payload["id"] = id
                }
                _ = try await sendJSONRequest(path: "/native-mac-ui/conversations/action", body: payload)
                statusText = action == "new" ? "New chat ready" : "Conversation updated"
            } catch {
                statusText = "Conversation action failed"
            }
        }
    }

    func exportSession(_ format: String) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/export", body: ["format": format])
                statusText = format == "pdf" ? "Exporting PDF" : "Exporting text"
            } catch {
                statusText = "Export failed"
            }
        }
    }

    func respondToApproval(_ requestId: String, allowed: Bool, deviceUnlockValidated: Bool = false) {
        recordInteraction()
        Task {
            do {
                _ = try await sendJSONRequest(path: "/native-mac-ui/approval/respond", body: [
                    "requestId": requestId,
                    "allowed": allowed,
                    "deviceUnlockValidated": deviceUnlockValidated
                ])
                statusText = allowed ? "Approved" : "Denied"
                await refreshState()
            } catch {
                statusText = "Approval failed"
            }
        }
    }

    func verifyDeviceOwnerApproval(reason: String, command: String, risk: String) async -> (approved: Bool, error: String?) {
        let context = LAContext()
        context.localizedCancelTitle = "Deny"
        context.localizedFallbackTitle = "Use Mac Password"

        var authError: NSError?
        let policy = LAPolicy.deviceOwnerAuthentication
        guard context.canEvaluatePolicy(policy, error: &authError) else {
            return (false, authError?.localizedDescription ?? "Touch ID or Mac password authentication is unavailable.")
        }

        return await withCheckedContinuation { continuation in
            let summary = reason.trimmingCharacters(in: .whitespacesAndNewlines)
            let localizedReason = summary.isEmpty
                ? "Approve this \(risk) risk action: \(command). Confirm with Touch ID or your Mac password."
                : summary
            context.evaluatePolicy(policy, localizedReason: localizedReason) { approved, error in
                continuation.resume(returning: (approved, (error as NSError?)?.localizedDescription))
            }
        }
    }

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                await refreshState()
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
        }
    }

    private func refreshState() async {
        do {
            var components = URLComponents(url: url(path: "/native-mac-ui/state"), resolvingAgainstBaseURL: false)!
            components.queryItems = [URLQueryItem(name: "mode", value: configuration.mode.rawValue)]

            var request = URLRequest(url: components.url!)
            request.addValue(configuration.token, forHTTPHeaderField: "X-Comet-Native-Token")

            let (data, _) = try await URLSession.shared.data(for: request)
            let envelope = try decoder.decode(BridgeStateEnvelope.self, from: data)

            if envelope.success, let nextState = envelope.state {
                let didReceiveFreshState = nextState.updatedAt != lastSeenUpdatedAt
                let shouldExpand = didReceiveFreshState || nextState.isLoading
                state = nextState
                if promptText.isEmpty, !nextState.inputDraft.isEmpty {
                    promptText = nextState.inputDraft
                }
                if shouldExpand {
                    recordInteraction(expandOnly: true)
                }
                updateSidebarPresentation(using: nextState)
                lastSeenUpdatedAt = nextState.updatedAt
                isConnected = true
                statusText = nextState.isLoading ? "Comet is thinking" : "Connected"
            } else {
                isConnected = false
                statusText = envelope.error ?? "Bridge unavailable"
            }
        } catch {
            isConnected = false
            statusText = "Bridge unavailable"
        }
    }

    private func sendJSONRequest(path: String, body: [String: Any]) async throws -> Data {
        var request = URLRequest(url: url(path: path))
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(configuration.token, forHTTPHeaderField: "X-Comet-Native-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }

    func appleSummary(text: String) async throws -> String {
        var request = URLRequest(url: url(path: "/native-mac-ui/apple-intelligence/summary"))
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(configuration.token, forHTTPHeaderField: "X-Comet-Native-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["text": text], options: [])
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        return (response?["summary"] as? String) ?? text
    }

    func appleGenerateImage(prompt: String) async throws -> String {
        var request = URLRequest(url: url(path: "/native-mac-ui/apple-intelligence/image"))
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue(configuration.token, forHTTPHeaderField: "X-Comet-Native-Token")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["prompt": prompt], options: [])
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        return (response?["path"] as? String) ?? ""
    }

    private func updateLocalState(
        messages: [NativePanelState.Message]? = nil,
        inputDraft: String? = nil,
        isLoading: Bool? = nil
    ) {
        let current = state
        state = NativePanelState(
            mode: current.mode,
            updatedAt: Date().timeIntervalSince1970 * 1000,
            inputDraft: inputDraft ?? current.inputDraft,
            isLoading: isLoading ?? current.isLoading,
            error: current.error,
            themeAppearance: current.themeAppearance,
            messages: messages ?? current.messages,
            actionChain: current.actionChain,
            currentCommandIndex: current.currentCommandIndex,
            activityTags: current.activityTags,
            conversations: current.conversations,
            activeConversationId: current.activeConversationId,
            downloads: current.downloads,
            clipboardItems: current.clipboardItems,
            preferences: current.preferences,
            pendingApproval: current.pendingApproval,
            terminalLogs: current.terminalLogs,
            actionLogs: current.actionLogs,
            thinkingSteps: current.thinkingSteps
        )
    }

    private func recordInteraction(expandOnly: Bool = false) {
        lastInteractionAt = Date()
        compactSidebar = false
        if !expandOnly {
            statusText = state.isLoading ? "Comet is thinking" : statusText
        }
    }

    private func updateSidebarPresentation(using nextState: NativePanelState) {
        guard configuration.mode == .sidebar else {
            compactSidebar = false
            return
        }

        let autoMinimize = nextState.preferences?.sidebarAutoMinimize ?? false
        let hasDraft = !promptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        guard autoMinimize, !nextState.isLoading, !hasDraft else {
            compactSidebar = false
            return
        }

        let idleTime = Date().timeIntervalSince(lastInteractionAt)
        compactSidebar = idleTime > 14 && !nextState.messages.isEmpty
    }

    private func url(path: String) -> URL {
        let normalizedBase = configuration.bridgeURL.absoluteString.hasSuffix("/") ? configuration.bridgeURL.absoluteString : configuration.bridgeURL.absoluteString + "/"
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        return URL(string: normalizedPath, relativeTo: URL(string: normalizedBase))!.absoluteURL
    }

    func noteInteraction() {
        recordInteraction()
    }

    func toggleSidebar() {
        recordInteraction()
        compactSidebar.toggle()
    }



    var themeColorScheme: ColorScheme {
        state.themeAppearance == "light" ? .light : .dark
    }
}

final class NativePanelsAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

enum WindowPlacementCoordinator {
    private static var placedWindowNumbers = Set<Int>()

    static func markPlaced(window: NSWindow) {
        placedWindowNumbers.insert(window.windowNumber)
    }

    static func needsPlacement(for window: NSWindow) -> Bool {
        !placedWindowNumbers.contains(window.windowNumber)
    }
}

struct WindowConfigurator: NSViewRepresentable {
    let mode: PanelMode
    let compactSidebar: Bool
    let iconPath: String?

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async { configure(window: view.window) }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async { configure(window: nsView.window) }
    }

    private func configure(window: NSWindow?) {
        guard let window else { return }
        var styleMask = window.styleMask
        styleMask.insert([.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView])
        styleMask.remove(.unifiedTitleAndToolbar)
        window.styleMask = styleMask
        window.titleVisibility = .hidden
        window.title = ""
        window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none
        window.toolbar = nil
        window.isMovableByWindowBackground = true
        window.level = mode == .sidebar ? .floating : .modalPanel
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        window.backgroundColor = .clear
        window.isOpaque = false
        window.hasShadow = true
        window.hidesOnDeactivate = false
        window.styleMask.insert(.fullSizeContentView)
        window.styleMask.insert(.resizable)
        window.contentView?.wantsLayer = true
        window.contentView?.layer?.backgroundColor = NSColor.clear.cgColor
        window.contentView?.superview?.wantsLayer = true
        window.contentView?.superview?.layer?.backgroundColor = NSColor.clear.cgColor
        window.contentView?.superview?.superview?.wantsLayer = true
        window.contentView?.superview?.superview?.layer?.backgroundColor = NSColor.clear.cgColor
        window.setContentBorderThickness(0, for: .minY)
        window.setContentBorderThickness(0, for: .maxY)
        let targetSize = resolvedSize
        window.minSize = NSSize(width: targetSize.width, height: targetSize.height)
        if window.contentLayoutRect.size != NSSize(width: targetSize.width, height: targetSize.height) {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.32
                context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                window.animator().setContentSize(NSSize(width: targetSize.width, height: targetSize.height))
            }
        }
        if WindowPlacementCoordinator.needsPlacement(for: window) {
            let anchoredFrame = resolvedFrame(for: window, targetSize: targetSize)
            window.setFrame(anchoredFrame, display: true)
            WindowPlacementCoordinator.markPlaced(window: window)
        }
        window.standardWindowButton(.closeButton)?.isHidden = false
        window.standardWindowButton(.miniaturizeButton)?.isHidden = false
        window.standardWindowButton(.zoomButton)?.isHidden = false
        positionTrafficLights(in: window)
        if let iconPath, let icon = NSImage(contentsOfFile: iconPath) {
            window.miniwindowImage = icon
            window.representedURL = URL(fileURLWithPath: iconPath)
            NSApp.applicationIconImage = icon
        }
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
    }

    private func positionTrafficLights(in window: NSWindow) {
        guard
            let closeButton = window.standardWindowButton(.closeButton),
            let miniButton = window.standardWindowButton(.miniaturizeButton),
            let zoomButton = window.standardWindowButton(.zoomButton),
            let buttonContainer = closeButton.superview
        else {
            return
        }

        let buttons = [closeButton, miniButton, zoomButton]
        let leadingInset: CGFloat = mode == .sidebar ? 18 : 16
        let topInset: CGFloat = mode == .sidebar ? 14 : 10
        let spacing: CGFloat = 8
        let targetY = buttonContainer.bounds.height - closeButton.frame.height - topInset
        var currentX = leadingInset

        for button in buttons {
            button.setFrameOrigin(NSPoint(x: currentX, y: targetY))
            button.alphaValue = 1
            currentX += button.frame.width + spacing
        }
    }

    private var resolvedSize: CGSize {
        if mode == .sidebar, compactSidebar {
            return CGSize(width: 360, height: 250)
        }
        return mode.defaultSize
    }

    private func resolvedFrame(for window: NSWindow, targetSize: CGSize) -> NSRect {
        let screen = window.screen ?? NSScreen.main ?? NSScreen.screens.first
        let visibleFrame = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: targetSize.width, height: targetSize.height)
        let margin: CGFloat = mode == .sidebar ? 24 : 28
        let x = max(visibleFrame.minX + 16, visibleFrame.maxX - targetSize.width - margin)
        let y = max(visibleFrame.minY + 16, visibleFrame.maxY - targetSize.height - margin)
        return NSRect(x: x, y: y, width: targetSize.width, height: targetSize.height)
    }
}
