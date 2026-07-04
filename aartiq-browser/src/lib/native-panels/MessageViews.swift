import SwiftUI

struct MessageBubbleView: View {
    let message: NativePanelState.Message
    let appearance: String
    let animateContent: Bool
    let thinkingSteps: [NativePanelState.ThinkingStep]

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        let parseResult = AICommandParser.parseCommands(from: message.content)
        let visibleContent = AICommandParser.cleanCustomTags(from: parseResult.hasCommands ? parseResult.textWithoutCommands : message.content)
        let reasoningBlocks = resolvedReasoning
        let ocrText = AICommandParser.extractOCRText(from: message)
        let actionLogs = AICommandParser.extractActionLogs(from: message)
        let mediaItems = AICommandParser.extractMediaItems(from: message)

        HStack {
            if message.role == "user" {
                Spacer(minLength: 40)
            }

            VStack(alignment: .leading, spacing: 10) {
                if message.role != "user" && !thinkingSteps.isEmpty {
                    ThinkingStepsCard(steps: thinkingSteps, appearance: appearance)
                }

                HStack {
                    Text(message.role == "user" ? "You" : "Aartiq")
                        .font(.system(size: 10, weight: .black, design: .rounded))
                        .foregroundStyle(message.role == "user" ? palette.accent : palette.secondaryAccent)
                        .textCase(.uppercase)
                    
                    Spacer()
                    
                    if message.role != "user" {
                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(visibleContent, forType: .string)
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(palette.secondaryText.opacity(0.5))
                        }
                        .buttonStyle(.plain)
                        .help("Copy to clipboard")
                    }
                }

                if message.role != "user" {
                    ForEach(reasoningBlocks, id: \.self) { reasoning in
                        ThinkingIndicatorView(appearance: appearance, thought: reasoning)
                    }
                }

                if parseResult.hasCommands && message.role != "user" {
                    ForEach(parseResult.commands) { command in
                        CommandTagView(command: command, appearance: appearance)
                    }
                }

                if !visibleContent.isEmpty {
                    AnimatedMarkdownMessageText(
                        content: visibleContent,
                        appearance: appearance,
                        animate: animateContent
                    )
                }

                if let ocrText, !ocrText.isEmpty {
                    OCRResultCard(label: message.ocrLabel ?? "OCR_RESULT", content: ocrText, appearance: appearance)
                }

                if !actionLogs.isEmpty {
                    ActionLogCard(actionLogs: actionLogs, appearance: appearance)
                }

                if !mediaItems.isEmpty {
                    MediaAttachmentGroup(items: mediaItems, appearance: appearance)
                }
            }
            .padding(14)
            .background(message.role == "user" ? palette.accent.opacity(0.12) : palette.mutedSurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            if message.role != "user" {
                Spacer(minLength: 20)
            }
        }
    }

    private var resolvedReasoning: [String] {
        var values: [String] = []
        if let thinkText = message.thinkText?.trimmingCharacters(in: .whitespacesAndNewlines), !thinkText.isEmpty {
            values.append(thinkText)
        }
        values.append(contentsOf: AICommandParser.extractReasoning(from: message.content))
        var seen = Set<String>()
        return values.filter { value in
            guard !value.isEmpty, !seen.contains(value) else { return false }
            seen.insert(value)
            return true
        }
    }
}

struct ThinkingIndicatorView: View {
    let appearance: String
    let thought: String?
    @State private var isExpanded = false

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    AuroraThinkingIndicatorTiny(appearance: appearance)
                    Text(isExpanded ? "Hide reasoning" : "View reasoning")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(palette.secondaryText)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
            }
            .buttonStyle(.plain)

            if isExpanded, let thought {
                Text(thought)
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(palette.secondaryText.opacity(0.85))
                    .padding(.leading, 20)
                    .padding(.trailing, 10)
                    .padding(.bottom, 4)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
    }
}

struct AuroraThinkingIndicatorTiny: View {
    let appearance: String
    @State private var phase = 0.0

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        ZStack {
            Circle()
                .fill(LinearGradient(colors: [palette.accent, palette.secondaryAccent], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 12, height: 12)
                .rotationEffect(.degrees(phase))
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                phase = 360
            }
        }
    }
}

struct AuroraThinkingView: View {
    let appearance: String
    @State private var phase = 0.0

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(palette.accent.opacity(0.2))
                    .frame(width: 24, height: 24)
                
                Circle()
                    .fill(LinearGradient(colors: [palette.accent, palette.secondaryAccent], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 12, height: 12)
                    .rotationEffect(.degrees(phase))
                    .blur(radius: 2)
            }
            
            Text("Comet is thinking…")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
        }
        .padding(12)
        .background(palette.mutedSurface)
        .clipShape(Capsule())
        .onAppear {
            withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                phase = 360
            }
        }
    }
}



struct CommandTagView: View {
    let command: CommandInfo
    let appearance: String

    var body: some View {
        if command.type == "THINK" {
            ThinkingIndicatorView(appearance: appearance, thought: command.value.isEmpty ? nil : command.value)
        } else {
            standardTagView
        }
    }

    @ViewBuilder
    private var standardTagView: some View {
        let palette = PanelPalette(appearance: appearance)
        HStack(spacing: 8) {
            Image(systemName: iconForCategory(command.category))
                .font(.system(size: 10, weight: .bold))
            Text(command.type.replacingOccurrences(of: "_", with: " "))
                .font(.system(size: 10, weight: .bold, design: .rounded))
            if !command.value.isEmpty {
                Text(command.value.prefix(30) + (command.value.count > 30 ? "..." : ""))
                    .font(.system(size: 9, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(colorForRisk(command.riskLevel))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(colorForRisk(command.riskLevel).opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(colorForRisk(command.riskLevel).opacity(0.3), lineWidth: 1)
        )
    }

    private func iconForCategory(_ category: String) -> String {
        switch category {
        case "navigation": return "globe"
        case "browser": return "safari"
        case "automation": return "gearshape.2"
        case "system": return "terminal"
        case "pdf": return "doc.richtext"
        case "utility": return "wrench.and.screwdriver"
        case "media": return "photo"
        case "meta": return "brain"
        default: return "command"
        }
    }

    private func colorForRisk(_ risk: String) -> Color {
        switch risk {
        case "high": return .red
        case "medium": return .orange
        default: return .green
        }
    }
}

struct OCRResultCard: View {
    let label: String
    let content: String
    let appearance: String

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(label.replacingOccurrences(of: "_", with: " "), systemImage: "viewfinder")
                    .font(.system(size: 10, weight: .black, design: .rounded))
                    .foregroundStyle(Color.orange.opacity(0.95))
                Spacer()
                Text("\(content.count) chars")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
            }

            ScrollView(.vertical, showsIndicators: true) {
                Text(content)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(palette.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 180)
        }
        .padding(12)
        .background(Color.orange.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.orange.opacity(0.25), lineWidth: 1)
        )
    }
}

struct ActionLogCard: View {
    let actionLogs: [NativePanelState.ActionLog]
    let appearance: String

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 8) {
            Label("Action Chain", systemImage: "point.3.filled.connected.trianglepath.dotted")
                .font(.system(size: 10, weight: .black, design: .rounded))
                .foregroundStyle(palette.secondaryAccent)

            ForEach(Array(actionLogs.prefix(8).enumerated()), id: \.offset) { index, log in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("\(index + 1). \(log.type.replacingOccurrences(of: "_", with: " "))")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(palette.primaryText)
                        Spacer()
                        StatusPill(text: log.success ? "DONE" : "FAILED", color: log.success ? Color.green.opacity(0.25) : Color.red.opacity(0.25))
                    }
                    Text(log.output)
                        .font(.system(size: 10, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                        .lineLimit(4)
                        .textSelection(.enabled)
                }
                .padding(10)
                .background(Color.white.opacity(appearance == "light" ? 0.45 : 0.04))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .padding(12)
        .background(palette.mutedSurface.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct MediaAttachmentGroup: View {
    let items: [NativePanelState.MediaItem]
    let appearance: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Media", systemImage: "photo.on.rectangle.angled")
                .font(.system(size: 10, weight: .black, design: .rounded))
                .foregroundStyle(PanelPalette(appearance: appearance).secondaryAccent)

            ForEach(items, id: \.stableId) { item in
                MediaAttachmentCard(item: item, appearance: appearance)
            }
        }
    }
}

struct MediaAttachmentCard: View {
    let item: NativePanelState.MediaItem
    let appearance: String

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(titleText, systemImage: systemIcon)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(palette.primaryText)
                Spacer()
                Text(item.type.uppercased())
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
            }

            if let thumbnailUrl = item.thumbnailUrl, let url = URL(string: thumbnailUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } placeholder: {
                    Rectangle()
                        .fill(palette.mutedSurface)
                        .frame(height: 160)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            if let caption = item.caption, !caption.isEmpty {
                Text(caption)
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(palette.primaryText)
            }

            if let desc = item.description, !desc.isEmpty {
                Text(desc)
                    .font(.system(size: 10, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
                    .lineLimit(3)
            }
            
            if let code = item.code, !code.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(code)
                        .font(.system(size: 9, design: .monospaced))
                        .padding(8)
                        .background(palette.mutedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(12)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var titleText: String {
        item.title ?? item.caption ?? "Attached \(item.type)"
    }

    private var systemIcon: String {
        switch item.type {
        case "image": return "photo"
        case "video": return "play.rectangle"
        case "diagram": return "projective"
        case "chart": return "chart.bar"
        case "pdf": return "doc.richtext"
        default: return "paperclip"
        }
    }
}

struct ThinkingStepsCard: View {
    let steps: [NativePanelState.ThinkingStep]
    let appearance: String
    @State private var isExpanded = false

    var body: some View {
        let palette = PanelPalette(appearance: appearance)
        let hasRunning = steps.contains { $0.status == "running" }
        
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 8) {
                    if hasRunning {
                        AuroraThinkingIndicatorTiny(appearance: appearance)
                    } else {
                        ZStack {
                            Circle()
                                .fill(palette.secondaryAccent.opacity(0.2))
                                .frame(width: 14, height: 14)
                            Image(systemName: "brain")
                                .font(.system(size: 7, weight: .bold))
                                .foregroundStyle(palette.secondaryAccent)
                        }
                    }
                    
                    Text(isExpanded ? "Hide thinking" : "View thinking")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                    
                    Spacer()
                    
                    if !isExpanded && steps.count > 0 {
                        Text("\(steps.count)")
                            .font(.system(size: 9, weight: .black, design: .rounded))
                            .foregroundStyle(palette.secondaryText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(palette.secondaryAccent.opacity(0.15))
                            .clipShape(Capsule())
                    }
                    
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(palette.secondaryText)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
            }
            .buttonStyle(.plain)
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(steps, id: \.id) { step in
                        HStack(spacing: 8) {
                            statusIcon(for: step.status, palette: palette)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.label)
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .foregroundStyle(statusColor(for: step.status))
                                    .lineLimit(2)
                                
                                if let detail = step.detail, !detail.isEmpty {
                                    Text(detail)
                                        .font(.system(size: 9, design: .rounded))
                                        .foregroundStyle(palette.secondaryText.opacity(0.6))
                                        .lineLimit(2)
                                }
                            }
                        }
                        .padding(8)
                        .background(palette.mutedSurface.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    }
                }
                .padding(.top, 4)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 6)
    }
    
    @ViewBuilder
    private func statusIcon(for status: String, palette: PanelPalette) -> some View {
        ZStack {
            Circle()
                .stroke(statusColor(for: status).opacity(0.5), lineWidth: 1.5)
                .frame(width: 16, height: 16)
            
            if status == "running" {
                Circle()
                    .fill(palette.secondaryAccent.opacity(0.3))
                    .frame(width: 8, height: 8)
                    .modifier(PulseModifier())
            } else if status == "done" {
                Image(systemName: "checkmark")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.green)
            } else {
                Image(systemName: "xmark")
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(Color.red)
            }
        }
    }
    
    private func statusColor(for status: String) -> Color {
        switch status {
        case "running": return PanelPalette(appearance: appearance).secondaryAccent
        case "done": return Color.white.opacity(0.6)
        case "error": return Color.red
        default: return Color.white.opacity(0.6)
        }
    }
}

struct PulseModifier: ViewModifier {
    @State private var pulsing = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(pulsing ? 1.2 : 1.0)
            .opacity(pulsing ? 0.7 : 1.0)
            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulsing)
            .onAppear { pulsing = true }
    }
}
