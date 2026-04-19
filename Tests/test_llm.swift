import Foundation
import FoundationModels

@available(macOS 26.0, *)
func testLLM() async {
    let instructions = "You are a helpful assistant."
    let session = LanguageModelSession(instructions: instructions)
    
    do {
        let response = try await session.respond(to: "What is 2+2?")
        print("Response: \(response.content)")
    } catch {
        print("Error: \(error.localizedDescription)")
    }
}

@main
struct TestMain {
    static func main() async {
        if #available(macOS 26.0, *) {
            await testLLM()
        } else {
            print("Foundation Models requires macOS 26.0 or newer")
        }
    }
}
