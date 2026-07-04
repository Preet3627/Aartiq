---
name: pptx
description: "Use this skill any time a .pptx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx file (even if the extracted content will be used elsewhere, like in an email or summary); editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates, layouts, speaker notes, or comments. Trigger whenever the user mentions \"deck,\" \"slides,\" \"presentation,\" or references a .pptx filename, regardless of what they plan to do with the content afterward. If a .pptx file needs to be opened, created, or touched, use this skill."
license: Proprietary. LICENSE.txt has complete terms
---

# PPTX Skill

> Comet runtime note: Use JS-only pipeline (`pptxgenjs`). If Python/soffice/poppler aren't available (packaged .dmg), skip those QA/image-export helpers.

If `pythonAvailable` flag is true (passed in payload), you may run optional CLI QA (soffice+pdftoppm); otherwise, skip.

Minimal JSON shape AI should emit (CREATE_FILE_JSON):
```json
{
  "format": "pptx",
  "title": "Deck Title",
  "subtitle": "Tagline",
  "pages": [
    {"title": "Slide 1", "sections": [{"title": "Point", "content": "Bullets or paragraphs"}]}
  ],
  "images": [
    {"type": "url", "src": "https://...", "caption": "Optional"},
    {"type": "screenshot", "caption": "Current browser view"}
  ]
}
```

**Attaching screenshots to slides:**
- Use `"type": "screenshot"` in images array to attach the current browser view
- Works for PDF, DOCX, and PPTX generation
- Alternative: Use inline tag `[CAPTURE_SCREEN]` in content

## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | `python -m markitdown presentation.pptx` |
| Edit or create from template | Read [editing.md](editing.md) |
| Create from scratch | Read [pptxgenjs.md](pptxgenjs.md) |

---

## Reading Content

```bash
# Text extraction
python -m markitdown presentation.pptx

# Visual overview
python scripts/thumbnail.py presentation.pptx

# Raw XML
python scripts/office/unpack.py presentation.pptx unpacked/
```

---

## Editing Workflow

**Read [editing.md](editing.md) for full details.**

1. Analyze template with `thumbnail.py`
2. Unpack → manipulate slides → edit content → clean → pack

---

## Creating from Scratch

**Read [pptxgenjs.md](pptxgenjs.md) for full details.**

Use when no template or reference presentation is available.

### God-Tier Presentation Structure

For premium presentations, structure your deck with these slide types:

#### 1. Cover Slide (Dark Background)
```javascript
const cover = pptx.addSlide();
cover.background = { color: palette.bg };

// Top accent bar
cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.15, fill: { color: palette.accent } });

// Centered logo
if (iconBase64) {
  cover.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 4.25, y: 1.0, w: 1.5, h: 1.5 });
}

// Title (large, white, centered)
cover.addText(title, {
  x: 0.5, y: 2.8, w: 9, h: 1.2,
  fontSize: 44, bold: true, color: 'FFFFFF', align: 'center'
});

// Subtitle
cover.addText(subtitle, {
  x: 0.5, y: 3.9, w: 9, h: 0.6,
  fontSize: 22, color: palette.accent, align: 'center'
});

// Author and date
if (payload.author) {
  cover.addText(`by ${payload.author}`, { x: 0.5, y: 4.6, w: 9, h: 0.4, fontSize: 16, color: 'AAAAAA', align: 'center' });
}

// Bottom accent bar
cover.addShape(pptx.ShapeType.rect, { x: 0, y: 5.475, w: 10, h: 0.15, fill: { color: palette.accent } });
```

#### 2. Content Slides (Header Bar Layout)
```javascript
const slide = pptx.addSlide();
slide.background = { color: 'FFFFFF' };

// Header bar with accent color
slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.9, fill: { color: palette.accent } });

// Slide title in header
slide.addText(page.title, {
  x: 0.5, y: 0.15, w: 8, h: 0.6,
  fontSize: 26, bold: true, color: 'FFFFFF', margin: 0
});

// Small logo in header
if (iconBase64) {
  slide.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 9.0, y: 0.15, w: 0.6, h: 0.6 });
}

// Content area below header
```

#### 3. Two-Column Layout (Text + Image)
```javascript
// Image on right
if (parsed) {
  slide.addImage({
    data: `data:${parsed.mime};base64,${parsed.buffer.toString('base64')}`,
    x: 5.2, y: 1.1, w: 4.3, h: 3.2,
    shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, opacity: 0.2 }
  });
}

// Content on left
slide.addText(sectionBlocks.join('\n\n'), {
  x: 0.5, y: 1.1, w: 4.5, h: 3.5,
  fontSize: 15, color: '333333', valign: 'top', lineSpacingMultiple: 1.3
});
```

#### 4. Table Layout
```javascript
const tableData = section.table.map((r) =>
  (Array.isArray(r) ? r : []).map((c) => ({
    text: c?.toString?.() || '',
    options: { fill: { color: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' } }
  }))
);
slide.addTable(tableData, {
  x: 0.5, y: bodyY, w: 9, h: 2.5,
  colW: [3, 3, 3],
  border: { pt: 0.5, color: 'DDDDDD' },
  fontFace: 'Arial', fontSize: 12,
});
```

#### 5. Thank You Slide
```javascript
const thankYou = pptx.addSlide();
thankYou.background = { color: palette.bg };

// Top and bottom accent bars
thankYou.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.15, fill: { color: palette.accent } });

// Centered logo and thank you text
if (iconBase64) {
  thankYou.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 4.25, y: 1.5, w: 1.5, h: 1.5 });
}

thankYou.addText('Thank You', {
  x: 0.5, y: 3.2, w: 9, h: 1,
  fontSize: 48, bold: true, color: 'FFFFFF', align: 'center'
});

thankYou.addText('Questions & Discussion', {
  x: 0.5, y: 4.2, w: 9, h: 0.5,
  fontSize: 20, color: palette.accent, align: 'center'
});

thankYou.addShape(pptx.ShapeType.rect, { x: 0, y: 5.475, w: 10, h: 0.15, fill: { color: palette.accent } });
```

### Slide Metadata
```javascript
pptx.title = payload.title || 'Presentation';
pptx.author = payload.author || 'Aartiq';
pptx.subject = payload.subtitle || '';
```

### Page Numbers in Footer
```javascript
slide.addText(`${pageIndex + 2} / ${pages.length + 1}`, {
  x: 9, y: 5.2, w: 0.8, h: 0.3,
  fontSize: 10, color: 'AAAAAA', align: 'right'
});
```

---

## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone. Consider ideas from this list for each slide.

### Before Starting

- **Pick a bold, content-informed color palette**: The palette should feel designed for THIS topic. If swapping your colors into a completely different presentation would still "work," you haven't made specific enough choices.
- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure). Or commit to dark throughout for a premium feel.
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it — rounded image frames, icons in colored circles, thick single-side borders. Carry it across every slide.

### Color Palettes

Choose colors that match your topic — don't default to generic blue. Use these palettes as inspiration:

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| **Midnight Executive** | `1E2761` (navy) | `CADCFC` (ice blue) | `FFFFFF` (white) |
| **Forest & Moss** | `2C5F2D` (forest) | `97BC62` (moss) | `F5F5F5` (cream) |
| **Coral Energy** | `F96167` (coral) | `F9E795` (gold) | `2F3C7E` (navy) |
| **Warm Terracotta** | `B85042` (terracotta) | `E7E8D1` (sand) | `A7BEAE` (sage) |
| **Ocean Gradient** | `065A82` (deep blue) | `1C7293` (teal) | `21295C` (midnight) |
| **Charcoal Minimal** | `36454F` (charcoal) | `F2F2F2` (off-white) | `212121` (black) |
| **Teal Trust** | `028090` (teal) | `00A896` (seafoam) | `02C39A` (mint) |
| **Berry & Cream** | `6D2E46` (berry) | `A26769` (dusty rose) | `ECE2D0` (cream) |
| **Sage Calm** | `84B59F` (sage) | `69A297` (eucalyptus) | `50808E` (slate) |
| **Cherry Bold** | `990011` (cherry) | `FCF6F5` (off-white) | `2F3C7E` (navy) |

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration on right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image on one side, grid of content blocks on other)
- Half-bleed image (full left or right side) with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons, side-by-side options)
- Timeline or process flow (numbered steps, arrows)

**Visual polish:**
- Icons in small colored circles next to section headers
- Italic accent text for key stats or taglines

### Typography

**Choose an interesting font pairing** — don't default to Arial. Pick a header font with personality and pair it with a clean body font.

| Header Font | Body Font |
|-------------|-----------|
| Georgia | Calibri |
| Arial Black | Arial |
| Calibri | Calibri Light |
| Cambria | Calibri |
| Trebuchet MS | Calibri |
| Impact | Arial |
| Palatino | Garamond |
| Consolas | Calibri |

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room—don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** — vary columns, cards, and callouts across slides
- **Don't center body text** — left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** — titles need 36pt+ to stand out from 14-16pt body
- **Don't default to blue** — pick colors that reflect the specific topic
- **Don't mix spacing randomly** — choose 0.3" or 0.5" gaps and use consistently
- **Don't style one slide and leave the rest plain** — commit fully or keep it simple throughout
- **Don't create text-only slides** — add images, icons, charts, or visual elements; avoid plain title + bullets
- **Don't forget text box padding** — when aligning lines or shapes with text edges, set `margin: 0` on the text box or offset the shape to account for padding
- **Don't use low-contrast elements** — icons AND text need strong contrast against the background; avoid light text on light backgrounds or dark text on dark backgrounds
- **NEVER use accent lines under titles** — these are a hallmark of AI-generated slides; use whitespace or background color instead

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

### Content QA

```bash
python -m markitdown output.pptx
```

Check for missing content, typos, wrong order.

**When using templates, check for leftover placeholder text:**

```bash
python -m markitdown output.pptx | grep -iE "\bx{3,}\b|lorem|ipsum|\bTODO|\[insert|this.*(page|slide).*layout"
```

If grep returns results, fix them before declaring success.

### Visual QA

**⚠️ USE SUBAGENTS** — even for 2-3 slides. You've been staring at the code and will see what you expect, not what's there. Subagents have fresh eyes.

Convert slides to images (see [Converting to Images](#converting-to-images)), then use this prompt:

```
Visually inspect these slides. Assume there are issues — find them.

Look for:
- Overlapping elements (text through shapes, lines through words, stacked elements)
- Text overflow or cut off at edges/box boundaries
- Decorative lines positioned for single-line text but title wrapped to two lines
- Source citations or footers colliding with content above
- Elements too close (< 0.3" gaps) or cards/sections nearly touching
- Uneven gaps (large empty area in one place, cramped in another)
- Insufficient margin from slide edges (< 0.5")
- Columns or similar elements not aligned consistently
- Low-contrast text (e.g., light gray text on cream-colored background)
- Low-contrast icons (e.g., dark icons on dark backgrounds without a contrasting circle)
- Text boxes too narrow causing excessive wrapping
- Leftover placeholder content

For each slide, list issues or areas of concern, even if minor.

Read and analyze these images — run `ls -1 "$PWD"/slide-*.jpg` and use the exact absolute paths it prints:
1. <absolute-path>/slide-N.jpg — (Expected: [brief description])
2. <absolute-path>/slide-N.jpg — (Expected: [brief description])
...

Report ALL issues found, including minor ones.
```

### Verification Loop

1. Generate slides → Convert to images → Inspect
2. **List issues found** (if none found, look again more critically)
3. Fix issues
4. **Re-verify affected slides** — one fix often creates another problem
5. Repeat until a full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**

---

## Converting to Images

Convert presentations to individual slide images for visual inspection:

```bash
python scripts/office/soffice.py --headless --convert-to pdf output.pptx
rm -f slide-*.jpg
pdftoppm -jpeg -r 150 output.pdf slide
ls -1 "$PWD"/slide-*.jpg
```

**Pass the absolute paths printed above directly to the view tool.** The `rm` clears stale images from prior runs. `pdftoppm` zero-pads based on page count: `slide-1.jpg` for decks under 10 pages, `slide-01.jpg` for 10-99, `slide-001.jpg` for 100+.

**After fixes, rerun all four commands above** — the PDF must be regenerated from the edited `.pptx` before `pdftoppm` can reflect your changes.

---

## Dependencies

- `pip install "markitdown[pptx]"` - text extraction
- `pip install Pillow` - thumbnail grids
- `npm install -g pptxgenjs` - creating from scratch
- LibreOffice (`soffice`) - PDF conversion (auto-configured for sandboxed environments via `scripts/office/soffice.py`)
- Poppler (`pdftoppm`) - PDF to images
