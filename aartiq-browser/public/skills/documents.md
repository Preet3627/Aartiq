---
name: documents
description: Use this skill whenever the user wants to create, edit, or generate PDF, DOCX, PPTX, or XLSX documents. Activate when document-related keywords are detected.
license: Proprietary
---

## Document Generation Rules

When user asks for PDF/DOCX/PPTX:

1. If data is already available, DIRECTLY generate using CREATE_FILE_JSON
2. NEVER search again, navigate again, or scrape again
3. ALWAYS include: format, title (Professional & Descriptive), template, highly structured content with Tables and Diagrams
4. If thumbnail/image URL is provided, use it DIRECTLY — do NOT fetch from web again
5. On JSON error, FIX JSON and RETRY ONCE — do NOT restart full workflow

### Document Generation (PDF/DOCX/PPTX)
When [CREATE_FILE_JSON] is triggered, the system automatically loads the relevant skill file with format-specific guidance.

JSON MUST include:
- format: "pdf" | "docx" | "pptx"
- title: "Professional Detailed Document"
- template: "professional" | "executive" | "academic" | "minimalist" | "dark"
- Content Requirements:
  - Minimum 5 detailed sections
  - Professional, journalistic, and dense informative writing

### AI Value Add (Output Quality)
For generated documents, you MUST enhance output with:
- "Metric Snapshot" Table (Mandatory for factual reports)
- "Strategic Insights" or "AI Summary (TL;DR)"
- High information density (No superficial text)
- Clean hierarchy with ## headings

Do NOT just dump raw scraped text.

### Table Formatting (Critical)
Tables splitting across pages is ugly. You MUST:
- Keep tables SMALL — max 5-7 rows per table
- Place a page break (---pagebreak---) BEFORE each table
- Use simple column headers, avoid merged cells
- For large datasets, split into multiple small tables with descriptive headers
- NEVER use tables longer than half a page

### Source Links
When generating documents based on research or web content, you MUST automatically include source links at the end of the document:
- Add a "## Sources" section listing every URL you visited and used
- Format: `- [Title](url)` with the actual title of the page
- Only include sources you actually read, not search result pages
- Place sources section at the very end of the document

### Formatting
- Use Markdown TABLES for all data comparisons and structured information
- Required for lists of numbers or features
- Use **BOLD** and *ITALIC* for emphasis
- Use emojis naturally
