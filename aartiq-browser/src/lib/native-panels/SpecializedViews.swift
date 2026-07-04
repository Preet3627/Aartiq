import SwiftUI
import WebKit

struct RichMarkdownView: NSViewRepresentable {
    let content: String
    let appearance: String
    
    class Coordinator: NSObject, WKNavigationDelegate {
        var lastContent: String = ""
        var webView: WKWebView?
        
        func updateContent(_ content: String, isDark: Bool) {
            guard let webView = webView else { return }
            
            // If content is empty/new or drastically different, do a full load
            if lastContent.isEmpty || abs(content.count - lastContent.count) > 1000 {
                let html = generateHTML(content: content, isDark: isDark)
                webView.loadHTMLString(html, baseURL: nil)
            } else {
                // For small incremental updates (streaming), inject via JS for "instant" feel
                let escaped = content
                    .replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "'", with: "\\'")
                    .replacingOccurrences(of: "\n", with: "\\n")
                    .replacingOccurrences(of: "\r", with: "")
                
                let js = "if (window.updateContent) { window.updateContent('\(escaped)'); } else { window.location.reload(); }"
                webView.evaluateJavaScript(js)
            }
            lastContent = content
        }
        
        private func generateHTML(content: String, isDark: Bool) -> String {
            let escapedContent = content
                .replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
            
            let textColor = isDark ? "#ffffff" : "#1a1a1a"
            let codeBg = isDark ? "#2d2d3d" : "#f5f5f5"
            let accentColor = "#6366f1"
            
            return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'Outfit', sans-serif;
                        color: \(textColor);
                        background: transparent;
                        line-height: 1.6;
                        font-size: 14px;
                        padding: 0;
                        overflow-x: hidden;
                    }
                    #content {
                        white-space: pre-wrap;
                        word-break: break-word;
                    }
                    pre {
                        background: \(codeBg);
                        padding: 12px;
                        border-radius: 8px;
                        overflow-x: auto;
                        margin: 12px 0;
                        font-family: 'JetBrains Mono', 'Fira Code', monospace;
                        font-size: 13px;
                    }
                    code {
                        font-family: 'JetBrains Mono', 'Fira Code', monospace;
                        background: \(codeBg);
                        padding: 2px 4px;
                        border-radius: 4px;
                    }
                    blockquote {
                        border-left: 4px solid \(accentColor);
                        padding-left: 12px;
                        color: \(isDark ? "#a1a1aa" : "#4b5563");
                        margin: 12px 0;
                    }
                    #thinking-indicator {
                        color: \(accentColor);
                        font-style: italic;
                        font-size: 12px;
                        margin-bottom: 8px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    @keyframes pulse {
                        0% { opacity: 0.4; }
                        50% { opacity: 1; }
                        100% { opacity: 0.4; }
                    }
                    .dot { animation: pulse 1.5s infinite; }
                    .dot:nth-child(2) { animation-delay: 0.2s; }
                    .dot:nth-child(3) { animation-delay: 0.4s; }
                </style>
            </head>
            <body>
                <div id="content">\(escapedContent)</div>
                <script>
                    window.updateContent = function(newContent) {
                        const contentDiv = document.getElementById('content');
                        contentDiv.innerText = newContent;
                        renderMathInElement(contentDiv, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false},
                                {left: '\\\\(', right: '\\\\)', display: false},
                                {left: '\\\\[', right: '\\\\]', display: true}
                            ],
                            throwOnError: false
                        });
                    };
                    
                    document.addEventListener("DOMContentLoaded", function() {
                        window.updateContent(document.getElementById('content').innerText);
                    });
                </script>
            </body>
            </html>
            """
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = webView
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        let isDark = appearance != "light"
        context.coordinator.updateContent(content, isDark: isDark)
    }
}

struct MermaidView: NSViewRepresentable {
    let diagram: String
    let appearance: String
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        return webView
    }
    
    func updateNSView(_ nsView: WKWebView, context: Context) {
        let isDark = appearance != "light"
        let html = generateMermaidHTML(diagram: diagram, isDark: isDark)
        nsView.loadHTMLString(html, baseURL: nil)
    }
    
    private func generateMermaidHTML(diagram: String, isDark: Bool) -> String {
        let escapedDiagram = diagram
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")
            .replacingOccurrences(of: "\n$", with: "", options: .regularExpression)
        
        let textColor = isDark ? "#ffffff" : "#1a1a1a"
        let primaryColor = "#6366f1"
        let secondaryColor = "#8b5cf6"
        let lineColor = isDark ? "#4a4a6a" : "#d1d5db"
        
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { 
                    min-height: 100%; 
                    background: transparent !important;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Rounded', sans-serif;
                    background: transparent;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 120px;
                    padding: 20px;
                    overflow: auto;
                }
                .mermaid {
                    color-scheme: \(isDark ? "dark" : "light");
                }
                #container { text-align: center; width: 100%; }
            </style>
        </head>
        <body>
            <div id="container">
                <pre class="mermaid">
                \(escapedDiagram)
                </pre>
            </div>
            <script>
                (function() {
                    if (typeof mermaid === 'undefined') {
                        window.mermaidReady = false;
                        var checkMermaid = setInterval(function() {
                            if (typeof mermaid !== 'undefined') {
                                clearInterval(checkMermaid);
                                window.mermaidReady = true;
                                initMermaid();
                            }
                        }, 100);
                        setTimeout(function() { clearInterval(checkMermaid); }, 5000);
                    } else {
                        window.mermaidReady = true;
                        initMermaid();
                    }
                })();
                
                function initMermaid() {
                    if (!window.mermaidReady) return;
                    try {
                        mermaid.initialize({
                            startOnLoad: true,
                            theme: '\(isDark ? "dark" : "default")',
                            themeVariables: {
                                primaryColor: '\(primaryColor)',
                                primaryTextColor: '\(textColor)',
                                primaryBorderColor: '\(lineColor)',
                                lineColor: '\(lineColor)',
                                secondaryColor: '\(secondaryColor)',
                                tertiaryColor: '\(isDark ? "#2d2d3d" : "#f5f5f5")'
                            },
                            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                            securityLevel: 'loose'
                        });
                    } catch(e) { console.error('Mermaid init failed:', e); }
                }
            </script>
        </body>
        </html>
        """
    }
}

struct AnimatedMarkdownMessageText: View {
    let content: String
    let appearance: String
    let animate: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visibleLength = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            MarkdownMessageText(content: visibleContent, appearance: appearance)

            if showCaret {
                HStack(spacing: 6) {
                    Capsule()
                        .fill(PanelPalette(appearance: appearance).accent)
                        .frame(width: 4, height: 16)
                    Text("Comet is writing...")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(PanelPalette(appearance: appearance).secondaryText)
                }
            }
        }
        .task(id: content) {
            if animate && !reduceMotion {
                await animateToLatestContent()
            } else {
                visibleLength = content.count
            }
        }
    }

    private var visibleContent: String {
        if !animate || reduceMotion { return content }
        return String(content.prefix(visibleLength))
    }

    private var showCaret: Bool {
        animate && !reduceMotion && visibleLength < content.count
    }

    private func animateToLatestContent() async {
        while visibleLength < content.count {
            visibleLength += 2
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }
}

struct MarkdownMessageText: View {
    let content: String
    let appearance: String

    var body: some View {
        let palette = PanelPalette(appearance: appearance)

        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(parsedBlocks.enumerated()), id: \.offset) { _, block in
                switch block {
                case .markdown(let text):
                    markdownBlock(text, palette: palette)
                case .code(let language, let code):
                    codeBlock(code, language: language, palette: palette)
                }
            }
        }
        .textSelection(.enabled)
    }

    private var parsedBlocks: [RenderedContentBlock] {
        var blocks: [RenderedContentBlock] = []
        let pattern = #"```([A-Za-z0-9_\-#+.]*)\n([\s\S]*?)```"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return [.markdown(content)]
        }

        let nsRange = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, range: nsRange)

        if matches.isEmpty {
            return [.markdown(content)]
        }

        var cursor = content.startIndex

        for match in matches {
            guard let fullRange = Range(match.range(at: 0), in: content) else { continue }

            if cursor < fullRange.lowerBound {
                let markdown = String(content[cursor..<fullRange.lowerBound])
                if !markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    blocks.append(.markdown(markdown))
                }
            }

            let language: String?
            if let languageRange = Range(match.range(at: 1), in: content) {
                let rawLanguage = String(content[languageRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                language = rawLanguage.isEmpty ? nil : rawLanguage
            } else {
                language = nil
            }

            let code = Range(match.range(at: 2), in: content).map { String(content[$0]) } ?? ""
            blocks.append(.code(language: language, code: code))
            cursor = fullRange.upperBound
        }

        if cursor < content.endIndex {
            let markdown = String(content[cursor..<content.endIndex])
            if !markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                blocks.append(.markdown(markdown))
            }
        }

        return blocks.isEmpty ? [.markdown(content)] : blocks
    }

    @ViewBuilder
    private func markdownBlock(_ text: String, palette: PanelPalette) -> some View {
        let markdownReadyText = text.replacingOccurrences(of: "\n", with: "  \n")
        if let rendered = try? AttributedString(
            markdown: markdownReadyText,
            options: AttributedString.MarkdownParsingOptions(
                interpretedSyntax: .inlineOnlyPreservingWhitespace,
                failurePolicy: .returnPartiallyParsedIfPossible
            )
        ) {
            Text(rendered)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundStyle(palette.primaryText)
        } else {
            Text(text)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundStyle(palette.primaryText)
        }
    }

    private func codeBlock(_ code: String, language: String?, palette: PanelPalette) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let language, !language.isEmpty {
                Text(language.uppercased())
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .foregroundStyle(palette.secondaryAccent)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                Text(code.trimmingCharacters(in: .newlines))
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(palette.primaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(12)
        .background(palette.mutedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 0.5)
        )
    }
}

private enum RenderedContentBlock {
    case markdown(String)
    case code(language: String?, code: String)
}
