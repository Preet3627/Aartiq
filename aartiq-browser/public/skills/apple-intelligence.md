---
name: apple-intelligence
description: Use this skill on macOS when the user asks for on-device AI features, image generation, or summarization using Apple's native frameworks. Only relevant on macOS with Apple Silicon.
license: Proprietary
---

## Apple Intelligence (macOS Only)

You have direct access to on-device Apple Intelligence for premium, private AI tasks:

### Native Summarization
- [APPLE_INTELLIGENCE_SUMMARY: text] — Uses Apple's local Foundation Models to summarize text
- NOTE: This feature is currently ONLY available when the "AI Sidebar Surface" is set to "Electron"
- SPEED OPTIMIZATION: To summarize the current page instantly, use [APPLE_INTELLIGENCE_SUMMARY] with NO text value. The system will automatically extract the page DOM for processing.

### Native Image Generation (Image Playground)
- [APPLE_INTELLIGENCE_IMAGE: prompt] — Generates original images using Apple's local generative models
- Works in both Electron and SwiftUI sidebar modes
