---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Processing Guide

> Comet runtime note: Prefer JS/Electron paths first (pdf-lib/printToPDF). If Python/soffice/poppler are missing (common in .dmg), skip those steps gracefully. Check availability before invoking CLI tools.

If `pythonAvailable` flag is true (passed in payload), you may use python/soffice/poppler QA helpers; if false, skip them.

## PDF Generation Methods in Aartiq

Aartiq supports three methods for generating PDFs. Use `CREATE_PDF_JSON` command:

```json
{
  "format": "pdf",
  "method": "html",  // "html" | "pdfmake" | "pdf-lib" (default: "html")
  "title": "Document Title",
  "content": "Body text...",
  "template": "professional",
  "watermark": "CONFIDENTIAL",
  "bgColor": "#0b1224",
  "images": [
    {"type": "url", "src": "https://...", "caption": "Optional"},
    {"type": "screenshot", "caption": "Current browser view"}
  ]
}
```

**Attaching screenshots to PDFs (CRITICAL):**
- `SCREENSHOT_AND_ANALYZE` only extracts TEXT via OCR — it does NOT capture the image for embedding
- To include the actual page screenshot in a PDF, you MUST explicitly add it to the images array:
  ```json
  "images": [{"type": "screenshot", "caption": "Browser page at capture time"}]
  ```
- When the user says "with screenshot", "capture this page", or "include this page", automatically add `"type": "screenshot"` to the images array
- Alternative: Use inline tag `[CAPTURE_SCREEN]` or `[CAPTURE_SCREEN|caption:Description]` in content

### 1. Electron printToPDF (HTML - Default)

Best for: Rich formatting, templates, watermarks, mixed content. Uses HTML/CSS rendering.

```javascript
// In main.js - default method
const pdfData = await workerWindow.webContents.printToPDF({
  printBackground: true,
  pageSize: 'A4',
  margins: { top: 0, bottom: 0, left: 0, right: 0 }
});
```

### 2. pdfmake (Declarative JSON)

Best for: Structured reports, tables, repeat layouts. Declarative - you define structure, pdfmake renders.

```javascript
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const docDefinition = {
  content: [
    { text: 'Title', style: 'header' },
    { text: 'Body text', margin: [0, 0, 0, 10] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto'],
        body: [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Cell 1', 'Cell 2', 'Cell 3']
        ]
      }
    }
  ],
  styles: {
    header: { fontSize: 22, bold: true, color: '#0f172a' }
  }
};

const pdfDoc = pdfMake.createPdf(docDefinition);
pdfDoc.getBuffer((buffer) => { /* use buffer */ });
pdfDoc.getBase64((base64) => { /* use base64 */ });
```

### 3. pdf-lib (Programmatic)

Best for: Low-level control, modifying existing PDFs, cryptographic operations.

```javascript
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  page.drawText('Hello World', {
    x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0)
  });
  
  // Add more pages, images, etc.
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
```

### Quick Reference

| Method | Best For | Library |
|--------|----------|---------|
| HTML | Rich formatting, watermarks | Electron printToPDF |
| pdfmake | Reports, tables, declarative | pdfmake/build/pdfmake |
| pdf-lib | Low-level control, modify PDFs | pdf-lib |

## Python Libraries (Extraction & Manipulation)

### pypdf - Basic Operations

#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - Create PDFs

#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
```

#### Create PDF with Multiple Pages
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
```

#### Subscripts and Superscripts

**IMPORTANT**: Never use Unicode subscript/superscript characters (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹) in ReportLab PDFs. The built-in fonts do not include these glyphs, causing them to render as solid black boxes.

Instead, use ReportLab's XML markup tags in Paragraph objects:
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# Subscripts: use <sub> tag
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# Superscripts: use <super> tag
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
```

For canvas-drawn text (not Paragraph objects), manually adjust font the size and position rather than using Unicode subscripts/superscripts.

## PDF Generation Methods in Aartiq

Aartiq supports three methods for generating PDFs. Choose based on your needs:

### 1. Electron printToPDF (HTML - Default)

Best for: Rich formatting, templates, watermarks, mixed content

Uses HTML/CSS rendering with Electron's `printToPDF`. Supports all CSS features.

```javascript
// In main.js or renderer
const { webContents } = require('electron');
const pdfData = await webContents.printToPDF({
  printBackground: true,
  pageSize: 'A4',
  margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
});
```

### 2. pdfmake (Declarative JSON)

Best for: Structured reports, tables, repeat layouts

Uses declarative JSON definitions - you define the structure, pdfmake renders it.

```javascript
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.pdfMake.vfs;

const docDefinition = {
  content: [
    { text: 'Title', style: 'header' },
    { text: 'Body text', margin: [0, 0, 0, 10] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          ['Header 1', 'Header 2', 'Header 3', 'Header 4'],
          ['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4']
        ]
      }
    }
  ],
  styles: {
    header: { fontSize: 22, bold: true, color: '#0f172a' }
  }
};

const pdfDocGenerator = pdfMake.createPdf(docDefinition);
pdfDocGenerator.getBuffer((buffer) => { /* use buffer */ });
```

### 3. pdf-lib (Programmatic)

Best for: Low-level control, modifying existing PDFs, cryptographic operations

Programmatic API - you control every drawing operation.

```javascript
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function createPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  page.drawText('Hello World', {
    x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0)
  });
  
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
```

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
```

### qpdf
```bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
```

## Common Tasks

### Extract Text from Scanned PDFs
```python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Watermark CSS for Electron printToPDF

When using Electron's `printToPDF`, watermarks must use absolute positioning with print media queries:

```css
.watermark-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  transform: translate(-50%, -50%) rotate(-22deg);
  opacity: 0.08;
  font-size: 72px;
  font-weight: bold;
  color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  z-index: 0;
}

@media print {
  .watermark-container {
    position: fixed;
  }
}
```

**Key points:**
- Use `position: absolute` by default, switch to `position: fixed` via `@media print`
- `position: fixed` alone doesn't work with Electron's printToPDF
- `width: 200%` and `height: 200%` ensures watermark covers full page when rotated
- `opacity: 0.08` provides subtle watermark effect

### Extract Images
```bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pdf-lib or pypdf (see FORMS.md) | See FORMS.md |

## Next Steps

- For advanced pypdfium2 usage, see REFERENCE.md
- For JavaScript libraries (pdf-lib), see REFERENCE.md
- If you need to fill out a PDF form, follow the instructions in FORMS.md
- For troubleshooting guides, see REFERENCE.md
