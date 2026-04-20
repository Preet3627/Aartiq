# Comet AI Release Notes

Release notes for all Comet AI Browser versions.

---

## 📋 Version History

| Version | Date | Channel | Highlights |
|---------|------|---------|------------|
| [v0.2.9.3](./v0.2.9.3.md) | 2026-04-20 | Stable | Siri/Shortcuts, Windows/Linux Integration, Native alternatives |
| [v0.2.9.1](./v0.2.9.1.md) | 2026-04-17 | Stable | Native AI Sidebar V2, Thuki-inspired |
| [v0.2.9](./v0.2.9.md) | 2026-04-13 | Stable | PDF orchestration, virtualized BrowserView |
| [v0.2.8](./v0.2.8.md) | 2026-04-09 | Stable | Release workflow optimization |

---

## 🚀 Latest Release: v0.2.9.3

### Highlights

This release introduces **comprehensive platform ecosystem integration** including Siri/Shortcuts on macOS, Windows Shortcuts/Voice/Copilot, Linux desktop integration, and native alternatives for clicking/OCR.

### New Features

#### 🍎 Apple Integration (macOS)
- **Siri Shortcuts** - 12 pre-configured shortcuts via App Intents
- **URL Scheme** - `comet-ai://` protocol
- **Voice Control** - Dictation + Text-to-Speech
- **Raycast Integration** - Extension support
- **Apple Intelligence** - On-device AI

#### 🪟 Windows Integration
- **Windows Shortcuts** - Create shortcuts for Comet actions
- **Voice Control** - PowerShell TTS/STT
- **Microsoft Copilot** - `com.microsoft.copilot:` protocol

#### 🐧 Linux Integration
- **GNOME/KDE/XFCE/MATE** - Desktop detection
- **espeak** - 80+ voices for TTS
- **notify-send** - Desktop notifications
- **.desktop files** - Desktop shortcut generation

#### 🔄 Native Click Alternatives
- **macOS**: steve CLI → AppleScript → robotjs
- **Windows**: nut.js → xa11y → robotjs  
- **Linux**: xdotool → xte/xinput → robotjs

#### 📷 Native OCR Alternatives
- **macOS**: uniOCR (Vision) → RustO! → Native Vision → Tesseract
- **Windows**: uniOCR → RustO! → Windows OCR → Tesseract
- **Linux**: uniOCR → RustO! → AT-SPI2 → Tesseract

### Bug Fixes

1. **PDF Generation** - Removed "Protected Ecosystem" watermark
2. **macOS Build** - Fixed with ad-hoc signing
3. **GitHub Actions** - Fixed code signing error

---

## 📂 Release File Structure

```
.github/releases/
├── README.md              # This file
├── v0.2.9.3.md           # Latest stable
├── v0.2.9.1.md           # Previous stable
├── v0.2.9.md             # Older stable
└── v0.2.8.md             # Older stable
```

---

## 📥 Download

**Latest:** [v0.2.9.3](https://github.com/Preet3627/Comet-AI/releases/latest)

| Platform | Download |
|----------|----------|
| macOS (Intel) | [Comet-AI-0.2.9.3.dmg](https://github.com/Preet3627/Comet-AI/releases/latest/download/Comet-AI-0.2.9.3.dmg) |
| macOS (Apple Silicon) | [Comet-AI-0.2.9.3-arm64.dmg](https://github.com/Preet3627/Comet-AI/releases/latest/download/Comet-AI-0.2.9.3-arm64.dmg) |
| Windows | [Comet-AI-0.2.9.3.exe](https://github.com/Preet3627/Comet-AI/releases/latest/download/Comet-AI-0.2.9.3.exe) |
| Linux | [Comet-AI-0.2.9.3.AppImage](https://github.com/Preet3627/Comet-AI/releases/latest/download/Comet-AI-0.2.9.3.AppImage) |

---

## 📖 Documentation

| Page | URL |
|------|-----|
| Main Docs | [browser.ponsrischool.in/docs](https://browser.ponsrischool.in/docs) |
| Apple Integration | [browser.ponsrischool.in/docs/apple-integration](https://browser.ponsrischool.in/docs/apple-integration) |
| Windows Integration | [browser.ponsrischool.in/docs/windows-integration](https://browser.ponsrischool.in/docs/windows-integration) |
| Linux Integration | [browser.ponsrischool.in/docs/linux-integration](https://browser.ponsrischool.in/docs/linux-integration) |

---

## 🔧 Build from Source

```bash
# Clone
git clone https://github.com/Preet3627/Comet-AI.git
cd Comet-AI

# Install dependencies
cd comet-browser && npm install

# Run in development
npm run dev

# Build for production
npm run build
```

---

*Built by a 16-year-old developer*
*Comet AI - An open-source AI-native browser*