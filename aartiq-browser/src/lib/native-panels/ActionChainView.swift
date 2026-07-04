import SwiftUI

struct ActionChainPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        PanelShell(mode: .actionChain, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 18) {
                PanelHeader(
                    title: "Native Action Chain",
                    subtitle: "Live execution feed for the same Action Chain the Electron sidebar is running.",
                    symbol: PanelMode.actionChain.symbol,
                    viewModel: viewModel
                )
                .padding(18)

                HStack(spacing: 10) {
                    NativeActionButton(title: "Open Sidebar", systemImage: PanelMode.sidebar.symbol, appearance: viewModel.state.themeAppearance) {
                        viewModel.openPanel(.sidebar)
                    }
                    NativeActionButton(title: "Permissions", systemImage: PanelMode.permissions.symbol, appearance: viewModel.state.themeAppearance) {
                        viewModel.openPanel(.permissions)
                    }
                }
                .padding(.horizontal, 18)

                Divider().overlay(palette.stroke)

                if let terminalLogs = viewModel.state.terminalLogs, !terminalLogs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "terminal").font(.system(size: 11, weight: .bold))
                            Text("TERMINAL OUTPUT")
                                .font(.system(size: 10, weight: .black, design: .rounded))
                                .foregroundStyle(palette.secondaryText)
                            Spacer()
                            Text("\(terminalLogs.count)")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundStyle(Color.secondary)
                        }
                        .foregroundStyle(palette.secondaryText)
                        .padding(.horizontal, 18)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(terminalLogs.suffix(6)) { log in
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 4) {
                                            Circle()
                                                .fill(log.success ? Color.green : Color.red)
                                                .frame(width: 6, height: 6)
                                            Text(log.command)
                                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                                .foregroundStyle(palette.primaryText)
                                                .lineLimit(1)
                                        }
                                        Text(log.output.prefix(30))
                                            .font(.system(size: 8, design: .rounded))
                                            .foregroundStyle(palette.secondaryText)
                                            .lineLimit(1)
                                    }
                                    .padding(8)
                                    .background(palette.mutedSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                            .padding(.horizontal, 18)
                        }
                    }
                    .padding(.vertical, 12)
                }

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if viewModel.state.actionChain.isEmpty {
                            EmptyStateCard(title: "No active chain", description: "When Comet starts executing a multi-step plan, the pending and running steps will appear here in real time.", appearance: viewModel.state.themeAppearance)
                        }
                        ForEach(Array(viewModel.state.actionChain.enumerated()), id: \.element.id) { index, command in
                            HStack(alignment: .top, spacing: 12) {
                                Circle().fill(statusColor(command.status)).frame(width: 12, height: 12)
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(command.type.replacingOccurrences(of: "_", with: " "))
                                            .font(.system(size: 12, weight: .bold, design: .rounded))
                                            .foregroundStyle(palette.primaryText)
                                        Spacer()
                                        Text(command.status.uppercased())
                                            .font(.system(size: 9, weight: .black, design: .rounded))
                                            .foregroundStyle(statusColor(command.status))
                                    }
                                    Text(command.value.isEmpty ? "No payload" : command.value)
                                        .font(.system(size: 11, design: .rounded))
                                        .foregroundStyle(palette.secondaryText)
                                        .lineLimit(4)
                                    HStack(spacing: 8) {
                                        if let category = command.category {
                                            StatusPill(text: category.uppercased(), color: palette.mutedSurface)
                                        }
                                        if let riskLevel = command.riskLevel, !riskLevel.isEmpty, riskLevel != "low" {
                                            StatusPill(text: riskLevel.uppercased(), color: Color.orange.opacity(0.18))
                                        }
                                        if index == viewModel.state.currentCommandIndex {
                                            StatusPill(text: "CURRENT", color: palette.accent.opacity(0.25))
                                        }
                                    }
                                }
                            }
                            .padding(14)
                            .background(palette.mutedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    }
                    .padding(18)
                }
            }
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "completed": return .green
        case "failed": return .red
        case "executing", "awaiting_permission": return .orange
        default: return .white.opacity(0.4)
        }
    }
}
