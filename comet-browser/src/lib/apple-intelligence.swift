import Foundation
#if canImport(AppKit)
import AppKit
#endif
#if canImport(FoundationModels)
import FoundationModels
#endif
#if canImport(ImagePlayground)
import ImagePlayground
#endif

struct RequestPayload: Codable {
    let command: String
    let text: String?
    let prompt: String?
    let outputPath: String?
    let style: String?
}

struct ResponsePayload: Codable {
    var success: Bool
    var available: Bool?
    var supportsSummaries: Bool?
    var supportsImageGeneration: Bool?
    var supportsGenmoji: Bool?
    var summaryAvailable: Bool?
    var imageAvailable: Bool?
    var genmojiAvailable: Bool?
    var summaryReason: String?
    var imageReason: String?
    var genmojiReason: String?
    var osVersion: String?
    var summary: String?
    var imagePath: String?
    var genmojiPath: String?
    var error: String?
    var availableStyles: [String]?
}

enum HelperError: Error, LocalizedError {
    case invalidRequest(String)
    case notSupported(String)
    case creationFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidRequest(let msg), .notSupported(let msg), .creationFailed(let msg):
            return msg
        }
    }
}

func readPayload() throws -> RequestPayload {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard !data.isEmpty else {
        throw HelperError.invalidRequest("No request payload received.")
    }
    return try JSONDecoder().decode(RequestPayload.self, from: data)
}

func writeResponse(_ payload: ResponsePayload) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    guard let data = try? encoder.encode(payload) else {
        fputs("{\"success\":false,\"error\":\"Failed to encode response.\"}\n", stderr)
        return
    }
    FileHandle.standardOutput.write(data)
}

#if canImport(FoundationModels)
@available(macOS 26.0, *)
func checkFoundationModelsAvailability() -> (available: Bool, reason: String?) {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
        return (true, nil)
    case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible:
            return (false, "Apple Intelligence requires an Apple Silicon Mac with 16GB+ memory.")
        case .appleIntelligenceNotEnabled:
            return (false, "Apple Intelligence is not enabled. Please enable it in System Settings > Apple Intelligence.")
        case .modelNotReady:
            return (false, "Apple Intelligence is still downloading. Please wait and try again.")
        @unknown default:
            return (false, "Apple Intelligence is unavailable on this Mac.")
        }
    @unknown default:
        return (false, "Apple Intelligence is unavailable on this Mac.")
    }
}

@available(macOS 26.0, *)
func summarizeWithFoundationModels(_ text: String) async throws -> String {
    let instructions = """
    You are a helpful assistant that summarizes content concisely.
    Return a brief summary in markdown format with:
    - A one-line overview
    - 3-5 key bullet points
    - A short next-step suggestion only when helpful
    
    Keep summaries under 200 words.
    """
    
    let session = LanguageModelSession(instructions: instructions)
    let prompt = "Summarize the following content:\n\n\(text)"
    let response = try await session.respond(to: prompt)
    return response.content
}
#endif

#if canImport(ImagePlayground)
@available(macOS 15.1, *)
func getAvailableImageStyles() async -> [String] {
    if #available(macOS 15.4, *) {
        do {
            let creator = try await ImageCreator()
            return creator.availableStyles.map { style in
                switch style {
                case .animation: return "animation"
                case .illustration: return "illustration"
                case .sketch: return "sketch"
                default: return "illustration"
                }
            }
        } catch {
            return ["illustration"]
        }
    }
    return ["illustration"]
}

@available(macOS 15.4, *)
func checkImagePlaygroundAvailability() async -> (available: Bool, reason: String?) {
    let isAvailable = await MainActor.run {
        ImagePlaygroundViewController.isAvailable
    }
    
    if isAvailable {
        return (true, nil)
    }
    
    let osVersion = ProcessInfo.processInfo.operatingSystemVersion
    if osVersion.majorVersion < 15 {
        return (false, "Image Playground requires macOS 15.1 or newer.")
    }
    return (false, "Apple image generation is not available. Please ensure Image Playground models are downloaded in System Settings.")
}

@available(macOS 15.4, *)
func generateAppleImage(prompt: String, outputPath: String?, styleName: String) async throws -> String {
    let creator = try await ImageCreator()
    
    let style: ImagePlaygroundStyle
    switch styleName.lowercased() {
    case "animation":
        style = .animation
    case "sketch":
        style = .sketch
    default:
        style = .illustration
    }
    
    let concepts: [ImagePlaygroundConcept] = [.text(prompt)]
    
    var createdImage: ImageCreator.CreatedImage?
    
    for try await image in creator.images(for: concepts, style: style, limit: 1) {
        createdImage = image
        break
    }
    
    guard let finalImage = createdImage else {
        throw HelperError.creationFailed("Image generation did not return an image.")
    }
    
    let destinationURL: URL
    if let outputPath, !outputPath.isEmpty {
        destinationURL = URL(fileURLWithPath: outputPath)
    } else {
        let picturesDirectory = FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let timestamp = formatter.string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let styleSuffix = styleName.isEmpty || styleName == "illustration" ? "" : "-\(styleName)"
        let filename = "comet-ai\(styleSuffix)-\(timestamp).png"
        destinationURL = picturesDirectory.appendingPathComponent(filename)
    }
    
    try? FileManager.default.removeItem(at: destinationURL)
    try FileManager.default.createDirectory(at: destinationURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    
    #if canImport(AppKit)
    let bitmap = NSBitmapImageRep(cgImage: finalImage.cgImage)
    guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
        throw HelperError.creationFailed("Failed to encode image as PNG.")
    }
    try pngData.write(to: destinationURL)
    #else
    throw HelperError.creationFailed("PNG encoding is unavailable on this runtime.")
    #endif
    
    return destinationURL.path
}

@available(macOS 15.4, *)
func generateGenmoji(_ prompt: String) async throws -> String {
    let creator = try await ImageCreator()
    let genmojiPrompt = "emoji: \(prompt)"
    
    var createdImage: ImageCreator.CreatedImage?
    
    for try await image in creator.images(for: [.text(genmojiPrompt)], style: .illustration, limit: 1) {
        createdImage = image
        break
    }
    
    guard let finalImage = createdImage else {
        throw HelperError.creationFailed("Genmoji generation did not return an image.")
    }
    
    let genmojiDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
        .appendingPathComponent("Comet-AI/Genmoji", isDirectory: true)
        ?? URL(fileURLWithPath: NSTemporaryDirectory())
    
    try FileManager.default.createDirectory(at: genmojiDirectory, withIntermediateDirectories: true)
    
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
    let timestamp = formatter.string(from: Date())
    let sanitizedPrompt = prompt.prefix(20).replacingOccurrences(of: "[^a-zA-Z0-9]", with: "_", options: .regularExpression)
    let filename = "genmoji_\(sanitizedPrompt)_\(timestamp).png"
    let destinationURL = genmojiDirectory.appendingPathComponent(filename)
    
    try? FileManager.default.removeItem(at: destinationURL)
    
    #if canImport(AppKit)
    let bitmap = NSBitmapImageRep(cgImage: finalImage.cgImage)
    guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
        throw HelperError.creationFailed("Failed to encode Genmoji as PNG.")
    }
    try pngData.write(to: destinationURL)
    #else
    throw HelperError.creationFailed("PNG encoding is unavailable on this runtime.")
    #endif
    
    return destinationURL.path
}
#endif

@main
struct AppleIntelligenceHelper {
    static func main() async {
        do {
            let request = try readPayload()
            let osVersion = ProcessInfo.processInfo.operatingSystemVersionString

            switch request.command {
            case "status":
                var response = ResponsePayload(success: true, osVersion: osVersion)
                
                #if canImport(FoundationModels)
                if #available(macOS 26.0, *) {
                    let (summaryAvailable, summaryReason) = checkFoundationModelsAvailability()
                    response.available = summaryAvailable
                    response.supportsSummaries = true
                    response.summaryAvailable = summaryAvailable
                    response.summaryReason = summaryReason
                } else {
                    response.available = false
                    response.supportsSummaries = false
                    response.summaryAvailable = false
                    response.summaryReason = "Summaries require macOS 26 with Foundation Models."
                }
                #else
                response.available = false
                response.supportsSummaries = false
                response.summaryAvailable = false
                response.summaryReason = "Foundation Models is not available in this build."
                #endif

                #if canImport(ImagePlayground)
                if #available(macOS 15.4, *) {
                    response.supportsGenmoji = true
                    response.genmojiAvailable = true
                    response.genmojiReason = nil
                    
                    let (imageAvailable, imageReason) = await checkImagePlaygroundAvailability()
                    response.supportsImageGeneration = true
                    response.imageAvailable = imageAvailable
                    response.imageReason = imageReason
                    response.availableStyles = await getAvailableImageStyles()
                } else if #available(macOS 15.1, *) {
                    response.supportsImageGeneration = true
                    response.imageAvailable = true
                    response.imageReason = "Image Playground is available via interactive sheet."
                    response.supportsGenmoji = false
                    response.genmojiAvailable = false
                    response.genmojiReason = "Genmoji requires macOS 15.4 or newer."
                } else {
                    response.supportsImageGeneration = false
                    response.imageAvailable = false
                    response.imageReason = "Image Playground requires macOS 15.1 or newer."
                }
                #else
                response.supportsImageGeneration = false
                response.imageAvailable = false
                response.imageReason = "Image Playground is not available in this build."
                #endif

                writeResponse(response)

            case "summary":
                guard let text = request.text?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
                    writeResponse(ResponsePayload(
                        success: false,
                        available: false,
                        error: "No text provided for summary."
                    ))
                    return
                }
                
                #if canImport(FoundationModels)
                if #available(macOS 26.0, *) {
                    let (available, reason) = checkFoundationModelsAvailability()
                    guard available else {
                        writeResponse(ResponsePayload(
                            success: false,
                            available: false,
                            supportsSummaries: true,
                            summaryAvailable: false,
                            summaryReason: reason,
                            error: reason ?? "Apple Intelligence is unavailable."
                        ))
                        return
                    }
                    
                    do {
                        let summary = try await summarizeWithFoundationModels(text)
                        writeResponse(ResponsePayload(
                            success: true,
                            available: true,
                            supportsSummaries: true,
                            summaryAvailable: true,
                            osVersion: osVersion,
                            summary: summary
                        ))
                        return
                    } catch {
                        writeResponse(ResponsePayload(
                            success: false,
                            available: false,
                            supportsSummaries: true,
                            summaryAvailable: false,
                            summaryReason: error.localizedDescription,
                            error: "Summary generation failed: \(error.localizedDescription)"
                        ))
                        return
                    }
                }
                #endif
                
                writeResponse(ResponsePayload(
                    success: false,
                    available: false,
                    supportsSummaries: false,
                    summaryAvailable: false,
                    summaryReason: "Summaries require macOS 26 with Foundation Models.",
                    error: "Foundation Models requires macOS 26. Current: \(osVersion)"
                ))

            case "image":
                guard let prompt = request.prompt?.trimmingCharacters(in: .whitespacesAndNewlines), !prompt.isEmpty else {
                    writeResponse(ResponsePayload(
                        success: false,
                        available: false,
                        error: "No prompt provided for image generation."
                    ))
                    return
                }
                
                let style = request.style ?? "illustration"
                
                #if canImport(ImagePlayground)
                if #available(macOS 15.4, *) {
                    let (available, reason) = await checkImagePlaygroundAvailability()
                    guard available else {
                        writeResponse(ResponsePayload(
                            success: false,
                            available: false,
                            supportsImageGeneration: true,
                            imageAvailable: false,
                            imageReason: reason,
                            error: reason ?? "Image generation is unavailable."
                        ))
                        return
                    }
                    
                    do {
                        let path = try await generateAppleImage(prompt: prompt, outputPath: request.outputPath, styleName: style)
                        writeResponse(ResponsePayload(
                            success: true,
                            available: true,
                            supportsImageGeneration: true,
                            imageAvailable: true,
                            osVersion: osVersion,
                            imagePath: path
                        ))
                        return
                    } catch {
                        writeResponse(ResponsePayload(
                            success: false,
                            available: false,
                            supportsImageGeneration: true,
                            imageAvailable: false,
                            imageReason: error.localizedDescription,
                            error: "Image generation failed: \(error.localizedDescription)"
                        ))
                        return
                    }
                }
                #endif
                
                writeResponse(ResponsePayload(
                    success: false,
                    available: false,
                    supportsImageGeneration: false,
                    imageAvailable: false,
                    imageReason: "Image Playground requires macOS 15.4 or newer.",
                    error: "Image Playground is not available. Current: \(osVersion)"
                ))
                
            case "genmoji":
                guard let prompt = request.prompt?.trimmingCharacters(in: .whitespacesAndNewlines), !prompt.isEmpty else {
                    writeResponse(ResponsePayload(
                        success: false,
                        available: false,
                        error: "No prompt provided for Genmoji."
                    ))
                    return
                }
                
                #if canImport(ImagePlayground)
                if #available(macOS 15.4, *) {
                    do {
                        let path = try await generateGenmoji(prompt)
                        writeResponse(ResponsePayload(
                            success: true,
                            available: true,
                            supportsGenmoji: true,
                            genmojiAvailable: true,
                            osVersion: osVersion,
                            genmojiPath: path
                        ))
                        return
                    } catch {
                        writeResponse(ResponsePayload(
                            success: false,
                            available: false,
                            supportsGenmoji: true,
                            genmojiAvailable: false,
                            genmojiReason: error.localizedDescription,
                            error: "Genmoji generation failed: \(error.localizedDescription)"
                        ))
                        return
                    }
                }
                #endif
                
                writeResponse(ResponsePayload(
                    success: false,
                    available: false,
                    supportsGenmoji: false,
                    genmojiAvailable: false,
                    genmojiReason: "Genmoji requires macOS 15.4 or newer.",
                    error: "Genmoji requires macOS 15.4. Current: \(osVersion)"
                ))

            default:
                writeResponse(ResponsePayload(
                    success: false,
                    available: false,
                    error: "Unknown command: \(request.command)"
                ))
            }
        } catch {
            writeResponse(ResponsePayload(
                success: false,
                available: false,
                error: error.localizedDescription
            ))
        }
    }
}
