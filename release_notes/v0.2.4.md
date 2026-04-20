# Comet AI Browser - Release Notes v0.2.4-stable

**Release Date:** March 26, 2026

---

## 🎯 What's New

### Enhanced PDF Generation
- **JSON-based PDF generation** - AI can now generate structured multi-page PDFs using JSON format
- **Page detail levels** - Control content density per page (brief/standard/detailed)
- **Icon library** - 70+ emoji icons available for PDF sections
- **Auto Table of Contents** - Generated for multi-page PDFs
- **Smart fallback** - Automatically falls back to markdown if JSON parsing fails

### Screenshot & OCR Improvements
- Fixed screenshot capture for browser content
- Added Tesseract.js OCR with image preprocessing (sharp)
- Vision AI with Claude-to-Gemini fallback
- Better error handling for capture failures

### Error-Proof Browser
- Handles page load failures gracefully
- Navigation retry logic (2 attempts)
- SSL certificate handling
- Non-critical error filtering
- Global exception handlers

### Bug Fixes
- **No more duplicate commands** - Fixed root cause of duplicate PDF generation
- **No more duplicate downloads** - Fixed downloads showing twice
- **PDF CSS fixes** - Removed rounded corners, fixed text hiding

---

## 🚀 Quick Demo

Try these commands:

```
Search latest AI news, open first result, scroll, take screenshot, generate PDF with logo and summary
```

```
[EXPLAIN_CAPABILITIES]
```

---

## 📋 Command Format

### PDF Generation (New JSON Format)
```json
{
  "title": "Report Title",
  "subtitle": "Optional subtitle",
  "pages": [
    {
      "title": "Executive Summary",
      "icon": "star",
      "detailLevel": "brief",
      "content": "..."
    },
    {
      "title": "Detailed Analysis",
      "icon": "chart",
      "detailLevel": "detailed",
      "sections": [
        {
          "title": "Section 1",
          "icon": "document",
          "content": "..."
        }
      ]
    }
  ]
}
```

### Available Icons
document, summary, analysis, data, chart, image, link, warning, success, error, info, star, fire, rocket, brain, eye, search, gear, lightbulb, target, trophy, medal, shield, lock, key, phone, laptop, cloud, database, server, user, users, calendar, clock, mail, flag, pin, bookmark, heart, thumbsUp, check, arrowRight, download, folder, video, audio, code, bug, test, robot, crown, gem, sun, moon, and more...

---

## 🔧 Technical Changes

### New Types Added
- `PDFDetailLevel` - 'brief' | 'standard' | 'detailed'
- `PDFPage` - Page with title, content, icon, detailLevel, sections
- `PDFSection` - Section with title, content, icon, detailLevel
- `EnhancedPDFData` - Full PDF structure with pages array

### New Functions
- `buildEnhancedPDFFromJSON()` - Multi-page PDF builder
- `generateSmartPDF()` - Auto-detects JSON vs markdown
- `getIcon()` - Resolves icon names to emojis
- `openFile()` - Opens downloaded files

### Download Panel
- Shows download progress
- Click completed downloads to open
- Stores full file path

---

## 🐛 Bug Fixes Summary

| Issue | Fix |
|-------|-----|
| PDF generating twice | Deduplicated commands in parser |
| Downloads showing twice | Added deduplication + useEffect cleanup |
| Screenshot not working | Fixed to use captureBrowserViewScreenshot |
| Commands executing twice | Single parser with Set-based deduplication |
| Text hidden in PDF | Changed overflow: hidden → visible |
| Rounded corners in PDF | Removed border-radius from tables/code/images |

---

## 📦 Installation

```bash
cd comet-browser
npm install
npm run dev
```

For production build:
```bash
npm run build-electron
```

---

## 🙏 Thanks

Thanks to all testers and contributors!

---

**Full Changelog:** [CHANGELOG.md](./CHANGELOG.md)
