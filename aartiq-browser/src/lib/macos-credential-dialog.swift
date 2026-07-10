import Foundation
import AppKit

func argumentValue(_ flag: String) -> String? {
    guard let index = CommandLine.arguments.firstIndex(of: flag),
          index + 1 < CommandLine.arguments.count else {
        return nil
    }
    return CommandLine.arguments[index + 1]
}

func emit(_ payload: [String: Any]) {
    do {
        let data = try JSONSerialization.data(withJSONObject: payload, options: [])
        if let json = String(data: data, encoding: .utf8) {
            print(json)
            fflush(stdout)
        }
    } catch {
        print("{\"action\":\"cancel\",\"error\":\"serialization_failed\"}")
        fflush(stdout)
    }
}

let domain = argumentValue("--domain") ?? ""
let username = argumentValue("--username") ?? ""
let password = argumentValue("--password") ?? ""

guard !domain.isEmpty else {
    emit(["action": "cancel", "error": "Missing required --domain argument"])
    exit(1)
}

let isDarkMode = UserDefaults.standard.string(forKey: "AppleInterfaceStyle") == "Dark"
let icon: NSImage? = {
    if let appIcon = NSApplication.shared.applicationIconImage {
        return appIcon
    }
    return NSImage(systemSymbolName: "key.fill", accessibilityDescription: "Key")
}()

let alert = NSAlert()
alert.messageText = "Save Password in Aartiq Neural Vault?"
alert.informativeText = "Do you want to save this password for \(domain)?\n\nUsername: \(username)\nPassword: \(password)"
alert.icon = icon

let saveButton = alert.addButton(withTitle: "Save Password")
let neverButton = alert.addButton(withTitle: "Never for This Site")
let cancelButton = alert.addButton(withTitle: "Cancel")

saveButton.keyEquivalent = "\r"
cancelButton.keyEquivalent = "\u{1b}"

if isDarkMode {
    for button in alert.buttons {
        let cell = button.cell as? NSButtonCell
        cell?.backgroundColor = NSColor(calibratedWhite: 0.2, alpha: 1.0)
    }
}

NSApp.activate(ignoringOtherApps: true)

let response = alert.runModal()

switch response {
case .alertFirstButtonReturn:
    emit(["action": "save", "domain": domain, "username": username, "password": password])
case .alertSecondButtonReturn:
    emit(["action": "never", "domain": domain])
default:
    emit(["action": "cancel"])
}
