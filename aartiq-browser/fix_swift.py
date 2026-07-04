import sys

path = "/Users/sandipkumarpatel/Developer/Projects/Aartiq/aartiq-browser/src/lib/native-panels/AppleIntelligencePanelView.swift"
with open(path, "r") as f:
    content = f.read()

# Replace palette issues
content = content.replace("palette.background", "palette.mutedSurface")
content = content.replace("palette.border", "palette.stroke")

# Fix regex issue
bad_regex = """summaryResult = text.replacingOccurrences(of: "\\\\b(gonna|won't|can't)\\\\b", with: { $0 == "gonna" ? "going to" : ($0 == "won't" ? "will not" : "cannot") }, options: .regularExpression)"""
good_regex = """summaryResult = text
                    .replacingOccurrences(of: "\\\\bgonna\\\\b", with: "going to", options: .regularExpression)
                    .replacingOccurrences(of: "\\\\bwon't\\\\b", with: "will not", options: .regularExpression)
                    .replacingOccurrences(of: "\\\\bcan't\\\\b", with: "cannot", options: .regularExpression)"""
content = content.replace(bad_regex, good_regex)

# Fix type-check expression issue
bad_type = """        let important = sentences.enumerated()
            .map { (index: $0.offset, sentence: $0.element, score: 1.0 / Double(index + 1) + Double($0.element.count) / 1000.0) }
            .sorted { $0.score > $1.score }"""
good_type = """        let important = sentences.enumerated().map { item -> (index: Int, sentence: String, score: Double) in
            let score = 1.0 / Double(item.offset + 1) + Double(item.element.count) / 1000.0
            return (index: item.offset, sentence: item.element, score: score)
        }.sorted { $0.score > $1.score }"""
content = content.replace(bad_type, good_type)

with open(path, "w") as f:
    f.write(content)
print("Replaced.")
