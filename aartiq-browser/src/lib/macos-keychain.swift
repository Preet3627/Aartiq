import Foundation
import Security

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
        print("{\"success\":false,\"error\":\"serialization_failed\"}")
        fflush(stdout)
    }
}

let action = argumentValue("--action") ?? ""
let account = argumentValue("--account") ?? "default"
let service = argumentValue("--service") ?? ""
let password = argumentValue("--password") ?? ""
let label = argumentValue("--label") ?? "Aartiq"
let servicePrefix = argumentValue("--service-prefix") ?? ""

guard !service.isEmpty || action == "list" else {
    emit(["success": false, "error": "Missing required --service argument"])
    exit(1)
}

switch action {
case "add":
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecAttrService as String: service,
        kSecAttrLabel as String: label,
        kSecValueData as String: password.data(using: .utf8)!,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
    ]

    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecAttrService as String: service,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let status = SecItemAdd(query as CFDictionary, nil)
    if status == errSecSuccess {
        emit(["success": true])
    } else if let errorMessage = SecCopyErrorMessageString(status, nil) as String? {
        emit(["success": false, "error": errorMessage])
    } else {
        emit(["success": false, "error": "Keychain add failed with status: \(status)"])
    }

case "delete":
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecAttrService as String: service,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
    ]
    let status = SecItemDelete(query as CFDictionary)
    if status == errSecSuccess || status == errSecItemNotFound {
        emit(["success": true])
    } else if let errorMessage = SecCopyErrorMessageString(status, nil) as String? {
        emit(["success": false, "error": errorMessage])
    } else {
        emit(["success": false, "error": "Keychain delete failed with status: \(status)"])
    }

case "get":
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecAttrService as String: service,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        kSecReturnData as String: kCFBooleanTrue as Any,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecSuccess, let data = result as? Data, let password = String(data: data, encoding: .utf8) {
        emit(["success": true, "password": password])
    } else if status == errSecItemNotFound {
        emit(["success": false, "error": "Item not found"])
    } else if let errorMessage = SecCopyErrorMessageString(status, nil) as String? {
        emit(["success": false, "error": errorMessage])
    } else {
        emit(["success": false, "error": "Keychain get failed with status: \(status)"])
    }

case "list":
    var query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
        kSecReturnAttributes as String: kCFBooleanTrue as Any,
        kSecReturnData as String: kCFBooleanTrue as Any,
        kSecMatchLimit as String: kSecMatchLimitAll,
    ]
    if !servicePrefix.isEmpty {
        query[kSecAttrService as String] = servicePrefix
    }

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecSuccess {
        if let items = result as? [[String: Any]] {
            var entries: [[String: Any]] = []
            for item in items {
                var entry: [String: Any] = [:]
                if let accountValue = item[kSecAttrAccount as String] as? String {
                    entry["account"] = accountValue
                }
                if let serviceValue = item[kSecAttrService as String] as? String {
                    entry["service"] = serviceValue
                }
                if let labelValue = item[kSecAttrLabel as String] as? String {
                    entry["label"] = labelValue
                }
                if let passwordData = item[kSecValueData as String] as? Data,
                   let passwordStr = String(data: passwordData, encoding: .utf8) {
                    entry["password"] = passwordStr
                }
                entries.append(entry)
            }
            emit(["success": true, "entries": entries])
        } else {
            emit(["success": true, "entries": []])
        }
    } else if status == errSecItemNotFound {
        emit(["success": true, "entries": []])
    } else if let errorMessage = SecCopyErrorMessageString(status, nil) as String? {
        emit(["success": false, "error": errorMessage])
    } else {
        emit(["success": false, "error": "Keychain list failed with status: \(status)"])
    }

default:
    emit(["success": false, "error": "Unknown action: \(action). Supported: add, delete, get, list"])
    exit(1)
}
