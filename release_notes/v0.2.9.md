# Release Notes - Comet-AI v0.2.9

## ☀️ The "Efficiency & Alignment" Update

Version 0.2.9 focuses on refining the core browser performance and standardizing the professional aesthetic of the workspace.

### 🧠 Intelligent View Virtualization
We've implemented **Context-Aware View Virtualization**. Comet now detects when you are using internal tools, settings, or the landing page and automatically detaches the BrowserView engine. This results in significant CPU and battery life improvements, especially during long background sessions.

### 📄 Professional PDF Orchestration
Document generation has been elevated to publishing standards. 
- **Auto-TOC**: All PDFs now analyze your document structure and synthesize a clickable Table of Contents.
- **Native Templates**: We now leverage Electron's native header and footer templates for page numbering and ecosystem branding, ensuring numbers are never cropped or misaligned.

### 📐 Standardized Desktop HIG
We have standardized our vertical rhythm across the entire app. 
- The AI Sidebar and URL Bar now share a unified **56px header height**.
- This change provides more vertical space for content while ensuring that icons and text align perfectly with the native macOS traffic lights and window controls.

### 🚀 Streamlined Onboarding
The entry flow has been polished for clarity. The "Get Started" path now guides you through the `StartupSetupUI` with intelligent transitions. If your AI provider (Ollama/OpenAI) verifies successfully, the setup guide now automatically advances you to the next phase.

---
**Build Highlights:**
- **Stability**: Fixed React lifecycle errors in the sidebar.
- **Visuals**: Corrected icon transparency in packaged production builds.
- **Performance**: Event-gating for window resize listeners.
