import SwiftUI
import AppKit

struct PanelPalette {
    let appearance: String
    let gradientPreset: String

    init(appearance: String, gradientPreset: String? = nil) {
        self.appearance = appearance
        self.gradientPreset = gradientPreset ?? "graphite"
    }

    var isLight: Bool { appearance == "light" }
    var backgroundGradient: [Color] {
        switch (gradientPreset, isLight) {
        case ("ocean", true):
            return [Color(red: 0.95, green: 0.98, blue: 1.0), Color(red: 0.88, green: 0.95, blue: 0.99), Color(red: 0.90, green: 0.97, blue: 0.97)]
        case ("ocean", false):
            return [Color(red: 0.03, green: 0.09, blue: 0.14), Color(red: 0.05, green: 0.14, blue: 0.24), Color(red: 0.04, green: 0.11, blue: 0.19)]
        case ("aurora", true):
            return [Color(red: 0.99, green: 0.97, blue: 1.0), Color(red: 0.94, green: 0.93, blue: 1.0), Color(red: 0.92, green: 0.98, blue: 0.97)]
        case ("aurora", false):
            return [Color(red: 0.06, green: 0.05, blue: 0.12), Color(red: 0.09, green: 0.12, blue: 0.22), Color(red: 0.11, green: 0.06, blue: 0.18)]
        case ("liquidGlass", true):
            return [Color.white.opacity(0.15), Color.white.opacity(0.08), Color.white.opacity(0.03)]
        case ("liquidGlass", false):
            return [Color(red: 0.12, green: 0.12, blue: 0.16).opacity(0.85), Color(red: 0.08, green: 0.08, blue: 0.12).opacity(0.90), Color.black.opacity(0.95)]
        case ("custom", true):
            return [Color.white.opacity(0.20), Color.white.opacity(0.12), Color.white.opacity(0.05)]
        case ("custom", false):
            return [Color(red: 0.10, green: 0.10, blue: 0.14).opacity(0.90), Color(red: 0.06, green: 0.06, blue: 0.10).opacity(0.95), Color.black.opacity(0.98)]
        default:
            return isLight
                ? [Color(red: 0.97, green: 0.98, blue: 1.0), Color(red: 0.90, green: 0.95, blue: 0.99), Color(red: 0.96, green: 0.95, blue: 0.99)]
                : [Color(red: 0.04, green: 0.07, blue: 0.12), Color(red: 0.07, green: 0.10, blue: 0.18), Color(red: 0.06, green: 0.05, blue: 0.13)]
        }
    }
    var surfaceGradient: [Color] {
        switch gradientPreset {
        case "ocean":
            return isLight
                ? [Color.white.opacity(0.76), Color(red: 0.90, green: 0.97, blue: 0.99).opacity(0.60)]
                : [Color(red: 0.15, green: 0.30, blue: 0.36).opacity(0.28), Color.white.opacity(0.05)]
        case "aurora":
            return isLight
                ? [Color.white.opacity(0.78), Color(red: 0.95, green: 0.92, blue: 1.0).opacity(0.62)]
                : [Color(red: 0.30, green: 0.16, blue: 0.40).opacity(0.22), Color.white.opacity(0.05)]
        case "liquidGlass":
            return isLight
                ? [Color.white.opacity(0.35), Color.white.opacity(0.20), Color.white.opacity(0.08)]
                : [Color.white.opacity(0.15), Color.white.opacity(0.08), Color.white.opacity(0.03)]
        case "custom":
            return isLight
                ? [Color.white.opacity(0.82), Color.white.opacity(0.65)]
                : [Color.white.opacity(0.14), Color.white.opacity(0.07)]
        default:
            return isLight
                ? [Color.white.opacity(0.74), Color.white.opacity(0.52)]
                : [Color.white.opacity(0.11), Color.white.opacity(0.05)]
        }
    }
    var accent: Color {
        switch gradientPreset {
        case "ocean":
            return isLight ? Color(red: 0.06, green: 0.50, blue: 0.84) : Color(red: 0.24, green: 0.86, blue: 0.96)
        case "aurora":
            return isLight ? Color(red: 0.32, green: 0.48, blue: 0.96) : Color(red: 0.42, green: 0.94, blue: 0.84)
        case "liquidGlass":
            return isLight ? Color(red: 0.10, green: 0.60, blue: 0.90) : Color(red: 0.30, green: 0.85, blue: 1.00)
        case "custom":
            return isLight ? Color(red: 0.55, green: 0.27, blue: 0.98) : Color(red: 0.78, green: 0.52, blue: 1.00)
        default:
            return isLight ? Color(red: 0.08, green: 0.56, blue: 0.94) : Color(red: 0.26, green: 0.80, blue: 1.00)
        }
    }
    var secondaryAccent: Color {
        switch gradientPreset {
        case "ocean":
            return isLight ? Color(red: 0.12, green: 0.73, blue: 0.77) : Color(red: 0.34, green: 0.56, blue: 1.00)
        case "aurora":
            return isLight ? Color(red: 0.72, green: 0.40, blue: 0.98) : Color(red: 0.96, green: 0.48, blue: 0.90)
        case "liquidGlass":
            return isLight ? Color(red: 0.50, green: 0.40, blue: 0.98) : Color(red: 0.80, green: 0.50, blue: 1.00)
        case "custom":
            return isLight ? Color(red: 0.02, green: 0.71, blue: 0.84) : Color(red: 0.02, green: 0.92, blue: 0.95)
        default:
            return isLight ? Color(red: 0.43, green: 0.35, blue: 0.96) : Color(red: 0.76, green: 0.44, blue: 1.00)
        }
    }
    var primaryText: Color { isLight ? Color.black.opacity(0.82) : Color.white.opacity(0.95) }
    var secondaryText: Color { isLight ? Color.black.opacity(0.54) : Color.white.opacity(0.58) }
    var subtleText: Color { isLight ? Color.black.opacity(0.35) : Color.white.opacity(0.35) }
    var stroke: Color { isLight ? Color.black.opacity(0.08) : Color.white.opacity(0.09) }
    var cardStroke: Color { stroke }
    var mutedSurface: Color { isLight ? Color.white.opacity(0.58) : Color.white.opacity(0.06) }
    var cardBackground: Color { mutedSurface }
    var shadow: Color { isLight ? Color.black.opacity(0.10) : Color.black.opacity(0.28) }
    var buttonText: Color { isLight ? Color.white : Color.black.opacity(0.86) }
}

struct VisualEffectBackdrop: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    var blendingMode: NSVisualEffectView.BlendingMode = .behindWindow

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.state = .active
        view.blendingMode = blendingMode
        view.material = material
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}

struct PanelShell<Content: View>: View {
    let mode: PanelMode
    let viewModel: NativePanelViewModel
    @ViewBuilder let content: Content

    private var shellMaterial: NSVisualEffectView.Material {
        switch mode {
        case .sidebar, .actionChain:
            return .sidebar
        case .menu:
            return .menu
        default:
            return .hudWindow
        }
    }

    var body: some View {
        let palette = PanelPalette(
            appearance: viewModel.state.themeAppearance,
            gradientPreset: viewModel.state.preferences?.sidebarGradientPreset
        )
        ZStack {
            LinearGradient(colors: palette.backgroundGradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()

            Circle()
                .fill(palette.accent.opacity(0.18))
                .blur(radius: 70)
                .frame(width: 220, height: 220)
                .offset(x: -130, y: -180)

            Circle()
                .fill(palette.secondaryAccent.opacity(0.14))
                .blur(radius: 80)
                .frame(width: 260, height: 260)
                .offset(x: 150, y: 210)

            VStack(spacing: 0) {
                content
            }
            .background(
                ZStack {
                    VisualEffectBackdrop(material: shellMaterial, blendingMode: .behindWindow)
                    LinearGradient(colors: palette.surfaceGradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .stroke(palette.stroke, lineWidth: 1)
            )
            .shadow(color: palette.shadow, radius: mode == .sidebar ? 22 : 36, x: 0, y: mode == .sidebar ? 10 : 18)
            .padding(0)
            .ignoresSafeArea()
        }
        .background(WindowConfigurator(mode: mode, compactSidebar: viewModel.compactSidebar, iconPath: viewModel.configuration.iconPath))
        .preferredColorScheme(viewModel.themeColorScheme)
        .background(Color.clear)
        .ignoresSafeArea()
    }
}

struct PanelHeader: View {
    let title: String
    let subtitle: String
    let symbol: String
    let viewModel: NativePanelViewModel
    let trailing: AnyView?
    let showStatus: Bool

    init(title: String, subtitle: String, symbol: String, viewModel: NativePanelViewModel, showStatus: Bool = true, trailing: AnyView? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.symbol = symbol
        self.viewModel = viewModel
        self.trailing = trailing
        self.showStatus = showStatus
    }

    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance)
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                Label(title, systemImage: symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(palette.primaryText)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(palette.secondaryText)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                if showStatus {
                    ConnectionBadge(isConnected: viewModel.isConnected, text: viewModel.statusText)
                }
                if let trailing {
                    trailing
                }
            }
        }
    }
}

struct ConnectionBadge: View {
    let isConnected: Bool
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isConnected ? Color.green : Color.orange)
                .frame(width: 8, height: 8)
            Text(text)
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.8))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.06))
        .clipShape(Capsule())
    }
}

struct NativeActionButton: View {
    let title: String
    let systemImage: String
    let appearance: String
    let action: () -> Void

    init(title: String, systemImage: String, appearance: String = "dark", action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.appearance = appearance
        self.action = action
    }

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(palette.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(palette.mutedSurface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct SidebarGlyphButton: View {
    let systemImage: String
    let accessibilityLabel: String
    let appearance: String
    let gradientPreset: String?
    let action: () -> Void

    var body: some View {
        let palette = PanelPalette(appearance: appearance, gradientPreset: gradientPreset)
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(palette.primaryText)
                .frame(width: 34, height: 34)
                .background(palette.mutedSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(palette.stroke, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .help(accessibilityLabel)
    }
}

struct SidebarTagChip: View {
    let text: String
    let appearance: String
    let gradientPreset: String?

    var body: some View {
        let palette = PanelPalette(appearance: appearance, gradientPreset: gradientPreset)
        Text(text)
            .font(.system(size: 10, weight: .bold, design: .rounded))
            .foregroundStyle(palette.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(palette.mutedSurface)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(palette.stroke, lineWidth: 1)
            )
    }
}

struct SessionChipView: View {
    let title: String
    let updatedAt: Double
    let isActive: Bool
    let appearance: String
    let gradientPreset: String?

    var body: some View {
        let palette = PanelPalette(appearance: appearance, gradientPreset: gradientPreset)
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(isActive ? palette.buttonText : palette.primaryText)
                .lineLimit(1)
            Text(relativeTimestamp)
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundStyle(isActive ? palette.buttonText.opacity(0.76) : palette.secondaryText)
        }
        .frame(width: 180, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            Group {
                if isActive {
                    LinearGradient(colors: [palette.accent, palette.secondaryAccent], startPoint: .leading, endPoint: .trailing)
                } else {
                    palette.mutedSurface
                }
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isActive ? Color.white.opacity(0.18) : palette.stroke, lineWidth: 1)
        )
    }

    private var relativeTimestamp: String {
        let date = Date(timeIntervalSince1970: updatedAt / 1000)
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct EmptyStateCard: View {
    let title: String
    let description: String
    let appearance: String

    init(title: String, description: String, appearance: String = "dark") {
        self.title = title
        self.description = description
        self.appearance = appearance
    }

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(palette.primaryText)
            Text(description)
                .font(.system(size: 12, design: .rounded))
                .foregroundStyle(palette.secondaryText)
        }
        .padding(16)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 9, weight: .black, design: .rounded))
            .foregroundStyle(.white.opacity(0.82))
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(color)
            .clipShape(Capsule())
    }
}

struct PreferenceCard: View {
    let title: String
    let subtitle: String
    let current: String
    let appearance: String
    let onChange: (String) -> Void

    init(title: String, subtitle: String, current: String, appearance: String = "dark", onChange: @escaping (String) -> Void) {
        self.title = title
        self.subtitle = subtitle
        self.current = current
        self.appearance = appearance
        self.onChange = onChange
    }

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(palette.primaryText)
            Text(subtitle)
                .font(.system(size: 11, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            HStack(spacing: 10) {
                ForEach(["electron", "swiftui"], id: \.self) { option in
                    Button(option.capitalized) { onChange(option) }
                        .buttonStyle(.plain)
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(current == option ? palette.buttonText : palette.primaryText.opacity(0.78))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(current == option ? palette.accent : palette.mutedSurface)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(16)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct TogglePreferenceCard: View {
    let title: String
    let subtitle: String
    let value: Bool
    let appearance: String
    let onChange: (Bool) -> Void

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.primaryText)
                Text(subtitle)
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
            }
            Spacer()
            Toggle("", isOn: Binding(get: { value }, set: { onChange($0) }))
                .toggleStyle(.switch)
                .labelsHidden()
        }
        .padding(16)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct SelectionPreferenceCard: View {
    let title: String
    let subtitle: String
    let current: String
    let options: [(String, String)]
    let appearance: String
    let onChange: (String) -> Void

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(palette.primaryText)
            Text(subtitle)
                .font(.system(size: 11, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            HStack(spacing: 10) {
                ForEach(options, id: \.0) { option in
                    Button(option.1) { onChange(option.0) }
                        .buttonStyle(.plain)
                        .font(.system(size: 11, weight: .black, design: .rounded))
                        .foregroundStyle(current == option.0 ? palette.buttonText : palette.primaryText.opacity(0.78))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(current == option.0 ? palette.accent : palette.mutedSurface)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(16)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct CustomThemeEditor: View {
    let preferences: NativePanelState.Preferences
    let appearance: String
    let onUpdate: (String, Any) -> Void
    
    private let presetColors: [(String, String, Color)] = [
        ("Violet", "violet", Color(red: 0.55, green: 0.27, blue: 0.98)),
        ("Sky", "sky", Color(red: 0.02, green: 0.71, blue: 0.84)),
        ("Rose", "rose", Color(red: 0.95, green: 0.36, blue: 0.47)),
        ("Emerald", "emerald", Color(red: 0.16, green: 0.78, blue: 0.47)),
        ("Amber", "amber", Color(red: 0.98, green: 0.72, blue: 0.12)),
        ("Cyan", "cyan", Color(red: 0.02, green: 0.92, blue: 0.95)),
    ]
    
    private let secondaryColors: [(String, String, Color)] = [
        ("Purple", "purple", Color(red: 0.78, green: 0.52, blue: 1.00)),
        ("Blue", "blue", Color(red: 0.30, green: 0.85, blue: 1.00)),
        ("Pink", "pink", Color(red: 0.98, green: 0.48, blue: 0.72)),
        ("Green", "green", Color(red: 0.20, green: 0.90, blue: 0.60)),
        ("Orange", "orange", Color(red: 0.98, green: 0.62, blue: 0.20)),
        ("Teal", "teal", Color(red: 0.20, green: 0.85, blue: 0.85)),
    ]
    
    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        
        VStack(alignment: .leading, spacing: 16) {
            Text("Primary Accent Color")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            HStack(spacing: 10) {
                ForEach(presetColors, id: \.0) { name, key, color in
                    Button(action: { onUpdate("customPrimaryAccent", key) }) {
                        Circle()
                            .fill(color)
                            .frame(width: 32, height: 32)
                            .overlay(
                                Circle()
                                    .stroke(palette.primaryText.opacity(0.2), lineWidth: 1)
                            )
                            .shadow(color: color.opacity(0.5), radius: 4, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                    .help(name)
                }
            }
            
            Text("Secondary Accent Color")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            HStack(spacing: 10) {
                ForEach(secondaryColors, id: \.0) { name, key, color in
                    Button(action: { onUpdate("customSecondaryAccent", key) }) {
                        Circle()
                            .fill(color)
                            .frame(width: 32, height: 32)
                            .overlay(
                                Circle()
                                    .stroke(palette.primaryText.opacity(0.2), lineWidth: 1)
                            )
                            .shadow(color: color.opacity(0.5), radius: 4, x: 0, y: 2)
                    }
                    .buttonStyle(.plain)
                    .help(name)
                }
            }
            
            Button(action: { onUpdate("sidebarGradientPreset", "graphite") }) {
                Text("Reset to Default")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.red.opacity(0.8))
                    .padding(.vertical, 10)
                    .padding(.horizontal, 16)
                    .background(Color.red.opacity(0.1))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(Color.red.opacity(0.3), lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(palette.mutedSurface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct NativeQuickActionCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let appearance: String
    let action: () -> Void

    var body: some View {
        let palette = PanelPalette(appearance: appearance)

        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(palette.accent)
                    .frame(width: 30, height: 30)
                    .background(palette.accent.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                Text(title)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.primaryText)

                Text(subtitle)
                    .font(.system(size: 10, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 106, alignment: .topLeading)
            .padding(12)
            .background(palette.mutedSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(palette.stroke, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct ElectronSettingsButton: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let appearance: String
    let action: () -> Void
    
    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(palette.accent)
                    .frame(width: 32, height: 32)
                    .background(palette.accent.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(palette.primaryText)
                
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(palette.secondaryText)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(palette.mutedSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(palette.stroke, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
