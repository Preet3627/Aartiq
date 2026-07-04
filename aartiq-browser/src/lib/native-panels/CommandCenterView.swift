import SwiftUI

struct CommandCenterPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        PanelShell(mode: .menu, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 18) {
                PanelHeader(
                    title: "SwiftUI Command Center",
                    subtitle: "Launch the detached native macOS panels from one place.",
                    symbol: PanelMode.menu.symbol,
                    viewModel: viewModel
                )
                .padding(18)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach([PanelMode.sidebar, .actionChain, .settings, .downloads, .clipboard, .permissions], id: \.rawValue) { panel in
                        Button {
                            viewModel.openPanel(panel)
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Image(systemName: panel.symbol)
                                    .font(.system(size: 20, weight: .semibold))
                                Text(panel.title)
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                Text("Open native \(panel.rawValue) panel")
                                    .font(.system(size: 10, design: .rounded))
                                    .foregroundStyle(palette.secondaryText)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(palette.mutedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(palette.primaryText)
                    }
                }
                .padding(.horizontal, 18)

                Spacer()

                HStack(spacing: 10) {
                    NativeActionButton(title: "Focus Browser", systemImage: "macwindow.on.rectangle", appearance: viewModel.state.themeAppearance) {
                        viewModel.focusBrowser()
                    }
                    NativeActionButton(title: "Reload State", systemImage: "arrow.clockwise", appearance: viewModel.state.themeAppearance) {
                        viewModel.openPanel(.menu)
                    }
                }
                .padding(18)
            }
        }
    }
}
