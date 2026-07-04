import sys

path = "/Users/sandipkumarpatel/Developer/Projects/Aartiq/aartiq-browser/src/lib/native-panels/AppleIntelligencePanelView.swift"
with open(path, "r") as f:
    content = f.read()

# Remove let text = inputText warning
bad_var = "let text = inputText\n            switch extractionType {"
good_var = "let text = inputText\n            _ = text\n            switch extractionType {"
content = content.replace(bad_var, good_var)

bad_check = """
                    if #available(macOS 15.0, *) {
                        Text("15+")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(palette.accent)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
"""

good_check = """
                        Text("15+")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(palette.accent)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
"""

content = content.replace(bad_check, good_check)

with open(path, "w") as f:
    f.write(content)
print("Replaced.")
