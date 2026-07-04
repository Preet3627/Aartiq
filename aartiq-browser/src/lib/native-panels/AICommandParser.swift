import Foundation

struct CommandInfo: Identifiable {
    let id: String
    let type: String
    let value: String
    let category: String
    let riskLevel: String
    let reason: String?
    let originalMatch: String
    let index: Int

    init(type: String, value: String, category: String, riskLevel: String, reason: String? = nil, originalMatch: String, index: Int) {
        self.type = type
        self.value = value
        self.category = category
        self.riskLevel = riskLevel
        self.reason = reason
        self.originalMatch = originalMatch
        self.index = index
        self.id = "\(type)-\(index)-\(abs(value.hashValue))"
    }
}

struct CommandParseResult {
    let commands: [CommandInfo]
    let textWithoutCommands: String
    let hasCommands: Bool
}

enum AICommandType: String, CaseIterable {
    case NAVIGATE, SEARCH, WEB_SEARCH, READ_PAGE_CONTENT, LIST_OPEN_TABS
    case CREATE_PDF_JSON, CREATE_FILE_JSON, GENERATE_PDF
    case SHELL_COMMAND, SET_THEME, SET_VOLUME, SET_BRIGHTNESS, OPEN_APP
    case SCREENSHOT_AND_ANALYZE, CLICK_ELEMENT, CLICK_AT, FIND_AND_CLICK, FILL_FORM, SCROLL_TO
    case GENERATE_DIAGRAM, GENERATE_FLOWCHART, GENERATE_CHART, OPEN_VIEW, RELOAD, GO_BACK, GO_FORWARD
    case WAIT, THINK, PLAN, EXPLAIN_CAPABILITIES
    case SHOW_IMAGE, SHOW_VIDEO, OCR_COORDINATES, OCR_SCREEN, EXTRACT_DATA
    case DOM_SEARCH, DOM_READ_FILTERED
    case OPEN_MCP_SETTINGS, OPEN_AUTOMATION_SETTINGS, LIST_AUTOMATIONS, DELETE_AUTOMATION
    case OPEN_SCHEDULING_MODAL, SCHEDULE_TASK, OPEN_PDF, PLUGIN_COMMAND
    case ORGANIZE_TABS, CLOSE_TAB, GENERATE_IMAGE

    var category: String {
        switch self {
        case .NAVIGATE, .SEARCH, .WEB_SEARCH: return "navigation"
        case .READ_PAGE_CONTENT, .LIST_OPEN_TABS, .CLOSE_TAB: return "browser"
        case .CLICK_ELEMENT, .CLICK_AT, .FIND_AND_CLICK, .FILL_FORM, .SCROLL_TO, .ORGANIZE_TABS: return "automation"
        case .SHELL_COMMAND, .OPEN_APP, .SET_VOLUME, .SET_BRIGHTNESS: return "system"
        case .CREATE_PDF_JSON, .CREATE_FILE_JSON, .GENERATE_PDF, .GENERATE_DIAGRAM, .GENERATE_FLOWCHART, .GENERATE_CHART, .OPEN_PDF: return "pdf"
        case .SHOW_IMAGE, .SHOW_VIDEO, .SCREENSHOT_AND_ANALYZE, .OCR_COORDINATES, .OCR_SCREEN, .GENERATE_IMAGE: return "media"
        case .WAIT, .OPEN_VIEW, .OPEN_MCP_SETTINGS, .OPEN_AUTOMATION_SETTINGS, .LIST_AUTOMATIONS, .DELETE_AUTOMATION, .OPEN_SCHEDULING_MODAL, .SCHEDULE_TASK, .PLUGIN_COMMAND: return "utility"
        case .THINK, .PLAN, .EXPLAIN_CAPABILITIES: return "meta"
        case .DOM_SEARCH, .DOM_READ_FILTERED, .EXTRACT_DATA: return "browser"
        case .SET_THEME, .RELOAD, .GO_BACK, .GO_FORWARD: return "utility"
        }
    }

    var defaultRisk: String {
        switch category {
        case "navigation", "browser", "meta": return "low"
        default: return "medium"
        }
    }
}

struct AICommandParser {
    private static let structuredBlockPatterns = [
        #"(?is)<(?:action_chain|actions|tool_calls|command_json|commands)>\s*([\s\S]*?)\s*</(?:action_chain|actions|tool_calls|command_json|commands)>"#,
        #"(?is)```json\s*([\s\S]*?(?:"commands"|"actions"|"action_chain"|"tool_calls")[\s\S]*?)```"#
    ]

    static func parseCommands(from content: String) -> CommandParseResult {
        var commands: [CommandInfo] = []
        var removalRanges: [Range<String.Index>] = []

        extractTagCommands(from: content, into: &commands, removalRanges: &removalRanges)
        extractStructuredCommands(from: content, into: &commands, removalRanges: &removalRanges)

        let cleaned = removeRanges(removalRanges, from: content)

        return CommandParseResult(
            commands: commands.sorted(by: { $0.index < $1.index }),
            textWithoutCommands: cleaned.trimmingCharacters(in: .whitespacesAndNewlines),
            hasCommands: !commands.isEmpty
        )
    }

    static func cleanCustomTags(from text: String) -> String {
        var result = text
        let patterns = [
            #"\[\s*AI REASONING\s*\][\s\S]*?\[\s*/AI REASONING\s*\]"#,
            #"\[\s*OCR_RESULT\s*\][\s\S]*?\[\s*/OCR_RESULT\s*\]"#,
            #"(?is)<(think|thinking|thought)>\s*[\s\S]*?\s*</\1>"#,
            #"(?is)<(?:action_chain|actions|tool_calls|command_json|commands)>\s*[\s\S]*?\s*</(?:action_chain|actions|tool_calls|command_json|commands)>"#,
            #"(?is)```json\s*[\s\S]*?(?:"commands"|"actions"|"action_chain"|"tool_calls")[\s\S]*?```"#
        ]

        for pattern in patterns {
            result = result.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
        }

        return result.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func extractReasoning(from text: String) -> [String] {
        var results: [String] = []
        let patterns = [
            #"(?i)(?s)<(?:think|thinking|thought)>\s*([\s\S]*?)\s*</(?:think|thinking|thought)>"#,
            #"\[\s*AI REASONING\s*\]\s*([\s\S]*?)\s*\[\s*/AI REASONING\s*\]"#,
            #"(?i)```thinking\n*([\s\S]*?)```"#
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let nsRange = NSRange(text.startIndex..., in: text)
                for match in regex.matches(in: text, range: nsRange) {
                    guard let range = Range(match.range(at: 1), in: text) else { continue }
                    let content = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !content.isEmpty && !results.contains(content) {
                        results.append(content)
                    }
                }
            }
        }

        return results
    }

    static func extractOCRText(from message: NativePanelState.Message) -> String? {
        if let ocrText = message.ocrText, !ocrText.isEmpty {
            return ocrText
        }

        let ocrPatterns = [
            #"(?i)\[OCR_RESULT\s*\]([\s\S]*?)\[/OCR_RESULT\]"#,
            #"(?i)<ocr>([\s\S]*?)</ocr>"#
        ]

        for pattern in ocrPatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let nsRange = NSRange(message.content.startIndex..., in: message.content)
                if let match = regex.firstMatch(in: message.content, range: nsRange),
                   let range = Range(match.range(at: 1), in: message.content) {
                    let extracted = String(message.content[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !extracted.isEmpty {
                        return extracted
                    }
                }
            }
        }

        return nil
    }

    static func extractActionLogs(from message: NativePanelState.Message) -> [NativePanelState.ActionLog] {
        message.actionLogs ?? []
    }

    static func extractMediaItems(from message: NativePanelState.Message) -> [NativePanelState.MediaItem] {
        message.mediaItems ?? []
    }

    private static func extractTagCommands(from content: String, into commands: inout [CommandInfo], removalRanges: inout [Range<String.Index>]) {
        let tagPattern = #"\[\s*([A-Z_]+)\s*(?::\s*([^\]]+?))?\s*\]"#
        guard let regex = try? NSRegularExpression(pattern: tagPattern, options: []) else { return }

        let nsRange = NSRange(content.startIndex..., in: content)
        for match in regex.matches(in: content, range: nsRange) {
            guard let typeRange = Range(match.range(at: 1), in: content) else { continue }
            let type = String(content[typeRange]).uppercased()

            var value = ""
            if match.range(at: 2).location != NSNotFound, let valueRange = Range(match.range(at: 2), in: content) {
                value = String(content[valueRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            }

            guard let command = makeCommand(type: type, value: value, originalMatchRange: match.range, in: content) else {
                continue
            }

            commands.append(command)
            if let range = Range(match.range, in: content) {
                removalRanges.append(range)
            }
        }
    }

    private static func extractStructuredCommands(from content: String, into commands: inout [CommandInfo], removalRanges: inout [Range<String.Index>]) {
        for pattern in structuredBlockPatterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            let nsRange = NSRange(content.startIndex..., in: content)

            for match in regex.matches(in: content, range: nsRange) {
                guard
                    let payloadRange = Range(match.range(at: 1), in: content),
                    let fullRange = Range(match.range(at: 0), in: content)
                else {
                    continue
                }

                let payload = String(content[payloadRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                let parsed = parseStructuredPayload(payload, sourceIndex: match.range.location)
                if !parsed.isEmpty {
                    commands.append(contentsOf: parsed)
                    removalRanges.append(fullRange)
                }
            }
        }
    }

    private static func parseStructuredPayload(_ payload: String, sourceIndex: Int) -> [CommandInfo] {
        guard let data = payload.data(using: .utf8) else { return [] }

        if let object = try? JSONSerialization.jsonObject(with: data) {
            return commands(from: object, sourceIndex: sourceIndex, originalMatch: payload)
        }

        return parseCommandObjectsByRegex(payload, sourceIndex: sourceIndex)
    }

    private static func commands(from object: Any, sourceIndex: Int, originalMatch: String) -> [CommandInfo] {
        if let dictionary = object as? [String: Any] {
            for key in ["commands", "actions", "action_chain", "tool_calls"] {
                if let value = dictionary[key] {
                    return commands(from: value, sourceIndex: sourceIndex, originalMatch: originalMatch)
                }
            }

            if let type = normalizedCommandType(from: dictionary) {
                return [makeCommand(from: dictionary, type: type, sourceIndex: sourceIndex, originalMatch: originalMatch)].compactMap { $0 }
            }
        }

        if let array = object as? [[String: Any]] {
            return array.enumerated().compactMap { index, item in
                guard let type = normalizedCommandType(from: item) else { return nil }
                return makeCommand(from: item, type: type, sourceIndex: sourceIndex + index, originalMatch: originalMatch)
            }
        }

        return []
    }

    private static func parseCommandObjectsByRegex(_ payload: String, sourceIndex: Int) -> [CommandInfo] {
        let objectPattern = #"\{[\s\S]*?"type"\s*:\s*"([^"]+)"[\s\S]*?\}"#
        guard let regex = try? NSRegularExpression(pattern: objectPattern, options: []) else { return [] }

        let nsRange = NSRange(payload.startIndex..., in: payload)
        return regex.matches(in: payload, range: nsRange).enumerated().compactMap { index, match in
            guard
                let typeRange = Range(match.range(at: 1), in: payload),
                let fullRange = Range(match.range(at: 0), in: payload)
            else {
                return nil
            }

            let type = String(payload[typeRange]).uppercased()
            let original = String(payload[fullRange])
            return makeCommand(type: type, value: extractCommandValue(fromFallbackJSON: original), originalMatch: original, index: sourceIndex + index)
        }
    }

    private static func normalizedCommandType(from dictionary: [String: Any]) -> String? {
        let candidates = ["type", "name", "tool", "command"]
        for key in candidates {
            if let raw = dictionary[key] as? String {
                let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
                if !normalized.isEmpty {
                    return normalized
                }
            }
        }
        return nil
    }

    private static func makeCommand(from dictionary: [String: Any], type: String, sourceIndex: Int, originalMatch: String) -> CommandInfo? {
        let valueKeys = ["value", "url", "path", "text", "prompt", "command", "input"]
        let value = valueKeys.compactMap { key -> String? in
            if let stringValue = dictionary[key] as? String, !stringValue.isEmpty {
                return stringValue
            }
            return nil
        }.first ?? ""

        return makeCommand(type: type, value: value, originalMatch: originalMatch, index: sourceIndex)
    }

    private static func makeCommand(type: String, value: String, originalMatchRange: NSRange, in content: String) -> CommandInfo? {
        guard let range = Range(originalMatchRange, in: content) else { return nil }
        return makeCommand(type: type, value: value, originalMatch: String(content[range]), index: originalMatchRange.location)
    }

    private static func makeCommand(type: String, value: String, originalMatch: String, index: Int) -> CommandInfo? {
        let normalizedType = type.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard !normalizedType.isEmpty else { return nil }

        if let commandType = AICommandType(rawValue: normalizedType) {
            return CommandInfo(
                type: commandType.rawValue,
                value: value,
                category: commandType.category,
                riskLevel: commandType.defaultRisk,
                originalMatch: originalMatch,
                index: index
            )
        }

        return CommandInfo(
            type: normalizedType,
            value: value,
            category: "unknown",
            riskLevel: "unknown",
            originalMatch: originalMatch,
            index: index
        )
    }

    private static func extractCommandValue(fromFallbackJSON payload: String) -> String {
        let patterns = [
            #""value"\s*:\s*"([^"]+)""#,
            #""url"\s*:\s*"([^"]+)""#,
            #""path"\s*:\s*"([^"]+)""#,
            #""text"\s*:\s*"([^"]+)""#,
            #""prompt"\s*:\s*"([^"]+)""#
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            let nsRange = NSRange(payload.startIndex..., in: payload)
            if let match = regex.firstMatch(in: payload, range: nsRange),
               let range = Range(match.range(at: 1), in: payload) {
                return String(payload[range])
            }
        }

        return ""
    }

    private static func removeRanges(_ ranges: [Range<String.Index>], from content: String) -> String {
        guard !ranges.isEmpty else { return content }

        var cleaned = content
        for range in ranges.sorted(by: { $0.lowerBound > $1.lowerBound }) {
            cleaned.removeSubrange(range)
        }
        return cleaned
    }
}
