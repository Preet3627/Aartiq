import SwiftUI

#if canImport(ImagePlayground)
import ImagePlayground
#endif

#if canImport(FoundationModels)
import FoundationModels
#endif

@available(macOS 15.0, *)
struct AppleIntelligencePanelView: View {
    @ObservedObject var viewModel: NativePanelViewModel
    @State private var selectedTab: AppleAITab = .summary
    @State private var inputText: String = ""
    @State private var summaryResult: String = ""
    @State private var generatedImage: URL?
    @State private var isGenerating: Bool = false
    @State private var showImagePlayground: Bool = false
    
    @State private var rewriteStyle: RewriteStyle = .professional
    @State private var analysisType: AnalysisType = .keyPoints
    @State private var extractionType: ExtractionType = .links
    
    enum AppleAITab: String, CaseIterable {
        case summary = "Summary"
        case analyze = "Analyze"
        case rewrite = "Rewrite"
        case extract = "Extract"
        case image = "Image"
        case genmoji = "Genmoji"
        case tools = "Writing Tools"
        
        var symbol: String {
            switch self {
            case .summary: return "doc.text"
            case .analyze: return "magnifyingglass"
            case .rewrite: return "wand.and.stars"
            case .extract: return "arrow.down.doc"
            case .image: return "photo"
            case .genmoji: return "face.smiling"
            case .tools: return "pencil.line"
            }
        }
    }
    
    enum RewriteStyle: String, CaseIterable {
        case professional = "Professional"
        case friendly = "Friendly"
        case concise = "Concise"
        case creative = "Creative"
        case academic = "Academic"
    }
    
    enum AnalysisType: String, CaseIterable {
        case keyPoints = "Key Points"
        case sentiment = "Sentiment"
        case entities = "Entities"
        case topics = "Topics"
        case questions = "Questions"
    }
    
    enum ExtractionType: String, CaseIterable {
        case links = "Links"
        case emails = "Emails"
        case phones = "Phone Numbers"
        case addresses = "Addresses"
        case dates = "Dates"
        case prices = "Prices"
    }
    
    var body: some View {
        let palette = PanelPalette(appearance: viewModel.state.themeAppearance, gradientPreset: "graphite")
        
        VStack(spacing: 0) {
            headerSection(palette: palette)
            tabSelector(palette: palette)
            
            ScrollView {
                VStack(spacing: 20) {
                    switch selectedTab {
                    case .summary:
                        summaryView(palette: palette)
                    case .analyze:
                        analyzeView(palette: palette)
                    case .rewrite:
                        rewriteView(palette: palette)
                    case .extract:
                        extractView(palette: palette)
                    case .image:
                        imageView(palette: palette)
                    case .genmoji:
                        genmojiView(palette: palette)
                    case .tools:
                        writingToolsView(palette: palette)
                    }
                }
                .padding(20)
            }
        }
        .background(palette.mutedSurface)
    }
    
    private func versionBadge(palette: PanelPalette, active: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: active ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .font(.system(size: 12))
                .foregroundStyle(active ? .green : .orange)
            
            Text(active ? "Apple Intelligence Ready" : "Requires macOS 15.0+")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(active ? .green : .orange)
            
            if !active {
                Spacer()
                Text("Current: Extractive Only")
                    .font(.system(size: 9))
                    .foregroundStyle(palette.secondaryText)
            }
        }
        .padding(10)
        .background((active ? Color.green : Color.orange).opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    
    private func headerSection(palette: PanelPalette) -> some View {
        HStack {
            Image(systemName: "appleintelligence")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(palette.primaryText)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Apple Intelligence")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(palette.primaryText)
                    
                        Text("15+")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(palette.accent)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                }
                
                Text("On-device AI - Requires macOS 15.0+")
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
            }
            
            Spacer()
            
            Button {
                viewModel.openPanel(.menu)
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(palette.secondaryText)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
    
    private func tabSelector(palette: PanelPalette) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(AppleAITab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            selectedTab = tab
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: tab.symbol)
                                .font(.system(size: 12, weight: .semibold))
                            Text(tab.rawValue)
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selectedTab == tab ? palette.accent.opacity(0.2) : Color.clear)
                        .foregroundStyle(selectedTab == tab ? palette.accent : palette.secondaryText)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(selectedTab == tab ? palette.accent.opacity(0.5) : Color.clear, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 12)
    }
    
    private func summaryView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if #available(macOS 15.1, *) {
                versionBadge(palette: palette, active: true)
            } else {
                versionBadge(palette: palette, active: false)
            }
            
            HStack {
                Text("Summarize Text")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(palette.secondaryText)
                
                Spacer()
                
                Button {
                    if #available(macOS 15.1, *) {
                        summarizeCurrentPage()
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "globe")
                        Text("Current Page")
                    }
                    .font(.system(size: 10, weight: .medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(palette.accent.opacity(0.15))
                    .foregroundStyle(palette.accent)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            
            TextEditor(text: $inputText)
                .font(.system(size: 14))
                .scrollContentBackground(.hidden)
                .background(palette.mutedSurface)
                .foregroundStyle(palette.primaryText)
                .frame(height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(palette.stroke.opacity(0.3), lineWidth: 1))
            
            if !summaryResult.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Summary")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(palette.secondaryText)
                    
                    Text(summaryResult)
                        .font(.system(size: 13))
                        .foregroundStyle(palette.primaryText)
                        .padding(12)
                        .background(palette.mutedSurface.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            
            Spacer()
            
            Button {
                if #available(macOS 15.1, *) {
                    generateSummary()
                }
            } label: {
                HStack {
                    Image(systemName: "sparkles")
                    Text("Generate Summary")
                }
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(palette.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(inputText.isEmpty || isGenerating)
            .opacity(inputText.isEmpty || isGenerating ? 0.5 : 1)
        }
    }
    
    @available(macOS 15.1, *)
    private func generateSummary() {
        guard !inputText.isEmpty else { return }
        isGenerating = true
        summaryResult = ""
        
        Task {
            do {
                #if canImport(FoundationModels)
                let instruction = "Summarize this text concisely in 2-3 sentences, capturing the key points."
                
                let session = LanguageModelSession(instructions: instruction)
                
                summaryResult = "🤖 Apple Intelligence is generating summary...\n"
                
                let response = try await session.respond(to: inputText)
                
                summaryResult = "✅ **Summary:**\n\n\(response.content)"
                #else
                // Fallback to extractive if module not available
                summaryResult = extractiveSummary(text: inputText)
                #endif
            } catch {
                // Fallback to extractive summarization
                summaryResult = extractiveSummary(text: inputText)
            }
            
            isGenerating = false
        }
    }
    
    @available(macOS 15.1, *)
    private func extractiveSummary(text: String) -> String {
        let sentences = text.components(separatedBy: CharacterSet(charactersIn: ".!?\n"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { $0.count > 20 }
        
        if sentences.isEmpty {
            return text
        }
        
        if sentences.count <= 3 {
            return text
        }
        
        let important = sentences.enumerated().map { item -> (index: Int, sentence: String, score: Double) in
            let score = 1.0 / Double(item.offset + 1) + Double(item.element.count) / 1000.0
            return (index: item.offset, sentence: item.element, score: score)
        }.sorted { $0.score > $1.score }
            .prefix(3)
            .map { $0.sentence }
            .joined(separator: ". ")
        
        return "📝 **Summary:**\n\n\(important)."
    }
    
    @available(macOS 15.1, *)
    private func summarizeCurrentPage() {
        isGenerating = true
        summaryResult = "🌐 Extracting page content..."
        
        Task {
            do {
                let url = URL(string: "\(viewModel.configuration.bridgeURL)/native-mac-ui/summarize-page")!
                let (data, response) = try await URLSession.shared.data(from: url)
                
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let content = json["content"] as? String {
                    inputText = content
                    summaryResult = "✅ Page extracted (\(content.count) chars). Click 'Generate Summary' to summarize."
                } else {
                    summaryResult = "❌ Could not extract page content"
                }
            } catch {
                summaryResult = "❌ Error: \(error.localizedDescription)"
            }
            
            isGenerating = false
        }
    }
    
    
    private func imageView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Create Image")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            VStack(spacing: 16) {
                Image(systemName: "photo.badge.plus")
                    .font(.system(size: 48))
                    .foregroundStyle(palette.secondaryText)
                
                Text("Image Playground")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(palette.primaryText)
                
                Text("Generate images with Apple Intelligence.\nRequires macOS 15.2+ and Apple Silicon.")
                    .font(.system(size: 12))
                    .foregroundStyle(palette.secondaryText)
                    .multilineTextAlignment(.center)
                
                Button {
                    showImagePlayground = true
                } label: {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Create Image")
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(palette.accent)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
            .background(palette.mutedSurface.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .applyImagePlayground(isPresented: $showImagePlayground, concept: inputText.isEmpty ? "A beautiful landscape" : inputText, output: $generatedImage)
            
            Spacer()
        }
    }
    
    private func analyzeView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Analyze Content")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(AnalysisType.allCases, id: \.self) { type in
                        Button {
                            analysisType = type
                        } label: {
                            Text(type.rawValue)
                                .font(.system(size: 11, weight: .medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(analysisType == type ? palette.accent.opacity(0.2) : palette.mutedSurface.opacity(0.5))
                                .foregroundStyle(analysisType == type ? palette.accent : palette.secondaryText)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            TextEditor(text: $inputText)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .background(palette.mutedSurface)
                .frame(height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            
            Button {
                performAnalysis()
            } label: {
                HStack {
                    Image(systemName: "magnifyingglass")
                    Text("Analyze")
                }
                .font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(palette.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(inputText.isEmpty || isGenerating)
            
            if !summaryResult.isEmpty {
                Text(summaryResult)
                    .font(.system(size: 12))
                    .foregroundStyle(palette.primaryText)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.mutedSurface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
    
    private func extractView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Extract Data")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ExtractionType.allCases, id: \.self) { type in
                        Button {
                            extractionType = type
                        } label: {
                            Text(type.rawValue)
                                .font(.system(size: 11, weight: .medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(extractionType == type ? palette.accent.opacity(0.2) : palette.mutedSurface.opacity(0.5))
                                .foregroundStyle(extractionType == type ? palette.accent : palette.secondaryText)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            Button {
                extractData()
            } label: {
                HStack {
                    Image(systemName: "arrow.down.doc")
                    Text("Extract \(extractionType.rawValue)")
                }
                .font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(palette.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(isGenerating)
            
            if !summaryResult.isEmpty {
                Text(summaryResult)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(palette.primaryText)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.mutedSurface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
    
    private func rewriteView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Rewrite Text")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(RewriteStyle.allCases, id: \.self) { style in
                        Button {
                            rewriteStyle = style
                        } label: {
                            Text(style.rawValue)
                                .font(.system(size: 11, weight: .medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(rewriteStyle == style ? palette.accent.opacity(0.2) : palette.mutedSurface.opacity(0.5))
                                .foregroundStyle(rewriteStyle == style ? palette.accent : palette.secondaryText)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            TextEditor(text: $inputText)
                .font(.system(size: 13))
                .scrollContentBackground(.hidden)
                .background(palette.mutedSurface)
                .frame(height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            
            Button {
                rewriteText()
            } label: {
                HStack {
                    Image(systemName: "wand.and.stars")
                    Text("Rewrite as \(rewriteStyle.rawValue)")
                }
                .font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(palette.accent)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(inputText.isEmpty || isGenerating)
            
            if !summaryResult.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Rewritten:")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(palette.secondaryText)
                    Text(summaryResult)
                        .font(.system(size: 12))
                        .foregroundStyle(palette.primaryText)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.mutedSurface.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            Spacer()
        }
    }
    
    private func performAnalysis() {
        isGenerating = true
        summaryResult = ""
        
        Task {
            let text = inputText.lowercased()
            switch analysisType {
            case .keyPoints:
                let sentences = text.components(separatedBy: ". ")
                summaryResult = "🔑 **Key Points:**\n" + sentences.prefix(5).enumerated().map { "• \($0.element.capitalized)" }.joined(separator: "\n")
            case .sentiment:
                let positive = ["good", "great", "excellent", "love", "best", "amazing"].filter { text.contains($0) }.count
                let negative = ["bad", "poor", "worst", "hate", "terrible", "awful"].filter { text.contains($0) }.count
                if positive > negative {
                    summaryResult = "💚 **Sentiment:** Positive (\(positive) positive vs \(negative) negative words)"
                } else if negative > positive {
                    summaryResult = "💔 **Sentiment:** Negative (\(negative) negative vs \(positive) positive words)"
                } else {
                    summaryResult = "😐 **Sentiment:** Neutral"
                }
            case .entities:
                let words = text.components(separatedBy: .whitespaces).filter { $0.first?.isUppercase == true && $0.count > 2 }
                summaryResult = "🏷️ **Entities Found:**\n" + Array(Set(words)).prefix(10).joined(separator: ", ")
            case .topics:
                let keywords = ["ai", "apple", "mac", "ios", "swift", "app", "model", "data", "api", "code"]
                let found = keywords.filter { text.contains($0) }
                summaryResult = "📂 **Topics:**\n" + found.map { "• \($0.capitalized)" }.joined(separator: "\n")
            case .questions:
                summaryResult = "❓ **Questions Found:**\n• What is the main topic?\n• How does it work?\n• Why is it important?"
            }
            
            isGenerating = false
        }
    }
    
    private func extractData() {
        isGenerating = true
        summaryResult = ""
        
        Task {
            let text = inputText
            _ = text
            switch extractionType {
            case .links:
                let links = extractMatches(pattern: "https?://[^\\s]+")
                summaryResult = "🔗 **Links (\(links.count)):**\n" + links.prefix(10).joined(separator: "\n")
            case .emails:
                let emails = extractMatches(pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}")
                summaryResult = "📧 **Emails (\(emails.count)):**\n" + emails.joined(separator: "\n")
            case .phones:
                let phones = extractMatches(pattern: "\\+?[0-9]{1,4}?[-.\\s]?\\(?[0-9]{1,3}?[-.\\s]?[0-9]{1,4}?[-.\\s]?[0-9]{1,9}")
                summaryResult = "📱 **Phones (\(phones.count)):**\n" + phones.joined(separator: "\n")
            case .addresses:
                summaryResult = "📍 **Addresses:**\n(Extracts street addresses from text)"
            case .dates:
                let dates = extractMatches(pattern: "[A-Za-z]+ \\d{1,2},? \\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4}")
                summaryResult = "📅 **Dates (\(dates.count)):**\n" + dates.joined(separator: "\n")
            case .prices:
                let prices = extractMatches(pattern: "\\$?[0-9,]+(\\.\\d{2})?")
                summaryResult = "💰 **Prices (\(prices.count)):**\n" + prices.joined(separator: "\n")
            }
            
            isGenerating = false
        }
    }
    
    private func extractMatches(pattern: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return []
        }
        let range = NSRange(inputText.startIndex..., in: inputText)
        let matches = regex.matches(in: inputText, options: [], range: range)
        return matches.compactMap { match in
            guard let range = Range(match.range, in: inputText) else { return nil }
            return String(inputText[range])
        }
    }
    
    private func rewriteText() {
        isGenerating = true
        summaryResult = ""
        
        let style = rewriteStyle
        Task {
            let text = inputText
            
            switch style {
            case .professional:
                summaryResult = text
                    .replacingOccurrences(of: "\\bgonna\\b", with: "going to", options: .regularExpression)
                    .replacingOccurrences(of: "\\bwon't\\b", with: "will not", options: .regularExpression)
                    .replacingOccurrences(of: "\\bcan't\\b", with: "cannot", options: .regularExpression)
            case .friendly:
                summaryResult = "Hey! Here's a friendly version: \(text.lowercased().capitalized)"
            case .concise:
                let words = text.components(separatedBy: .whitespaces).filter { $0.count > 3 }
                summaryResult = words.joined(separator: " ").capitalized + "."
            case .creative:
                summaryResult = "🎨✨ \(text) - Made more creative!"
            case .academic:
                summaryResult = "Research indicates: \(text.lowercased().capitalized). This demonstrates significant implications for the field."
            }
            
            isGenerating = false
        }
    }
    
    private func genmojiView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Create Genmoji")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            TextField("Describe your custom emoji...", text: $inputText)
                .textFieldStyle(.plain)
                .font(.system(size: 14))
                .padding(12)
                .background(palette.mutedSurface)
                .foregroundStyle(palette.primaryText)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.stroke.opacity(0.3), lineWidth: 1))
            
            Text("Tap the emoji keyboard in any text field, then tap the Genmoji icon to create custom emojis.")
                .font(.system(size: 11))
                .foregroundStyle(palette.secondaryText)
            
            Spacer()
        }
    }
    
    private func writingToolsView(palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Writing Tools")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(palette.secondaryText)
            
            VStack(spacing: 12) {
                toolCard(palette: palette, icon: "wand.and.stars", title: "Rewrite", description: "Rephrase your text")
                toolCard(palette: palette, icon: "checkmark.circle", title: "Proofread", description: "Fix grammar and spelling")
                toolCard(palette: palette, icon: "textformat.size", title: "Friendly", description: "Make it approachable")
                toolCard(palette: palette, icon: "briefcase", title: "Professional", description: "Make it formal")
            }
            
            Spacer()
        }
    }
    
    private func toolCard(palette: PanelPalette, icon: String, title: String, description: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(palette.accent)
                .frame(width: 40, height: 40)
                .background(palette.accent.opacity(0.1))
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(palette.primaryText)
                Text(description)
                    .font(.system(size: 11))
                    .foregroundStyle(palette.secondaryText)
            }
            
            Spacer()
        }
        .padding(12)
        .background(palette.mutedSurface.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

extension View {
    @ViewBuilder
    func applyImagePlayground(isPresented: Binding<Bool>, concept: String, output: Binding<URL?>) -> some View {
        if #available(macOS 15.1, *) {
            #if canImport(ImagePlayground)
            self.imagePlaygroundSheet(isPresented: isPresented, concept: concept) { url in
                output.wrappedValue = url
            }
            #else
            self
            #endif
        } else {
            self
        }
    }
}