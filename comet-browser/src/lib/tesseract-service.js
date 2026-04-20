const { desktopCapturer, screen } = require('electron');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');

const execFilePromise = util.promisify(execFile);

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[TesseractService] sharp not available, preprocessing disabled:', e.message);
}

let nativeMacOcr = null;
try {
  if (process.platform === 'darwin') {
    nativeMacOcr = require('@cherrystudio/mac-system-ocr');
    console.log('[TesseractService] Native macOS OCR loaded successfully');
  }
} catch (e) {
  console.warn('[TesseractService] @cherrystudio/mac-system-ocr not available:', e.message);
  nativeMacOcr = null;
}

let uniOcr = null;
let uniOcrProvider = null;
try {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    uniOcr = require('uniocr');
    console.log('[TesseractService] uniOCR loaded successfully');
  }
} catch (e) {
  console.warn('[TesseractService] uniOCR not available:', e.message);
  uniOcr = null;
}

let rustOcr = null;
try {
  if (process.platform !== 'win32') {
    rustOcr = require('rusto');
    console.log('[TesseractService] RustO! OCR loaded successfully');
  }
} catch (e) {
  console.warn('[TesseractService] RustO! not available:', e.message);
  rustOcr = null;
}

let robotjs = null;
try {
  robotjs = require('robotjs');
  robotjs.setMouseDelay(2);
} catch (e) {
  try {
    robotjs = require('@jitsi/robotjs');
    robotjs.setMouseDelay(2);
  } catch (e2) {
    console.warn('[TesseractService] robotjs not available:', e.message);
  }
}

const MAX_CAPTURE_EDGE = 4096;
const NATIVE_MATCH_THRESHOLD = 0.58;
const OCR_MATCH_THRESHOLD = 0.52;

function clampConfidence(value, fallback = 0.85) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100));
  return Math.max(0, Math.min(1, numeric));
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ') : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);

  for (let i = 1; i <= a.length; i += 1) {
    let left = i;
    let diagonal = i - 1;

    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      const next = a[i - 1] === b[j - 1]
        ? diagonal
        : Math.min(diagonal + 1, up + 1, left + 1);

      diagonal = up;
      prev[j] = next;
      left = next;
    }

    prev[0] = i;
  }

  return prev[b.length];
}

function normalizeBbox(bbox) {
  if (!bbox || typeof bbox !== 'object') return null;

  const x0 = Number(bbox.x0 ?? bbox.x ?? bbox.left);
  const y0 = Number(bbox.y0 ?? bbox.y ?? bbox.top);
  const x1 = Number(bbox.x1 ?? ((bbox.x ?? bbox.left ?? 0) + (bbox.width ?? 0)));
  const y1 = Number(bbox.y1 ?? ((bbox.y ?? bbox.top ?? 0) + (bbox.height ?? 0)));

  if (![x0, y0, x1, y1].every(Number.isFinite)) {
    return null;
  }

  return {
    x0: Math.round(Math.min(x0, x1)),
    y0: Math.round(Math.min(y0, y1)),
    x1: Math.round(Math.max(x0, x1)),
    y1: Math.round(Math.max(y0, y1)),
  };
}

function centerFromBbox(bbox) {
  const safeBox = normalizeBbox(bbox);
  if (!safeBox) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round((safeBox.x0 + safeBox.x1) / 2),
    y: Math.round((safeBox.y0 + safeBox.y1) / 2),
  };
}

function createEntry(text, bbox, confidence, extra = {}) {
  const clean = cleanText(text);
  const safeBox = normalizeBbox(bbox);

  if (!clean || !safeBox) return null;

  const center = centerFromBbox(safeBox);
  return {
    text: clean,
    confidence: clampConfidence(confidence),
    bbox: safeBox,
    centerX: center.x,
    centerY: center.y,
    ...extra,
  };
}

function dedupeEntries(entries = []) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    if (!entry?.text || !entry?.bbox) continue;
    const key = [
      normalizeText(entry.text),
      entry.bbox.x0,
      entry.bbox.y0,
      entry.bbox.x1,
      entry.bbox.y1,
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function mergeEntriesToLines(entries = []) {
  if (!entries.length) return [];

  const sorted = [...entries].sort((a, b) => {
    if (Math.abs(a.centerY - b.centerY) > 14) return a.centerY - b.centerY;
    return a.centerX - b.centerX;
  });

  const groups = [];

  for (const entry of sorted) {
    const height = Math.max(1, entry.bbox.y1 - entry.bbox.y0);
    const verticalTolerance = Math.max(16, Math.round(height * 0.7));
    const group = groups.find((candidate) => Math.abs(candidate.avgY - entry.centerY) <= verticalTolerance);

    if (group) {
      group.entries.push(entry);
      group.avgY = Math.round(
        group.entries.reduce((sum, item) => sum + item.centerY, 0) / group.entries.length
      );
      continue;
    }

    groups.push({ avgY: entry.centerY, entries: [entry] });
  }

  return groups.map((group) => {
    const row = [...group.entries].sort((a, b) => a.centerX - b.centerX);
    const text = row.map((item) => item.text).join(' ');
    const bbox = {
      x0: Math.min(...row.map((item) => item.bbox.x0)),
      y0: Math.min(...row.map((item) => item.bbox.y0)),
      x1: Math.max(...row.map((item) => item.bbox.x1)),
      y1: Math.max(...row.map((item) => item.bbox.y1)),
    };
    const confidence = row.reduce((sum, item) => sum + clampConfidence(item.confidence), 0) / row.length;
    return createEntry(text, bbox, confidence, { source: 'merged-line' });
  }).filter(Boolean);
}

function scoreCandidate(targetText, candidate) {
  const target = normalizeText(targetText);
  const current = normalizeText(candidate?.text);

  if (!target || !current) return 0;
  if (target === current) return 1.25 + clampConfidence(candidate.confidence) * 0.05;

  let score = 0;

  if (current.includes(target)) {
    score = Math.max(score, 0.98 - Math.min(0.16, Math.abs(current.length - target.length) * 0.01));
  }

  if (target.includes(current)) {
    score = Math.max(score, 0.82 - Math.min(0.14, Math.abs(current.length - target.length) * 0.01));
  }

  const targetTokens = tokenize(target);
  const currentTokens = tokenize(current);
  if (targetTokens.length && currentTokens.length) {
    const overlap = targetTokens.filter((token) => currentTokens.includes(token)).length;
    const coverage = overlap / Math.max(targetTokens.length, currentTokens.length);
    score = Math.max(score, coverage * 0.9);
  }

  const maxLen = Math.max(target.length, current.length);
  if (maxLen > 0) {
    const similarity = 1 - (levenshtein(target, current) / maxLen);
    score = Math.max(score, similarity * 0.78);
  }

  if (candidate?.role) {
    const role = String(candidate.role).toLowerCase();
    if (/(button|link|menu|menu item|tab|checkbox|radio)/.test(role)) {
      score += 0.03;
    }
  }

  return score + clampConfidence(candidate?.confidence, 0.7) * 0.04;
}

function selectBestCandidate(targetText, candidates = [], threshold = OCR_MATCH_THRESHOLD) {
  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(targetText, candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < threshold) return null;
  return best;
}

class TesseractOcrService {
  constructor() {
    this.worker = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized && this.worker) return;
    try {
      this.worker = await createWorker('eng');
      this.initialized = true;
      console.log('[TesseractService] Worker initialized');
    } catch (e) {
      console.error('[TesseractService] Failed to init worker:', e.message);
      this.worker = null;
      this.initialized = false;
      throw e;
    }
  }

  async terminate() {
    if (this.worker) {
      try { await this.worker.terminate(); } catch (e) {}
      this.worker = null;
      this.initialized = false;
    }
  }

  getDisplay(displayId) {
    const displays = screen.getAllDisplays();
    if (displayId !== undefined && displayId !== null) {
      return displays.find((item) => String(item.id) === String(displayId)) || screen.getPrimaryDisplay();
    }
    return screen.getPrimaryDisplay();
  }

  async captureScreen(displayId) {
    const targetDisplay = this.getDisplay(displayId);
    const scaleFactor = targetDisplay.scaleFactor || 1;
    const { width, height } = targetDisplay.size;
    const thumbnailSize = {
      width: Math.min(MAX_CAPTURE_EDGE, Math.round(width * scaleFactor)),
      height: Math.min(MAX_CAPTURE_EDGE, Math.round(height * scaleFactor)),
    };

    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
    const source = sources.find((item) => String(item.display_id) === String(targetDisplay.id)) || sources[0];

    if (!source || !source.thumbnail) {
      throw new Error('Could not capture screen');
    }

    return {
      png: source.thumbnail.toPNG(),
      scaleFactor,
      captureWidth: thumbnailSize.width,
      captureHeight: thumbnailSize.height,
      screenWidth: width,
      screenHeight: height,
      screenOriginX: targetDisplay.bounds?.x || 0,
      screenOriginY: targetDisplay.bounds?.y || 0,
      displayId: targetDisplay.id,
      displayBounds: targetDisplay.bounds,
    };
  }

  async preprocessImage(pngBuffer) {
    if (!sharp) return pngBuffer;

    try {
      return await sharp(pngBuffer)
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5 })
        .resize({ width: 3840, kernel: 'lanczos3', withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (e) {
      console.warn('[TesseractService] Preprocessing failed, using raw image:', e.message);
      return pngBuffer;
    }
  }

  mapCaptureBboxToScreen(bbox, capture, preprocessScale = 1) {
    const safeBox = normalizeBbox(bbox);
    if (!safeBox) return null;

    const scaleX = capture.screenWidth / capture.captureWidth;
    const scaleY = capture.screenHeight / capture.captureHeight;

    return normalizeBbox({
      x0: capture.screenOriginX + ((safeBox.x0 / preprocessScale) * scaleX),
      y0: capture.screenOriginY + ((safeBox.y0 / preprocessScale) * scaleY),
      x1: capture.screenOriginX + ((safeBox.x1 / preprocessScale) * scaleX),
      y1: capture.screenOriginY + ((safeBox.y1 / preprocessScale) * scaleY),
    });
  }

  filterEntriesToDisplay(entries = [], displayId) {
    if (displayId === undefined || displayId === null) {
      return dedupeEntries(entries);
    }

    const targetDisplay = this.getDisplay(displayId);
    const bounds = targetDisplay.bounds;

    return dedupeEntries(entries.filter((entry) => {
      const box = entry?.bbox;
      if (!box) return false;
      return box.x1 >= bounds.x
        && box.x0 <= bounds.x + bounds.width
        && box.y1 >= bounds.y
        && box.y0 <= bounds.y + bounds.height;
    }));
  }

  async captureAndRecognizeWithTesseract(displayId) {
    await this.init();

    const capture = await this.captureScreen(displayId);
    const processed = await this.preprocessImage(capture.png);
    const metadata = sharp ? await sharp(processed).metadata().catch(() => null) : null;
    const preprocessScale = metadata?.width
      ? metadata.width / capture.captureWidth
      : 1;

    const tempPath = path.join(os.tmpdir(), `comet-ocr-${Date.now()}.png`);
    fs.writeFileSync(tempPath, processed);

    let data;
    try {
      const result = await this.worker.recognize(tempPath);
      data = result.data;
    } catch (e) {
      console.error('[TesseractService] OCR failed:', e.message);
      try { await this.terminate(); } catch (_) {}
      throw e;
    } finally {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }

    const words = dedupeEntries((data.words || [])
      .filter((word) => clampConfidence(word.confidence) > 0.55 && cleanText(word.text).length > 0)
      .map((word) => createEntry(
        word.text,
        this.mapCaptureBboxToScreen(word.bbox, capture, preprocessScale),
        word.confidence,
        { source: 'tesseract-word', provider: 'tesseract' }
      ))
      .filter(Boolean));

    const lines = dedupeEntries((data.lines || [])
      .filter((line) => clampConfidence(line.confidence) > 0.45 && cleanText(line.text).length > 0)
      .map((line) => createEntry(
        line.text,
        this.mapCaptureBboxToScreen(line.bbox, capture, preprocessScale),
        line.confidence,
        { source: 'tesseract-line', provider: 'tesseract' }
      ))
      .filter(Boolean));

    return {
      provider: 'tesseract',
      strategy: 'image-ocr',
      words,
      lines: lines.length ? lines : mergeEntriesToLines(words),
    };
  }

  async captureAndRecognizeWithMacNative(displayId) {
    if (!nativeMacOcr?.getScreenTextWithBoxes) {
      return null;
    }

    try {
      const result = await nativeMacOcr.getScreenTextWithBoxes();
      const rawEntries = Array.isArray(result?.results) ? result.results : [];
      const lines = this.filterEntriesToDisplay(rawEntries
        .map((item) => createEntry(
          item.text,
          item.bbox || {
            x0: item.left,
            y0: item.top,
            x1: (item.left || 0) + (item.width || 0),
            y1: (item.top || 0) + (item.height || 0),
          },
          item.confidence ?? 0.96,
          { source: 'macos-native-line', provider: 'macos-vision' }
        ))
        .filter(Boolean), displayId);

      if (!lines.length) {
        return null;
      }

      return {
        provider: 'macos-vision',
        strategy: 'native-ocr',
        words: dedupeEntries(lines.flatMap((line) => {
          const tokens = tokenize(line.text);
          if (tokens.length <= 1) return [line];

          const width = Math.max(1, line.bbox.x1 - line.bbox.x0);
          const segmentWidth = Math.max(1, Math.round(width / tokens.length));

          return tokens.map((token, index) => createEntry(
            token,
            {
              x0: line.bbox.x0 + (segmentWidth * index),
              y0: line.bbox.y0,
              x1: index === tokens.length - 1 ? line.bbox.x1 : line.bbox.x0 + (segmentWidth * (index + 1)),
              y1: line.bbox.y1,
            },
            line.confidence,
            { source: 'macos-native-word', provider: 'macos-vision' }
          )).filter(Boolean);
        })),
        lines,
      };
    } catch (e) {
      console.warn('[TesseractService] Native macOS OCR failed:', e.message);
      return null;
    }
  }

  async captureAndRecognizeWithWindowsNative(displayId) {
    const capture = await this.captureScreen(displayId);
    const imagePath = path.join(os.tmpdir(), `comet-win-ocr-${Date.now()}.png`);
    const scriptPath = path.join(os.tmpdir(), `comet-win-ocr-${Date.now()}.ps1`);

    const script = `
param([string]$ImagePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType=WindowsRuntime] | Out-Null

$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath).GetAwaiter().GetResult()
$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
$bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
  throw 'Windows OCR engine unavailable'
}

$result = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
$payload = [PSCustomObject]@{
  text = $result.Text
  lines = @(
    foreach ($line in $result.Lines) {
      $lineWords = @(
        foreach ($word in $line.Words) {
          [PSCustomObject]@{
            text = $word.Text
            confidence = 0.95
            bbox = [PSCustomObject]@{
              x = [int]$word.BoundingRect.X
              y = [int]$word.BoundingRect.Y
              width = [int]$word.BoundingRect.Width
              height = [int]$word.BoundingRect.Height
            }
          }
        }
      )

      $minX = [int]$line.Words[0].BoundingRect.X
      $minY = [int]$line.Words[0].BoundingRect.Y
      $maxX = [int]($line.Words[0].BoundingRect.X + $line.Words[0].BoundingRect.Width)
      $maxY = [int]($line.Words[0].BoundingRect.Y + $line.Words[0].BoundingRect.Height)
      foreach ($lineWord in $line.Words) {
        $wordRight = [int]($lineWord.BoundingRect.X + $lineWord.BoundingRect.Width)
        $wordBottom = [int]($lineWord.BoundingRect.Y + $lineWord.BoundingRect.Height)
        if ($lineWord.BoundingRect.X -lt $minX) { $minX = [int]$lineWord.BoundingRect.X }
        if ($lineWord.BoundingRect.Y -lt $minY) { $minY = [int]$lineWord.BoundingRect.Y }
        if ($wordRight -gt $maxX) { $maxX = $wordRight }
        if ($wordBottom -gt $maxY) { $maxY = $wordBottom }
      }

      [PSCustomObject]@{
        text = $line.Text
        confidence = 0.95
        bbox = [PSCustomObject]@{
          x = $minX
          y = $minY
          width = [int]($maxX - $minX)
          height = [int]($maxY - $minY)
        }
        words = $lineWords
      }
    }
  )
}

$payload | ConvertTo-Json -Compress -Depth 8
`;

    fs.writeFileSync(imagePath, capture.png);
    fs.writeFileSync(scriptPath, script);

    try {
      const { stdout } = await execFilePromise('powershell', [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', scriptPath,
        imagePath,
      ], { maxBuffer: 10 * 1024 * 1024 });

      const cleaned = String(stdout || '').trim();
      if (!cleaned) return null;

      const payload = JSON.parse(cleaned);
      const lines = dedupeEntries((payload.lines || [])
        .map((line) => createEntry(
          line.text,
          this.mapCaptureBboxToScreen(line.bbox, capture, 1),
          line.confidence ?? 0.95,
          { source: 'windows-native-line', provider: 'windows-media-ocr' }
        ))
        .filter(Boolean));

      const words = dedupeEntries((payload.lines || [])
        .flatMap((line) => line.words || [])
        .map((word) => createEntry(
          word.text,
          this.mapCaptureBboxToScreen(word.bbox, capture, 1),
          word.confidence ?? 0.95,
          { source: 'windows-native-word', provider: 'windows-media-ocr' }
        ))
        .filter(Boolean));

      if (!lines.length && !words.length) {
        return null;
      }

      return {
        provider: 'windows-media-ocr',
        strategy: 'native-ocr',
        words,
        lines: lines.length ? lines : mergeEntriesToLines(words),
      };
    } catch (e) {
      console.warn('[TesseractService] Native Windows OCR failed:', e.message);
      return null;
    } finally {
      try { fs.unlinkSync(imagePath); } catch (_) {}
      try { fs.unlinkSync(scriptPath); } catch (_) {}
    }
  }

  async captureAndRecognizeWithLinuxNative(displayId) {
    const scriptPath = path.join(os.tmpdir(), `comet-linux-atspi-${Date.now()}.py`);
    const script = `
import json
import sys

try:
    import pyatspi
except Exception as exc:
    print(json.dumps({"error": f"pyatspi unavailable: {exc}"}))
    sys.exit(0)

desktop = pyatspi.Registry.getDesktop(0)
results = []
max_nodes = 700

def get_state(acc):
    try:
        return acc.getState()
    except Exception:
        return None

def is_active(acc):
    state = get_state(acc)
    if not state:
        return False
    try:
        return state.contains(pyatspi.STATE_ACTIVE)
    except Exception:
        return False

def get_text(acc):
    value = ''
    try:
        value = (acc.name or '').strip()
    except Exception:
        value = ''
    if value:
        return ' '.join(value.split())
    try:
        text_iface = acc.queryText()
        char_count = getattr(text_iface, 'characterCount', 0)
        if char_count:
            return ' '.join(text_iface.getText(0, min(char_count, 220)).split())
    except Exception:
        return ''
    return ''

def get_role(acc):
    try:
        return acc.getRoleName()
    except Exception:
        return ''

def get_bbox(acc):
    try:
        comp = acc.queryComponent()
        ext = comp.getExtents(pyatspi.DESKTOP_COORDS)
        if ext and ext.width > 0 and ext.height > 0:
            return {
                "x0": int(ext.x),
                "y0": int(ext.y),
                "x1": int(ext.x + ext.width),
                "y1": int(ext.y + ext.height),
            }
    except Exception:
        return None
    return None

def visit(acc, depth=0):
    if len(results) >= max_nodes or depth > 8 or acc is None:
        return

    text = get_text(acc)
    bbox = get_bbox(acc)
    role = get_role(acc)

    if text and bbox:
        results.append({
            "text": text,
            "confidence": 0.98,
            "role": role,
            "bbox": bbox,
        })

    try:
        child_count = acc.childCount
    except Exception:
        child_count = 0

    for index in range(child_count):
        try:
            visit(acc.getChildAtIndex(index), depth + 1)
        except Exception:
            continue

active_roots = []
for app in desktop:
    if app is None:
        continue
    try:
        count = app.childCount
    except Exception:
        count = 0
    for index in range(count):
        try:
            child = app.getChildAtIndex(index)
        except Exception:
            continue
        if is_active(child):
            active_roots.append(child)

if not active_roots:
    for app in desktop:
        if app is None:
            continue
        if is_active(app):
            active_roots.append(app)

for root in active_roots[:4]:
    visit(root)

print(json.dumps({"results": results}))
`;

    fs.writeFileSync(scriptPath, script);

    try {
      const { stdout } = await execFilePromise('python3', [scriptPath], { maxBuffer: 10 * 1024 * 1024 });
      const payload = JSON.parse(String(stdout || '').trim() || '{}');
      if (payload.error) {
        console.warn('[TesseractService] Native Linux accessibility failed:', payload.error);
        return null;
      }

      const entries = this.filterEntriesToDisplay((payload.results || [])
        .map((item) => createEntry(
          item.text,
          item.bbox,
          item.confidence ?? 0.98,
          {
            role: item.role,
            source: 'linux-atspi',
            provider: 'linux-atspi',
          }
        ))
        .filter(Boolean), displayId);

      if (!entries.length) {
        return null;
      }

      return {
        provider: 'linux-atspi',
        strategy: 'native-accessibility',
        words: entries,
        lines: mergeEntriesToLines(entries),
      };
    } catch (e) {
      console.warn('[TesseractService] Native Linux accessibility failed:', e.message);
      return null;
    } finally {
      try { fs.unlinkSync(scriptPath); } catch (_) {}
    }
  }

  async captureAndRecognizeWithUniOCR(displayId) {
    if (!uniOcr) {
      return null;
    }

    try {
      const capture = await this.captureScreen(displayId);
      const imagePath = path.join(os.tmpdir(), `comet-uniocr-${Date.now()}.png`);
      fs.writeFileSync(imagePath, capture.png);

      const provider = process.platform === 'darwin' ? 'macos' : (process.platform === 'win32' ? 'windows' : 'tesseract');
      const engine = uniOcr.OcrEngine.new(uniOcr.OcrProvider[provider]);
      
      const result = await engine.recognize(imagePath);
      
      const lines = this.filterEntriesToDisplay(
        result.results.map((item) => createEntry(
          item.text,
          { x0: item.left, y0: item.top, x1: item.left + item.width, y1: item.top + item.height },
          item.confidence ?? 0.95,
          { source: 'uniocr-line', provider: `uniocr-${provider}` }
        )).filter(Boolean),
        displayId
      );

      fs.unlinkSync(imagePath);
      
      return {
        provider: `uniocr-${provider}`,
        strategy: 'native-ocr',
        words: lines.flatMap((line) => {
          const tokens = tokenize(line.text);
          if (tokens.length <= 1) return [line];
          const width = Math.max(1, line.bbox.x1 - line.bbox.x0);
          const segmentWidth = Math.max(1, Math.round(width / tokens.length));
          return tokens.map((token, index) => createEntry(
            token,
            {
              x0: line.bbox.x0 + (segmentWidth * index),
              y0: line.bbox.y0,
              x1: index === tokens.length - 1 ? line.bbox.x1 : line.bbox.x0 + (segmentWidth * (index + 1)),
              y1: line.bbox.y1,
            },
            line.confidence,
            { source: 'uniocr-word', provider: `uniocr-${provider}` }
          )).filter(Boolean);
        }),
        lines,
      };
    } catch (e) {
      console.warn('[TesseractService] uniOCR failed:', e.message);
      return null;
    }
  }

  async captureAndRecognizeWithRustO(displayId) {
    if (!rustOcr) {
      return null;
    }

    try {
      const capture = await this.captureScreen(displayId);
      const imagePath = path.join(os.tmpdir(), `comet-rusto-${Date.now()}.png`);
      fs.writeFileSync(imagePath, capture.png);

      const engine = rustOcr.RustOcr.new(rustOcr.OcrModel.PPOCRv5);
      const result = await engine.recognize(imagePath);
      
      const lines = this.filterEntriesToDisplay(
        result.boxes.map((item) => createEntry(
          item.text,
          { x0: item.x, y0: item.y, x1: item.x + item.width, y1: item.y + item.height },
          item.confidence ?? 0.95,
          { source: 'rusto-line', provider: 'rusto-paddleocr' }
        )).filter(Boolean),
        displayId
      );

      fs.unlinkSync(imagePath);
      
      return {
        provider: 'rusto-paddleocr',
        strategy: 'native-ocr',
        words: lines.flatMap((line) => {
          const tokens = tokenize(line.text);
          if (tokens.length <= 1) return [line];
          const width = Math.max(1, line.bbox.x1 - line.bbox.x0);
          const segmentWidth = Math.max(1, Math.round(width / tokens.length));
          return tokens.map((token, index) => createEntry(
            token,
            {
              x0: line.bbox.x0 + (segmentWidth * index),
              y0: line.bbox.y0,
              x1: index === tokens.length - 1 ? line.bbox.x1 : line.bbox.x0 + (segmentWidth * (index + 1)),
              y1: line.bbox.y1,
            },
            line.confidence,
            { source: 'rusto-word', provider: 'rusto-paddleocr' }
          )).filter(Boolean);
        }),
        lines,
      };
    } catch (e) {
      console.warn('[TesseractService] RustO! OCR failed:', e.message);
      return null;
    }
  }

  async captureAndRecognizeNative(displayId) {
    const uniResult = await this.captureAndRecognizeWithUniOCR(displayId);
    if (uniResult?.words?.length || uniResult?.lines?.length) {
      console.log('[TesseractService] Using uniOCR for native OCR');
      return uniResult;
    }

    const rustoResult = await this.captureAndRecognizeWithRustO(displayId);
    if (rustoResult?.words?.length || rustoResult?.lines?.length) {
      console.log('[TesseractService] Using RustO! for native OCR');
      return rustoResult;
    }

    if (process.platform === 'darwin') {
      return this.captureAndRecognizeWithMacNative(displayId);
    }

    if (process.platform === 'win32') {
      return this.captureAndRecognizeWithWindowsNative(displayId);
    }

    if (process.platform === 'linux') {
      return this.captureAndRecognizeWithLinuxNative(displayId);
    }

    return null;
  }

  async captureAndOcr(displayId, options = {}) {
    const { preferNative = true } = options;

    if (preferNative) {
      const nativeResult = await this.captureAndRecognizeNative(displayId);
      if (nativeResult?.words?.length || nativeResult?.lines?.length) {
        return nativeResult;
      }
    }

    return this.captureAndRecognizeWithTesseract(displayId);
  }

  async ocrClick(targetDescription, aiEngine, robotService, permissionStore, useDirectClick = false) {
    const recognition = await this.captureAndOcr(undefined, { preferNative: true });
    const words = recognition.words || [];
    const lines = recognition.lines || [];

    if (words.length === 0 && lines.length === 0) {
      return { success: false, error: 'No text found on screen' };
    }

    const performClick = async (x, y, reason) => {
      if (useDirectClick && robotjs) {
        return this.directClick(x, y, reason);
      }

      if (robotService && robotService.execute) {
        try {
          await robotService.execute({
            type: 'click',
            x,
            y,
            reason,
          });
          return { success: true, x, y, reason };
        } catch (e) {
          console.warn('[TesseractService] robotService.execute failed, trying direct robotjs:', e.message);
          if (robotjs) {
            return this.directClick(x, y, reason);
          }
          return { success: false, error: e.message };
        }
      }

      if (robotjs) {
        return this.directClick(x, y, reason);
      }

      return { success: false, error: 'No click mechanism available' };
    };

    const lineMatch = selectBestCandidate(targetDescription, lines, recognition.strategy === 'native-accessibility'
      ? NATIVE_MATCH_THRESHOLD
      : OCR_MATCH_THRESHOLD);

    if (lineMatch) {
      const chosen = lineMatch.candidate;
      const result = await performClick(
        chosen.centerX,
        chosen.centerY,
        `OCR/native line match: "${chosen.text}" (target: "${targetDescription}")`
      );
      return {
        ...result,
        clickedText: chosen.text,
        method: `${recognition.provider}:line-match`,
        provider: recognition.provider,
        score: lineMatch.score,
      };
    }

    const wordMatch = selectBestCandidate(targetDescription, words, recognition.strategy === 'native-accessibility'
      ? NATIVE_MATCH_THRESHOLD
      : OCR_MATCH_THRESHOLD);

    if (wordMatch) {
      const chosen = wordMatch.candidate;
      const result = await performClick(
        chosen.centerX,
        chosen.centerY,
        `OCR/native word match: "${chosen.text}" (target: "${targetDescription}")`
      );
      return {
        ...result,
        clickedText: chosen.text,
        method: `${recognition.provider}:word-match`,
        provider: recognition.provider,
        score: wordMatch.score,
      };
    }

    if (!aiEngine) {
      return {
        success: false,
        error: `Text "${targetDescription}" not found on screen`,
        provider: recognition.provider,
      };
    }

    const aiCandidates = [...lines, ...words]
      .map((entry) => ({ entry, score: scoreCandidate(targetDescription, entry) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);

    const candidateList = aiCandidates
      .map(({ entry, score }, index) => `[${index}] "${entry.text}" at (${entry.centerX}, ${entry.centerY}) score=${score.toFixed(3)}`)
      .join('\n');

    try {
      const response = await aiEngine.chat({
        model: 'llama-3.1-8b-instant',
        systemPrompt: 'You resolve UI click targets from OCR/native accessibility data. Respond with ONLY a JSON object: {"index": N, "text": "matched text"} or {"index": -1}.',
        message: `Target: "${targetDescription}"\nProvider: ${recognition.provider}\nCandidates:\n${candidateList}`,
      });

      const cleaned = String(response || '')
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      let result;
      try {
        result = JSON.parse(cleaned);
      } catch (parseErr) {
        const jsonMatch = cleaned.match(/\{[\s\S]*"index"\s*:\s*(-?\d+)[\s\S]*\}/);
        if (!jsonMatch) {
          return { success: false, error: `AI response parsing failed: ${parseErr.message}`, provider: recognition.provider };
        }

        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (secondParseErr) {
          return { success: false, error: `AI response parsing failed: ${secondParseErr.message}`, provider: recognition.provider };
        }
      }

      if (result.index < 0 || result.index >= aiCandidates.length) {
        return { success: false, error: `AI could not find "${targetDescription}" on screen`, provider: recognition.provider };
      }

      const target = aiCandidates[result.index].entry;
      const clickResult = await performClick(
        target.centerX,
        target.centerY,
        `OCR/native AI click: "${target.text}" (target: "${targetDescription}")`
      );

      return {
        ...clickResult,
        clickedText: target.text,
        method: `${recognition.provider}:ai-resolved`,
        provider: recognition.provider,
      };
    } catch (e) {
      return { success: false, error: `AI resolution failed: ${e.message}`, provider: recognition.provider };
    }
  }

  async getScreenText(displayId) {
    const recognition = await this.captureAndOcr(displayId, { preferNative: true });
    return dedupeEntries(recognition.lines || recognition.words || [])
      .map((entry) => entry.text)
      .join('\n');
  }

  async getScreenTextWithBoxes(displayId) {
    const recognition = await this.captureAndOcr(displayId, { preferNative: true });
    return recognition.lines || recognition.words || [];
  }

  directClick(x, y, reason = 'OCR direct click') {
    if (!robotjs) {
      return { success: false, error: 'robotjs not available' };
    }

    try {
      robotjs.moveMouse(Math.round(x), Math.round(y));
      robotjs.mouseClick();
      console.log(`[TesseractService] Direct click at (${x}, ${y}) - ${reason}`);
      return { success: true, x, y, reason };
    } catch (e) {
      console.error('[TesseractService] Direct click failed:', e.message);
      return { success: false, error: e.message };
    }
  }
}

module.exports = { TesseractOcrService };
