import Foundation
import FoundationModels

@available(macOS 15.0, *)
@main
struct TestTask {
    static func main() async {
        let session = LanguageModelSession()
        do {
            let response = try await session.respond(to: "What is 2+2?")
            let text: String = response.content
            print("Content type is String: \(text)")
        } catch {
            print(error)
        }
    }
}
