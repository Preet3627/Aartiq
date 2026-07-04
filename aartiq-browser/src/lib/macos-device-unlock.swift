import Foundation
import LocalAuthentication

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
        print("{\"supported\":false,\"approved\":false,\"error\":\"serialization_failed\"}")
        fflush(stdout)
    }
}

let reason = argumentValue("--reason") ?? "Approve this action in Aartiq."
let risk = argumentValue("--risk") ?? "medium"
let appName = argumentValue("--app-name") ?? "Aartiq"

let context = LAContext()
context.localizedCancelTitle = "Deny"
context.localizedFallbackTitle = "Use Mac Password"
// Note: We use deviceOwnerAuthentication to allow fallback to password automatically
let policy = LAPolicy.deviceOwnerAuthentication

var authError: NSError?
guard context.canEvaluatePolicy(policy, error: &authError) else {
    emit([
        "supported": false,
        "approved": false,
        "mode": "macos-device-owner-auth",
        "error": authError?.localizedDescription ?? "Device owner authentication is unavailable on this Mac."
    ])
    exit(0)
}

let semaphore = DispatchSemaphore(value: 0)
var payload: [String: Any] = [
    "supported": true,
    "approved": false,
    "mode": "macos-device-owner-auth",
]

let localizedReason = "\(appName) needs to verify this action. Confirm with Touch ID or your Mac password."
context.evaluatePolicy(policy, localizedReason: localizedReason) { success, error in
    payload["approved"] = success
    payload["risk"] = risk
    if let error = error as NSError? {
        payload["error"] = error.localizedDescription
    }
    semaphore.signal()
}

_ = semaphore.wait(timeout: .now() + .seconds(120))
emit(payload)
exit(0)
