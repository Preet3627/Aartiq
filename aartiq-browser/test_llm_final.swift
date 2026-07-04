import Foundation
import FoundationModels

@available(macOS 15.0, *)
@main
struct TestTask {
    static func main() async {
        let session = LanguageModelSession()
        do {
            let response = try await session.respond(to: "What is 2+2?")
            print(Mirror(reflecting: response).children.map { "\($0.label ?? ""): \($0.value)" })
        } catch {
            print(error)
        }
    }
}
