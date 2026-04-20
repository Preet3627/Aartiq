import SwiftUI

struct NativeSettingsPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let prefs = viewModel.state.preferences ?? .defaults
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        let launchColumns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
        
        PanelShell(mode: .settings, viewModel: viewModel) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            Image(systemName: PanelMode.settings.symbol)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(palette.accent)
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Comet Settings")
                                    .font(.system(size: 22, weight: .bold, design: .rounded))
                                    .foregroundStyle(palette.primaryText)
                                HStack(spacing: 8) {
                                    ConnectionBadge(isConnected: viewModel.isConnected, text: viewModel.statusText)
                                    StatusPill(text: prefs.sidebarMode.uppercased(), color: (prefs.sidebarMode == "swiftui" ? palette.accent : palette.mutedSurface))
                                    StatusPill(text: prefs.permissionMode.uppercased(), color: (prefs.permissionMode == "swiftui" ? Color.orange.opacity(0.22) : palette.mutedSurface))
                                }
                            }
                            Spacer()
                        }
                        Text("Configure Electron and native macOS settings")
                            .font(.system(size: 13))
                            .foregroundStyle(palette.secondaryText)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("QUICK LAUNCH")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.secondaryText)
                            .tracking(1.2)

                        LazyVGrid(columns: launchColumns, spacing: 10) {
                            NativeQuickActionCard(title: "AI Sidebar", subtitle: "Open the detached assistant", systemImage: PanelMode.sidebar.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.sidebar)
                            }
                            NativeQuickActionCard(title: "Action Chain", subtitle: "View current execution", systemImage: PanelMode.actionChain.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.actionChain)
                            }
                            NativeQuickActionCard(title: "Command Center", subtitle: "Launch native tools", systemImage: PanelMode.menu.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.menu)
                            }
                            NativeQuickActionCard(title: "Permissions", subtitle: "Review approvals", systemImage: PanelMode.permissions.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.permissions)
                            }
                            NativeQuickActionCard(title: "Downloads", subtitle: "Open file downloads", systemImage: PanelMode.downloads.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.downloads)
                            }
                            NativeQuickActionCard(title: "Clipboard", subtitle: "Open clipboard history", systemImage: PanelMode.clipboard.symbol, appearance: viewModel.state.themeAppearance) {
                                viewModel.openPanel(.clipboard)
                            }
                        }
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("SESSION TOOLS")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.secondaryText)
                            .tracking(1.2)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                NativeActionButton(title: "Focus Browser", systemImage: "macwindow.on.rectangle", appearance: viewModel.state.themeAppearance) {
                                    viewModel.focusBrowser()
                                }
                                NativeActionButton(title: "New Chat", systemImage: "plus.bubble", appearance: viewModel.state.themeAppearance) {
                                    viewModel.conversationAction("new")
                                }
                                NativeActionButton(title: "Export Text", systemImage: "text.justify.left", appearance: viewModel.state.themeAppearance) {
                                    viewModel.exportSession("text")
                                }
                                NativeActionButton(title: "Export PDF", systemImage: "doc.richtext", appearance: viewModel.state.themeAppearance) {
                                    viewModel.exportSession("pdf")
                                }
                            }
                        }
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("OPEN ELECTRON SETTINGS")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.secondaryText)
                            .tracking(1.2)
                        
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ElectronSettingsButton(
                                title: "API Keys",
                                subtitle: "OpenAI, Anthropic, Gemini",
                                systemImage: "key.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "api-keys")
                            }
                            ElectronSettingsButton(
                                title: "Appearance",
                                subtitle: "Theme, colors, layout",
                                systemImage: "paintpalette.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "appearance")
                            }
                            ElectronSettingsButton(
                                title: "Automation",
                                subtitle: "Scheduled tasks, workflows",
                                systemImage: "bolt.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "automation")
                            }
                            ElectronSettingsButton(
                                title: "Permissions",
                                subtitle: "Shell commands, safety",
                                systemImage: "shield.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "permissions")
                            }
                            ElectronSettingsButton(
                                title: "WiFi Sync",
                                subtitle: "Mobile connect, pairing",
                                systemImage: "wifi",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "sync")
                            }
                            ElectronSettingsButton(
                                title: "Privacy",
                                subtitle: "Security, history, data",
                                systemImage: "lock.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "privacy")
                            }
                            ElectronSettingsButton(
                                title: "Extensions",
                                subtitle: "Add-ons, MCP servers",
                                systemImage: "puzzlepiece.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "extensions")
                            }
                            ElectronSettingsButton(
                                title: "All Settings",
                                subtitle: "Full settings panel",
                                systemImage: "gearshape.fill",
                                appearance: viewModel.state.themeAppearance
                            ) {
                                viewModel.openSettings(target: "all")
                            }
                        }
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("NATIVE MACOS SETTINGS")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.secondaryText)
                            .tracking(1.2)
                        
                        VStack(spacing: 10) {
                            PreferenceCard(title: "AI Sidebar", subtitle: "Browser sidebar vs detached SwiftUI assistant", current: prefs.sidebarMode, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarMode", value: value)
                            }
                            PreferenceCard(title: "Action Chain", subtitle: "Execution feed and planning panel", current: prefs.actionChainMode, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "actionChainMode", value: value)
                            }
                            PreferenceCard(title: "Utility Panels", subtitle: "Settings, downloads, clipboard, and command center", current: prefs.utilityMode, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "utilityMode", value: value)
                            }
                            PreferenceCard(title: "Permission Prompts", subtitle: "Low, medium, and high-risk shell approvals", current: prefs.permissionMode, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "permissionMode", value: value)
                            }
                        }
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("SIDEBAR APPEARANCE")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(palette.secondaryText)
                            .tracking(1.2)
                        
                        VStack(spacing: 10) {
                            SelectionPreferenceCard(
                                title: "Gradient Theme",
                                subtitle: "Tune the native sidebar chrome with a premium gradient preset.",
                                current: prefs.sidebarGradientPreset ?? "graphite",
                                options: [("graphite", "Graphite"), ("ocean", "Ocean"), ("aurora", "Aurora"), ("liquidGlass", "Liquid Glass"), ("custom", "Custom")],
                                appearance: viewModel.state.themeAppearance
                            ) { value in
                                viewModel.setPreference(key: "sidebarGradientPreset", value: value)
                            }
                            
                            TogglePreferenceCard(title: "Auto-Minimize Sidebar", subtitle: "Shrink the detached AI sidebar when idle.", value: prefs.sidebarAutoMinimize ?? false, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarAutoMinimize", value: value)
                            }
                            TogglePreferenceCard(title: "Show Quick Actions", subtitle: "Display prompt shortcut pills above the composer.", value: prefs.sidebarShowQuickActions ?? true, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarShowQuickActions", value: value)
                            }
                            TogglePreferenceCard(title: "Show Sessions", subtitle: "Show recent saved chat sessions.", value: prefs.sidebarShowSessions ?? true, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarShowSessions", value: value)
                            }
                            TogglePreferenceCard(title: "Show Search Tags", subtitle: "Display live context tags.", value: prefs.sidebarShowSearchTags ?? true, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarShowSearchTags", value: value)
                            }
                            TogglePreferenceCard(title: "Show Command Center Button", subtitle: "Keep the Command Center launcher visible in the native sidebar header.", value: prefs.sidebarShowCommandCenterButton ?? true, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarShowCommandCenterButton", value: value)
                            }
                            TogglePreferenceCard(title: "Show Action Chain Button", subtitle: "Keep the Action Chain shortcut visible in the native sidebar header.", value: prefs.sidebarShowActionChainButton ?? true, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarShowActionChainButton", value: value)
                            }
                            TogglePreferenceCard(title: "Action Chain Auto Appear", subtitle: "Auto-open Action Chain for multi-step plans.", value: prefs.sidebarActionChainAutoAppear ?? false, appearance: viewModel.state.themeAppearance) { value in
                                viewModel.setPreference(key: "sidebarActionChainAutoAppear", value: value)
                            }
                        }
                    }
                    .padding(18)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(palette.stroke, lineWidth: 1)
                            )
                    )

                    HStack(spacing: 10) {
                        NativeActionButton(title: "Open Downloads", systemImage: PanelMode.downloads.symbol, appearance: viewModel.state.themeAppearance) {
                            viewModel.openPanel(.downloads)
                        }
                        NativeActionButton(title: "Open Clipboard", systemImage: PanelMode.clipboard.symbol, appearance: viewModel.state.themeAppearance) {
                            viewModel.openPanel(.clipboard)
                        }
                    }
                    .padding(.bottom, 20)
                }
                .padding(16)
            }
        }
    }
}
