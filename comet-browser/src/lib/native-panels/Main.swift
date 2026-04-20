import SwiftUI
import AppKit

@main
struct CometNativePanelsApp: App {
    @NSApplicationDelegateAdaptor(NativePanelsAppDelegate.self) var appDelegate
    @StateObject private var viewModel: NativePanelViewModel
    let configuration: LaunchConfiguration

    init() {
        let config = LaunchConfiguration.parse()
        self.configuration = config
        self._viewModel = StateObject(wrappedValue: NativePanelViewModel(configuration: config))
    }

    var body: some Scene {
        WindowGroup {
            RootPanelView(viewModel: viewModel)
                .background(WindowConfigurator(
                    mode: configuration.mode,
                    compactSidebar: viewModel.compactSidebar,
                    iconPath: configuration.iconPath
                ))
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandMenu("Comet") {
                Button("New Conversation") {
                    viewModel.conversationAction("new")
                }
                .keyboardShortcut("n", modifiers: [.command])

                Button("Open Sidebar") {
                    viewModel.openPanel(.sidebar)
                }
                .keyboardShortcut("1", modifiers: [.command])

                Button("Open Apple Intelligence") {
                    viewModel.openPanel(.appleAI)
                }
                .keyboardShortcut("1", modifiers: [.command, .option])

                Button("Open Command Center") {
                    viewModel.openPanel(.menu)
                }
                .keyboardShortcut("k", modifiers: [.command])

                Button("Open Action Chain") {
                    viewModel.openPanel(.actionChain)
                }
                .keyboardShortcut("a", modifiers: [.command, .shift])

                Divider()

                Button("Settings") {
                    viewModel.openPanel(.settings)
                }
                .keyboardShortcut(",", modifiers: [.command])

                Button("Focus Browser") {
                    viewModel.focusBrowser()
                }
                .keyboardShortcut("b", modifiers: [.command, .option])
            }
        }
    }
}

struct RootPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        Group {
            switch viewModel.configuration.mode {
            case .sidebar:
#if COMPILE_SIDEBAR || COMPILE_ALL
                SidebarPanelView(viewModel: viewModel)
#endif
            case .actionChain:
#if COMPILE_ACTION_CHAIN || COMPILE_ALL
                ActionChainPanelView(viewModel: viewModel)
#endif
            case .menu:
#if COMPILE_MENU || COMPILE_ALL
                CommandCenterPanelView(viewModel: viewModel)
#endif
            case .settings:
#if COMPILE_SETTINGS || COMPILE_ALL
                NativeSettingsPanelView(viewModel: viewModel)
#endif
            case .downloads:
#if COMPILE_DOWNLOADS || COMPILE_UTILITIES || COMPILE_ALL
                DownloadsPanelView(viewModel: viewModel)
#endif
            case .clipboard:
#if COMPILE_CLIPBOARD || COMPILE_UTILITIES || COMPILE_ALL
                ClipboardPanelView(viewModel: viewModel)
#endif
            case .permissions:
#if COMPILE_PERMISSIONS || COMPILE_UTILITIES || COMPILE_ALL
                PermissionsPanelView(viewModel: viewModel)
#endif
            case .appleAI:
#if COMPILE_APPLE_AI || COMPILE_ALL
                AppleIntelligencePanelView(viewModel: viewModel)
#endif
            }
        }
        .frame(minWidth: 100, minHeight: 100)
    }
}

