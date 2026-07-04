import SwiftUI

struct SidebarPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel
    private let quickActions = [
        "Summarize the current tab and tell me what matters",
        "Plan a research workflow for this topic",
        "Generate a PDF report from the current browser context",
    ]

    var body: some View {
        let preferences = viewModel.state.preferences ?? .defaults
        let palette = PanelPalette(
            appearance: viewModel.state.themeAppearance,
            gradientPreset: preferences.sidebarGradientPreset
        )
        let visibleMessages = filteredMessages
        let activityTags = Array((viewModel.state.activityTags ?? []).prefix(6))
        let conversations = Array((viewModel.state.conversations ?? []).sorted(by: { $0.updatedAt > $1.updatedAt }).prefix(8))
        let latestAnimatedMessageId = visibleMessages.last(where: { $0.role != "user" })?.id
        let showQuickActions = preferences.sidebarShowQuickActions ?? true
        let showSessions = preferences.sidebarShowSessions ?? true
        let showSearchTags = preferences.sidebarShowSearchTags ?? true
        let showCommandCenterButton = preferences.sidebarShowCommandCenterButton ?? true
        let showActionChainButton = preferences.sidebarShowActionChainButton ?? true

        PanelShell(mode: .sidebar, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 16) {
                PanelHeader(
                    title: "Aartiq",
                    subtitle: viewModel.compactSidebar ? "Minimal mode" : (viewModel.state.isLoading ? "Comet is thinking" : "Native AI workspace"),
                    symbol: PanelMode.sidebar.symbol,
                    viewModel: viewModel,
                    showStatus: false,
                    trailing: AnyView(
                        HStack(spacing: 8) {
                            SidebarGlyphButton(systemImage: "plus.bubble", accessibilityLabel: "New chat", appearance: viewModel.state.themeAppearance, gradientPreset: preferences.sidebarGradientPreset) {
                                viewModel.conversationAction("new")
                            }
                            SidebarGlyphButton(systemImage: "text.justify.left", accessibilityLabel: "Export text", appearance: viewModel.state.themeAppearance, gradientPreset: preferences.sidebarGradientPreset) {
                                viewModel.exportSession("text")
                            }
                            SidebarGlyphButton(systemImage: "doc.richtext", accessibilityLabel: "Export PDF", appearance: viewModel.state.themeAppearance, gradientPreset: preferences.sidebarGradientPreset) {
                                viewModel.exportSession("pdf")
                            }
                            SidebarGlyphButton(systemImage: "gearshape", accessibilityLabel: "Customize sidebar", appearance: viewModel.state.themeAppearance, gradientPreset: preferences.sidebarGradientPreset) {
                                viewModel.openPanel(.settings)
                            }
                        }
                    )
                )
                .padding(.leading, 92)
                .padding(.trailing, 18)
                .padding(.top, 18)
                .padding(.bottom, 8)

                if !viewModel.compactSidebar {
                    HStack(spacing: 10) {
                        NativeActionButton(title: "Focus Browser", systemImage: "macwindow.on.rectangle", appearance: viewModel.state.themeAppearance) {
                            viewModel.focusBrowser()
                        }
                        if showActionChainButton {
                            NativeActionButton(title: "Action Chain", systemImage: PanelMode.actionChain.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.actionChain)
                            }
                        }
                        if showCommandCenterButton {
                            NativeActionButton(title: "Command Center", systemImage: PanelMode.menu.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.menu)
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                }

                if !viewModel.compactSidebar, showSearchTags, !activityTags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(activityTags, id: \.self) { tag in
                                SidebarTagChip(text: tag, appearance: viewModel.state.themeAppearance, gradientPreset: preferences.sidebarGradientPreset)
                            }
                        }
                        .padding(.horizontal, 18)
                    }
                }

                if !viewModel.compactSidebar, showSessions {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Sessions")
                                .font(.system(size: 10, weight: .black, design: .rounded))
                                .foregroundStyle(palette.secondaryText)
                                .textCase(.uppercase)
                            Spacer()
                            Button {
                                viewModel.conversationAction("new")
                            } label: {
                                Label("New", systemImage: "plus")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.primaryText)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 18)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                if conversations.isEmpty {
                                    EmptyStateCard(title: "No saved sessions yet", description: "Your recent chat sessions will appear here for one-tap recall.", appearance: viewModel.state.themeAppearance)
                                        .frame(width: 260)
                                } else {
                                    ForEach(conversations) { conversation in
                                        Button {
                                            viewModel.conversationAction("load", id: conversation.id)
                                        } label: {
                                            SessionChipView(
                                                title: conversation.title,
                                                updatedAt: conversation.updatedAt,
                                                isActive: viewModel.state.activeConversationId == conversation.id,
                                                appearance: viewModel.state.themeAppearance,
                                                gradientPreset: preferences.sidebarGradientPreset
                                            )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(.horizontal, 18)
                        }
                    }
                }

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if visibleMessages.isEmpty {
                                EmptyStateCard(title: "Ready for prompts", description: "Ask Comet anything, launch action chains, and keep your saved sessions close without breaking browser flow.", appearance: viewModel.state.themeAppearance)
                            }

                            ForEach(visibleMessages) { message in
                                MessageBubbleView(
                                    message: message,
                                    appearance: viewModel.state.themeAppearance,
                                    animateContent: latestAnimatedMessageId == message.id && message.role != "user",
                                    thinkingSteps: viewModel.state.thinkingSteps ?? []
                                )
                            }

                            if viewModel.state.isLoading {
                                AuroraThinkingView(appearance: viewModel.state.themeAppearance)
                            }

                            Color.clear.frame(height: 1).id("chat-bottom")
                        }
                        .padding(18)
                    }
                    .onAppear {
                        proxy.scrollTo("chat-bottom", anchor: .bottom)
                    }
                    .onChange(of: scrollToken) {
                        withAnimation(.spring(response: 0.48, dampingFraction: 0.88)) {
                            proxy.scrollTo("chat-bottom", anchor: .bottom)
                        }
                    }
                }

                if !viewModel.compactSidebar, showQuickActions {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(quickActions, id: \.self) { action in
                                Button {
                                    viewModel.promptText = action
                                } label: {
                                    Text(action)
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 12)
                                        .background(palette.mutedSurface)
                                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                        .foregroundStyle(palette.primaryText)
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 18)
                    }
                    .padding(.bottom, 2)
                }

                VStack(spacing: 12) {
                    ZStack(alignment: .topLeading) {
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .fill(palette.mutedSurface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 22, style: .continuous)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )

                        if viewModel.promptText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text("Ask Comet anything, continue a session, or kick off an action chain...")
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundStyle(palette.secondaryText)
                                .padding(.horizontal, 18)
                                .padding(.top, 18)
                                .allowsHitTesting(false)
                        }

                        PromptComposer(text: $viewModel.promptText, appearance: viewModel.state.themeAppearance) {
                            viewModel.sendPrompt()
                        } onInteraction: {
                            viewModel.noteInteraction()
                        }
                        .frame(minHeight: viewModel.compactSidebar ? 70 : 98, maxHeight: viewModel.compactSidebar ? 88 : 136)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                    }

                    HStack {
                        Text(viewModel.compactSidebar ? "Enter sends. Shift+Enter adds a new line." : "Enter sends. Shift+Enter adds a new line. Sessions and exports stay synced with the browser sidebar.")
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundStyle(palette.secondaryText)
                        Spacer()
                        
                        if !viewModel.state.messages.isEmpty, let lastMessage = viewModel.state.messages.last, lastMessage.role == "model", !lastMessage.content.isEmpty {
                            Button {
                                Task {
                                    let content = AICommandParser.cleanCustomTags(from: AICommandParser.parseCommands(from: lastMessage.content).textWithoutCommands)
                                    if let summary = try? await viewModel.appleSummary(text: content) {
                                        viewModel.promptText = summary
                                    }
                                }
                            } label: {
                                Image(systemName: "text.badge.star")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(palette.secondaryText)
                            }
                            .buttonStyle(.plain)
                            .help("Summarize with Apple Intelligence")
                        }
                        
                        Button {
                            viewModel.sendPrompt()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: viewModel.isSending ? "arrow.triangle.2.circlepath" : "paperplane.fill")
                                Text(viewModel.isSending ? "Sending" : "Send")
                            }
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundStyle(palette.buttonText)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(LinearGradient(colors: [palette.accent, palette.secondaryAccent], startPoint: .leading, endPoint: .trailing))
                            .clipShape(Capsule())
                            .shadow(color: palette.accent.opacity(0.28), radius: 12, x: 0, y: 6)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 16)
            }
        }
    }

    private var scrollToken: String {
        let last = filteredMessages.last
        return "\(last?.id ?? "empty")-\(last?.content.count ?? 0)-\(viewModel.state.isLoading)"
    }

    private var filteredMessages: [NativePanelState.Message] {
        let recentMessages = Array(viewModel.state.messages.suffix(viewModel.compactSidebar ? 4 : 16))
        return recentMessages.filter { message in
            if message.role == "user" {
                return !message.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }

            let cleaned = visibleMessageContent(for: message)
            if cleaned.isEmpty && viewModel.state.isLoading {
                let isLastAssistantMessage = recentMessages.last?.id == message.id
                if isLastAssistantMessage {
                    return false
                }
            }
            return !cleaned.isEmpty
        }
    }

    private func visibleMessageContent(for message: NativePanelState.Message) -> String {
        let parseResult = AICommandParser.parseCommands(from: message.content)
        let baseContent = parseResult.hasCommands ? parseResult.textWithoutCommands : message.content
        return AICommandParser.cleanCustomTags(from: baseContent)
    }
}

struct PromptComposer: View {
    @Binding var text: String
    let appearance: String
    let onCommit: () -> Void
    let onInteraction: () -> Void
    
    @FocusState private var isFocused: Bool
    
    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        TextEditor(text: $text)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .foregroundStyle(palette.primaryText)
            .focused($isFocused)
            .onChange(of: text) {
                if let lastChar = text.last, lastChar == "\n", !NSEvent.modifierFlags.contains(.shift), !NSEvent.modifierFlags.contains(.command) {
                    text.removeLast()
                    onCommit()
                } else {
                    onInteraction()
                }
            }
            .onSubmit(onCommit)
            .onAppear {
                isFocused = true
            }
    }
}
