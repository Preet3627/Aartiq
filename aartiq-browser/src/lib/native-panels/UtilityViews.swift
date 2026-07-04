import SwiftUI

struct DownloadsPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        PanelShell(mode: .downloads, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 18) {
                PanelHeader(
                    title: "Native Downloads",
                    subtitle: "Monitor downloads and open files without opening the Electron overlay.",
                    symbol: PanelMode.downloads.symbol,
                    viewModel: viewModel
                )
                .padding(18)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        let downloads = viewModel.state.downloads ?? []
                        if downloads.isEmpty {
                            EmptyStateCard(title: "No downloads yet", description: "Completed and active downloads from Comet will appear here.", appearance: viewModel.state.themeAppearance)
                        }
                        ForEach(downloads) { item in
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text(item.name)
                                        .font(.system(size: 13, weight: .bold, design: .rounded))
                                        .foregroundStyle(palette.primaryText)
                                        .lineLimit(1)
                                    Spacer()
                                    StatusPill(text: item.status.uppercased(), color: item.status == "completed" ? .green.opacity(0.2) : palette.mutedSurface)
                                }
                                ProgressView(value: item.progress ?? 0, total: 100)
                                    .tint(palette.accent)
                                Text(item.path ?? "Waiting for file path")
                                    .font(.system(size: 10, design: .rounded))
                                    .foregroundStyle(palette.secondaryText)
                                    .lineLimit(2)
                                HStack(spacing: 10) {
                                    NativeActionButton(title: "Open", systemImage: "arrow.up.forward.app", appearance: viewModel.state.themeAppearance) {
                                        viewModel.openDownload(path: item.path)
                                    }
                                    NativeActionButton(title: "Reveal", systemImage: "folder", appearance: viewModel.state.themeAppearance) {
                                        viewModel.revealDownload(path: item.path)
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
}

struct ClipboardPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        PanelShell(mode: .clipboard, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 18) {
                PanelHeader(
                    title: "Native Clipboard",
                    subtitle: "Browse clipboard history and copy items back instantly.",
                    symbol: PanelMode.clipboard.symbol,
                    viewModel: viewModel
                )
                .padding(18)

                HStack(spacing: 10) {
                    NativeActionButton(title: "Clear History", systemImage: "trash", appearance: viewModel.state.themeAppearance) {
                        viewModel.clearClipboardHistory()
                    }
                    NativeActionButton(title: "Open Settings", systemImage: PanelMode.settings.symbol, appearance: viewModel.state.themeAppearance) {
                        viewModel.openPanel(.settings)
                    }
                }
                .padding(.horizontal, 18)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        let items = viewModel.state.clipboardItems ?? []
                        if items.isEmpty {
                            EmptyStateCard(title: "Clipboard is empty", description: "Copied text from Comet and synced devices will show up here.", appearance: viewModel.state.themeAppearance)
                        }
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(item)
                                    .font(.system(size: 12, design: .rounded))
                                    .foregroundStyle(palette.primaryText)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .lineLimit(4)
                                NativeActionButton(title: "Copy Again", systemImage: "doc.on.doc", appearance: viewModel.state.themeAppearance) {
                                    viewModel.copyClipboardItem(item)
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
}

struct PermissionsPanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        PanelShell(mode: .permissions, viewModel: viewModel) {
            VStack(alignment: .leading, spacing: 18) {
                PanelHeader(
                    title: "Action Approvals",
                    subtitle: "Review and manage permissions for system operations requested by Aartiq.",
                    symbol: PanelMode.permissions.symbol,
                    viewModel: viewModel
                )
                .padding(18)

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let approval = viewModel.state.pendingApproval {
                            ApprovalCard(approval: approval, viewModel: viewModel, appearance: viewModel.state.themeAppearance)
                        } else {
                            EmptyStateCard(title: "No pending approvals", description: "When Comet wants to run a shell command or access secure files, the request will appear here for you to verify.", appearance: viewModel.state.themeAppearance)
                        }

                        if viewModel.state.pendingApproval == nil {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.shield")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.green)
                                Text("System is secure. Comet cannot run terminal commands without your explicit consent.")
                                    .font(.system(size: 11, design: .rounded))
                                    .foregroundStyle(palette.secondaryText)
                            }
                            .padding(14)
                            .background(palette.mutedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                    .padding(18)
                }
            }
        }
    }
}

struct ApprovalCard: View {
    let approval: NativePanelState.ApprovalState
    let viewModel: NativePanelViewModel
    let appearance: String

    @State private var showingUnlockAlert = false
    @State private var unlockError: String?
    @State private var isProcessing = false

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        let isHighRisk = approval.risk == "high"

        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label(isHighRisk ? "SECURITY ALERT" : "PERMISSION REQUIRED", systemImage: isHighRisk ? "exclamationmark.triangle.fill" : "hand.raised.fill")
                    .font(.system(size: 11, weight: .black, design: .rounded))
                    .foregroundStyle(isHighRisk ? Color.red : Color.orange)
                Spacer()
                StatusPill(text: approval.risk.uppercased(), color: isHighRisk ? Color.red.opacity(0.8) : Color.orange.opacity(0.8))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(approval.reason)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.primaryText)
                
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(approval.command)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(palette.primaryText)
                        .padding(10)
                        .background(Color.black.opacity(appearance == "light" ? 0.05 : 0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            if isHighRisk, let qrText = approval.highRiskQr {
                VStack(spacing: 8) {
                    Text("APPROVE VIA MOBILE")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                    
                    if let image = generateQRCode(from: qrText) {
                        Image(nsImage: image)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 120, height: 120)
                            .padding(10)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    
                    if let pin = approval.expectedPin {
                        Text("Device PIN: \(pin)")
                            .font(.system(size: 14, weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.primaryText)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(palette.mutedSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else if isHighRisk {
                HStack {
                    Image(systemName: "lock.shield.fill")
                        .foregroundStyle(.orange)
                    Text("This action modifies system files or settings. Device unlock is recommended.")
                        .font(.system(size: 11, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                }
                .padding(12)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 12) {
                Button {
                    viewModel.respondToApproval(approval.requestId, allowed: false)
                } label: {
                    Text("Decline")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(palette.mutedSurface)
                        .foregroundStyle(palette.primaryText)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)

                Button {
                    handleApproval(isHighRisk: isHighRisk)
                } label: {
                    HStack(spacing: 6) {
                        if isProcessing {
                            ProgressView()
                                .controlSize(.small)
                        } else if isHighRisk {
                            Image(systemName: "faceid")
                        }
                        Text(isProcessing ? "Verifying..." : "Approve Run")
                    }
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(isHighRisk ? Color.red.opacity(0.9) : palette.accent)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(isProcessing)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(isHighRisk ? Color.red.opacity(0.3) : palette.stroke, lineWidth: 1)
        )
        .alert(isPresented: $showingUnlockAlert) {
            Alert(
                title: Text("Authentication Failed"),
                message: Text(unlockError ?? "Unable to verify device owner."),
                dismissButton: .default(Text("OK")) { unlockError = nil }
            )
        }
    }

    @MainActor private func handleApproval(isHighRisk: Bool) {
        if isHighRisk {
            isProcessing = true
            Task {
                let result = await viewModel.verifyDeviceOwnerApproval(
                    reason: approval.reason,
                    command: approval.command,
                    risk: approval.risk
                )
                
                Task.detached { @MainActor in
                    isProcessing = false
                    if result.approved {
                        viewModel.respondToApproval(approval.requestId, allowed: true, deviceUnlockValidated: true)
                    } else if let error = result.error {
                        unlockError = error
                        showingUnlockAlert = true
                    }
                }
            }
        } else {
            viewModel.respondToApproval(approval.requestId, allowed: true)
        }
    }

    private func generateQRCode(from string: String) -> NSImage? {
        let data = string.data(using: String.Encoding.ascii)
        if let filter = CIFilter(name: "CIQRCodeGenerator") {
            filter.setValue(data, forKey: "inputMessage")
            let transform = CGAffineTransform(scaleX: 5, y: 5)
            if let output = filter.outputImage?.transformed(by: transform) {
                let rep = NSCIImageRep(ciImage: output)
                let nsImage = NSImage(size: rep.size)
                nsImage.addRepresentation(rep)
                return nsImage
            }
        }
        return nil
    }
}
