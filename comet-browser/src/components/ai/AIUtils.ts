import {
  THREAT_STORAGE_KEY,
  DANGEROUS_PATTERNS,
  AI_GENERATED_PATTERNS,
  PII_PATTERNS,
  NOT_FOUND_SIGNALS,
  INTERNAL_TAG_RE
} from './AIConstants';
import { cleanTagsFromText, robustJSONParse } from './RobustParsers';

export interface ThreatRecord {
  strikes?: number;
  bannedUntil?: number;
  permanentBan?: boolean;
}

export function getThreatRecord(): ThreatRecord {
  try { return JSON.parse(localStorage.getItem(THREAT_STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function setThreatRecord(r: ThreatRecord): void {
  try { localStorage.setItem(THREAT_STORAGE_KEY, JSON.stringify(r)); } catch { }
}

export function resetThreatStrikes(): void {
  const r = getThreatRecord();
  r.strikes = 0;
  setThreatRecord(r);
}

export interface ThreatCheckResult {
  blocked: boolean;
  response?: string;
  ban?: boolean;
}

export function checkThreat(content: string): ThreatCheckResult {
  const record = getThreatRecord();

  if (record.permanentBan) {
    return { blocked: true, response: '🚫 **Comet-AI is made for Humans Not Hackers [Permanently Banned From Comet]**', ban: true };
  }

  if (record.bannedUntil && Date.now() < record.bannedUntil) {
    const hoursLeft = Math.ceil((record.bannedUntil - Date.now()) / 3600000);
    return { blocked: true, response: `⏳ **You are temporarily blocked from using Comet AI.** Please try again in ~${hoursLeft} hour(s).`, ban: true };
  }

  const isAiGenerated = AI_GENERATED_PATTERNS.some((p) => p.test(content));
  if (isAiGenerated) {
    return { blocked: true, response: '🤖 **Comet-AI is made for Humans — Not for AI Generated prompts.** Please type your own message.' };
  }

  const isDangerous = DANGEROUS_PATTERNS.some((p) => p.test(content));
  if (!isDangerous) return { blocked: false };

  const strikes = (record.strikes || 0) + 1;

  if (strikes >= 5) {
    const bannedUntil = Date.now() + 24 * 60 * 60 * 1000;
    setThreatRecord({ strikes, bannedUntil, permanentBan: true });
    return {
      blocked: true,
      ban: true,
      response: '🚫 **Comet-AI is made for Humans Not Hackers [Permanently Banned From Comet-AI]**\n\nYour access has been suspended due to repeated policy violations.',
    };
  }

  if (strikes === 4) {
    setThreatRecord({ strikes, bannedUntil: record.bannedUntil });
    return {
      blocked: true,
      response: `⚠️ **Nice try.** This is your **final warning** (${strikes}/5). One more violation and you will be banned for 24 hours.`,
    };
  }

  setThreatRecord({ strikes, bannedUntil: record.bannedUntil });
  return {
    blocked: true,
    response: `🛡️ **Nice try.** Suspicious prompt detected (${strikes}/5 strikes). Comet AI protects user privacy and security.`,
  };
}

export function scrubbedContent(raw: string): string {
  let result = raw;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function isFailedPageContent(content: string): boolean {
  const lower = content.toLowerCase().slice(0, 500);
  return NOT_FOUND_SIGNALS.some((s) => lower.includes(s));
}

export function extractSiteFromContext(content: string, url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    const match = content.match(/\b(instagram|facebook|twitter|google|github|linkedin|gmail)\b/i);
    return match?.[1]?.toLowerCase();
  }
}

export function applyInlineMarkdown(text: string): string {
  return text
    // Images: ![alt](url) → <img> (must come before link processing)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:12px;margin:20px 0;display:block;box-shadow:0 10px 30px rgba(0,0,0,0.12);"/>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#0ea5e9;text-decoration:underline;">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline math: $...$ or \(...\)
    .replace(/\$([^$\n]+?)\$/g, '<span class="math-inline">$$1$</span>')
    .replace(/\\\(([^)]+?)\\\)/g, '<span class="math-inline">$1</span>');
}

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HALLUCINATION_URL_PATTERN = /https?:\/\/[^\s"<>]+\/\d{4}\/\d{2}\/\d{2}\/[^\s"<>]+/g;
const FAKE_SOURCE_PATTERN = /Source:\s*https?:\/\/[^\s<>]+/gi;

export function detectHallucinatedContent(content: string): boolean {
  const urlMatches = content.match(HALLUCINATION_URL_PATTERN) || [];
  const hasLotsOfFakeUrls = urlMatches.length >= 3;
  const contentIsShort = content.length < 1500;
  return hasLotsOfFakeUrls && contentIsShort;
}

export function sanitizePDFContent(content: string, title: string): string {
  // Use robust parser to clean tags while preserving content structure
  const cleaned = cleanTagsFromText(content);
  const sanitized = cleaned.replace(INTERNAL_TAG_RE, '').trim();
  return sanitized;
}


export interface PDFImage {
  src: string;
  alt?: string;
  width?: string | number;
  height?: string | number;
  caption?: string;
}

export interface PDFStyles {
  background?: string; // CSS color or gradient
  outlineColor?: string;
  accentColor?: string;
}

export function buildBodyFromMarkdown(text: string): string {
  const looksLikeHTML = /<[a-z][\s\S]*?>/i.test(text);
  if (looksLikeHTML) {
    return text
      .replace(/>\s*</g, '>\n<')
      .replace(/<(h[1-6]|p|li|ul|ol|table|tr|thead|tbody|div|br\s*\/?|img)\b/gi, '\n<$1')
      .replace(/<\/(h[1-6]|p|li|ul|ol|table|tr|thead|tbody|div)>/gi, '</$1>\n');
  }

  const processedText = text
    .replace(/\*\*\[[^\n\]]*$/gm, '')
    .replace(INTERNAL_TAG_RE, '')
    .replace(/\*\*\s*$/gm, '');

  const lines = processedText.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let listType = 'ul';
  let inCodeFence = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushList = () => { if (inList) { htmlLines.push(`</${listType}>`); inList = false; } };
  const flushTable = () => {
    if (!inTable || tableBuffer.length === 0) { inTable = false; tableBuffer = []; return; }
    inTable = false;
    const allRows = tableBuffer;
    const dataRows = allRows.filter(r => !/^\s*\|?[-:|\s]+\|?\s*$/.test(r));
    if (dataRows.length === 0) { tableBuffer = []; return; }
    let tableHtml = '<div class="table-wrapper"><table>';
    dataRows.forEach((row, i) => {
      const parts = row.replace(/^\||\|$/g, '').split('|').map(c => applyInlineMarkdown(c.trim()));
      if (i === 0) {
        tableHtml += `<thead><tr>${parts.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
      } else {
        tableHtml += `<tr>${parts.map(c => `<td>${c}</td>`).join('')}</tr>`;
      }
    });
    tableHtml += '</tbody></table></div>';
    htmlLines.push(tableHtml);
    tableBuffer = [];
  };

  for (const rawLine of lines) {
    if (/^```/.test(rawLine.trim())) {
      if (!inCodeFence) {
        flushList(); flushTable();
        inCodeFence = true;
        codeLang = rawLine.trim().replace(/^```/, '').trim();
        codeBuffer = [];
      } else {
        inCodeFence = false;
        const escaped = codeBuffer.join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        htmlLines.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${escaped}</code></pre>`);
        codeBuffer = [];
      }
      continue;
    }
    if (inCodeFence) { codeBuffer.push(rawLine); continue; }

    if (/^\s*\|/.test(rawLine)) {
      flushList();
      inTable = true;
      tableBuffer.push(rawLine.trim());
      continue;
    } else if (inTable) { flushTable(); }

    let line = rawLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    if (/^#{1}\s/.test(line))  { flushList(); htmlLines.push(`<h1>${applyInlineMarkdown(line.replace(/^#+\s/, ''))}</h1>`); continue; }
    if (/^#{2}\s/.test(line))  { flushList(); htmlLines.push(`<h2>${applyInlineMarkdown(line.replace(/^#+\s/, ''))}</h2>`); continue; }
    if (/^#{3,}\s/.test(line)) { flushList(); htmlLines.push(`<h3>${applyInlineMarkdown(line.replace(/^#+\s/, ''))}</h3>`); continue; }
    if (/^[-*]{3,}$/.test(line.trim())) { flushList(); htmlLines.push('<hr/>'); continue; }
    
    if (/^&gt;\s/.test(line.trim())) {
      flushList();
      htmlLines.push(`<blockquote>${applyInlineMarkdown(line.trim().replace(/^&gt;\s/, ''))}</blockquote>`);
      continue;
    }
    
    if (/^[-*•]\s/.test(line.trim())) {
      if (!inList || listType !== 'ul') { if (inList) htmlLines.push(`</${listType}>`); htmlLines.push('<ul>'); inList = true; listType = 'ul'; }
      htmlLines.push(`<li>${applyInlineMarkdown(line.trim().replace(/^[-*•]\s/, ''))}</li>`);
      continue;
    }
    if (/^\d+\.\s/.test(line.trim())) {
      if (!inList || listType !== 'ol') { if (inList) htmlLines.push(`</${listType}>`); htmlLines.push('<ol>'); inList = true; listType = 'ol'; }
      htmlLines.push(`<li>${applyInlineMarkdown(line.trim().replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }
    
    if (line.trim() === '') { flushList(); htmlLines.push('<br/><br/>'); continue; }
    
    let processedLine = applyInlineMarkdown(line);
    
    if (/^\$\$.+\$\$$/.test(processedLine.trim())) {
      flushList();
      const mathContent = processedLine.trim().slice(2, -2);
      htmlLines.push(`<div class="katex-display math-block"><span class="math-inline">${mathContent}</span></div>`);
      continue;
    }
    if (/^\\\[.+\\\]$/.test(processedLine.trim())) {
      flushList();
      const mathContent = processedLine.trim().slice(2, -2);
      htmlLines.push(`<div class="katex-display math-block"><span class="math-inline">${mathContent}</span></div>`);
      continue;
    }
    
    flushList();
    htmlLines.push(`<p>${processedLine}</p>`);
  }
  flushList(); flushTable();
  if (inCodeFence && codeBuffer.length > 0) {
    const escaped = codeBuffer.join('\n').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    htmlLines.push(`<pre><code>${escaped}</code></pre>`);
  }
  return htmlLines.join('\n');
}

export function buildCleanPDFContent(
  rawContent: string, 
  title: string, 
  iconBase64: string | null,
  images?: PDFImage[],
  styles?: PDFStyles
): string {
  let text = sanitizePDFContent(rawContent, title);
  text = text.replace(/\$\(READ_PAGE_CONTENT\)/g, '[Page Content Summary Included Below]');
  
  // Slide logic integration (Presenton style)
  const slides = text.split(/---\n?/).filter(s => s.trim().length > 10);
  const isSlideShow = slides.length > 2;

  const bg = styles?.background || '#ffffff';
  const outline = styles?.outlineColor || '#f1f5f9';
  const accent = styles?.accentColor || '#0ea5e9';

  const bodyHTML = buildBodyFromMarkdown(text);

  let imagesHTML = '';
  if (images && images.length > 0) {
    imagesHTML = '<div class="pdf-images">';
    for (const img of images) {
      const safeSrc = img.src && img.src.startsWith('data:') ? img.src : (img.src || '');
      if (!safeSrc) continue;
      imagesHTML += `
        <figure>
          <img src="${safeSrc}" alt="${escapeHtml(img.alt || 'Image')}" />
          ${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
    }
    imagesHTML += '</div>';
  }

  const headerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet Logo" style="width:32px;height:32px;object-fit:contain;"/>`
    : '🌠';

  const footerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet AI" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:6px;"/>`
    : '🌠';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #1e293b;
      background: ${bg};
      padding: 0;
      line-height: 1.7;
      min-height: 100vh;
    }
    .page-break { page-break-before: always; height: 0; margin-top: 40px; border-top: 1px solid ${outline}; }
    .slide {
      min-height: 80vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      border: 2px solid ${outline};
      border-radius: 40px;
      margin-bottom: 60px;
      background: white;
      box-shadow: 0 40px 100px rgba(0,0,0,0.05);
      position: relative;
      overflow: hidden;
      break-after: always;
      page-break-after: always;
    }
    .slide-number {
      position: absolute; top: 30px; right: 40px; font-size: 0.75rem; 
      font-weight: 800; color: ${accent}; text-transform: uppercase;
      letter-spacing: 0.1em; opacity: 0.5;
    }
    .slide-content { position: relative; z-index: 10; }
    .slide-decoration {
      position: absolute; bottom: -50px; left: -50px; width: 200px; height: 200px;
      background: radial-gradient(circle, ${accent}10 0%, transparent 70%);
      border-radius: 50%; z-index: 1;
    }
    .page-container {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 60px 100px;
      border: 1px solid ${outline};
      background: #ffffff;
      min-height: calc(100vh - 40px);
      overflow: visible;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .brand {
      display: flex;
      align-items: center; gap: 12px;
      font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.25rem; color: #0f172a;
    }
    .brand span { color: ${accent}; }
    h1 { 
      font-family: 'Outfit', sans-serif; font-size: 2.25rem; font-weight: 700; 
      margin-bottom: 12px; color: #0f172a; line-height: 1.2;
    }
    h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600; margin: 32px 0 12px; color: #1e293b; }
    h3 { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 600; margin: 24px 0 10px; color: ${accent}; }
    
    /* --- Table Fixes for Page Breaks --- */
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 24px 0; 
      border: 1px solid #e2e8f0; 
      table-layout: auto; 
      word-wrap: break-word; 
      break-inside: avoid;
      page-break-inside: avoid; 
    }
    thead { display: table-header-group; break-after: avoid; }
    tbody { display: table-row-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { 
      background: #f8fafc; color: #475569; padding: 12px 16px; 
      text-align: left; font-size: 0.85rem; font-weight: 600; 
      text-transform: uppercase; border-bottom: 2px solid #e2e8f0; 
      break-after: avoid; 
    }
    td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; word-break: break-word; }
    
    .table-wrapper { overflow-x: visible; margin: 24px 0; max-width: 100%; break-inside: avoid; display: block; }
    code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 2px; color: ${accent}; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; overflow-x: auto; margin: 24px 0; white-space: pre-wrap; word-break: break-all; break-inside: avoid; }
    blockquote { border-left: 4px solid ${accent}; padding: 12px 24px; background: #f0f9ff; color: #1e40af; margin: 24px 0; break-inside: avoid; }
    .footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 15px 60px; background: #ffffff; border-top: 1px solid #f1f5f9;
      font-size: 0.75rem; color: #94a3b8;
    }
    .footer-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; color: ${accent}; }
    .pdf-images { margin: 32px 0; clear: both; }
    .pdf-images figure { margin: 24px 0; text-align: center; break-inside: avoid; page-break-inside: avoid; clear: both; display: block; }
    .pdf-images img { max-width: 100%; width: auto; height: auto; max-height: 600px; border: 1px solid #e2e8f0; display: block; margin: 0 auto; }
    .pdf-images figcaption { font-size: 0.85rem; color: #64748b; margin-top: 12px; font-style: italic; text-align: center; }
  </style>
</head>
<body>
  <div class="page-container">
    <header>
      <div class="brand">${headerLogoHTML} Comet<span>AI</span></div>
      <div style="font-size: 0.75rem; font-weight: 600; color: #16a34a; background: #f0fdf4; padding: 4px 12px; border-radius: 999px;">✨ Real-time Verified</div>
    </header>
    ${(() => {
      // Auto-generate TOC from bodyHTML
      const h2Matches = bodyHTML.matchAll(/<h2[^>]*>(.*?)<\/h2>/g);
      const tocItems = Array.from(h2Matches);
      if (tocItems.length > 2) {
        return `
          <div class="toc-container" style="margin-bottom: 40px; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; break-inside: avoid;">
            <h2 style="margin-top: 0; font-size: 1.2rem; margin-bottom: 16px;">📑 Table of Contents</h2>
            <ul style="list-style: none; padding: 0;">
              ${tocItems.map((match, i) => {
                const text = match[1].replace(/<[^>]*>?/gm, '');
                const id = `toc-${i}`;
                return `<li style="margin-bottom: 8px;"><a href="#${id}" style="color: ${accent}; text-decoration: none; display: flex; justify-content: space-between;"><span>${text}</span> <span style="border-bottom: 1px dotted #cbd5e1; flex-grow: 1; margin: 0 8px; margin-bottom: 4px;"></span></a></li>`;
              }).join('')}
            </ul>
          </div>
        `;
      }
      return '';
    })()}
    ${isSlideShow 
      ? slides.map((s: string, i: number) => `
        <div class="slide ${i > 0 ? 'page-break' : ''}">
          <div class="slide-number">Step ${i + 1} of ${slides.length}</div>
          <div class="slide-content">${buildBodyFromMarkdown(s)}</div>
          <div class="slide-decoration"></div>
        </div>`).join('\n')
      : `<h1>${escapeHtml(title)}</h1>${(() => {
          // Re-inject IDs into bodyHTML for TOC links
          let indexedBody = bodyHTML;
          let i = 0;
          indexedBody = indexedBody.replace(/<h2/g, () => `<h2 id="toc-${i++}"`);
          return indexedBody;
        })()}`
    }
    ${imagesHTML}
  </div>
  <div class="footer">
    <div class="footer-brand">${footerLogoHTML} Comet AI</div>
    <span>${escapeHtml(title)} • ${new Date().getFullYear()}</span>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize mermaid
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        document.querySelectorAll('.mermaid').forEach(function(el) {
          mermaid.run({ nodes: [el] }).catch(function(e) { console.error('Mermaid error:', e); });
        });
      }
      // Initialize KaTeX
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false,
          trust: true
        });
      }
      document.querySelectorAll('.math-block').forEach(function(el) {
        const text = el.textContent || '';
        if (typeof katex !== 'undefined') {
          try { katex.render(text, el, { throwOnError: false, displayMode: true }); } catch(e) {}
        }
      });
    });
  </script>
</body>
</html>`;
}

export interface PDFActionLog {
  index: number;
  type: string;
  success: boolean;
  output: string;
}

export interface PDFOCRData {
  type: string;
  label: string;
  textLength: number;
  content: string;
}

export interface PDFMediaAttachment {
  type: string;
  url?: string;
  caption?: string;
  videoUrl?: string;
  title?: string;
  description?: string;
}

export interface PDFContentData {
  title: string;
  content: string;
  author?: string;
  subtitle?: string;
  actionLogs?: PDFActionLog[];
  ocrData?: PDFOCRData[];
  mediaAttachments?: PDFMediaAttachment[];
}

export type PDFDetailLevel = 'brief' | 'standard' | 'detailed';

export interface PDFPage {
  title: string;
  content: string;
  icon?: string;
  detailLevel: PDFDetailLevel;
  sections?: PDFSection[];
}

export interface PDFSection {
  title: string;
  content: string;
  icon?: string;
  detailLevel?: PDFDetailLevel;
}

export type PDFImageActionType = 'screenshot' | 'url' | 'base64';

export interface PDFImageAction {
  type: PDFImageActionType;
  src?: string;
  alt?: string;
  caption?: string;
  width?: string | number;
  height?: string | number;
  page?: number;
}

export interface EnhancedPDFData {
  title: string;
  subtitle?: string;
  author?: string;
  pages: PDFPage[];
  includeActionLogs?: boolean;
  includeOCRData?: boolean;
  theme?: 'default' | 'dark' | 'minimal';
  images?: PDFImageAction[];
}

export const PDF_ICONS: Record<string, string> = {
  document: '📄', summary: '📋', analysis: '🔍', data: '💾', chart: '📊',
  image: '🖼️', link: '🔗', warning: '⚠️', success: '✅', error: '❌',
  info: 'ℹ️', star: '⭐', fire: '🔥', rocket: '🚀', brain: '🧠',
  eye: '👁️', search: '🔎', gear: '⚙️', lightbulb: '💡', target: '🎯',
  trophy: '🏆', medal: '🏅', shield: '🛡️', lock: '🔒', key: '🔑',
  phone: '📱', laptop: '💻', cloud: '☁️', database: '🗄️', server: '🖥️',
  user: '👤', users: '👥', calendar: '📅', clock: '🕐', mail: '📧',
  flag: '🚩', pin: '📌', bookmark: '🔖', starFilled: '⭐', heart: '❤️',
  thumbsUp: '👍', thumbsDown: '👎', fireEmoji: '🔥', sparkles: '✨',
  zapper: '⚡', wave: '👋', check: '✓', cross: '✗', arrowRight: '→',
  arrowDown: '↓', up: '↑', download: '📥', upload: '📤', folder: '📁',
  file: '📄', video: '🎬', audio: '🎵', code: '💻', terminal: '⬛',
  bug: '🐛', test: '🧪', factory: '🏭', robot: '🤖', alien: '👽',
  crown: '👑', gem: '💎', pearl: '🔮', sun: '☀️', moon: '🌙',
  cloudEmoji: '🌤️', rain: '🌧️', snow: '❄️', tree: '🌲', flower: '🌸',
};

export function getIcon(iconName: string): string {
  return PDF_ICONS[iconName.toLowerCase()] || PDF_ICONS.document;
}

export function getDetailLevelStyles(level: PDFDetailLevel): { fontSize: string; padding: string; maxContentLength: number } {
  switch (level) {
    case 'brief':
      return { fontSize: '0.85rem', padding: '12px', maxContentLength: 500 };
    case 'detailed':
      return { fontSize: '1rem', padding: '20px', maxContentLength: 10000 };
    default:
      return { fontSize: '0.9rem', padding: '16px', maxContentLength: 3000 };
  }
}

export function buildPDFFromJSON(
  data: PDFContentData,
  iconBase64: string | null,
  images?: PDFImage[]
): string {
  const accent = '#0ea5e9';
  const outline = '#f1f5f9';
  
  let htmlContent = `<h1>${escapeHtml(data.title)}</h1>`;
  
  if (data.subtitle) {
    htmlContent += `<p style="font-size: 1.1rem; color: #64748b; margin-bottom: 8px;">${escapeHtml(data.subtitle)}</p>`;
  }
  
  if (data.author) {
    htmlContent += `<p style="font-size: 0.9rem; color: #475569; margin-bottom: 24px;"><strong>Author:</strong> ${escapeHtml(data.author)}</p>`;
  }
  
  const bodyContent = buildBodyFromMarkdown(data.content);
  htmlContent += bodyContent;
  
  if (data.ocrData && data.ocrData.length > 0) {
    htmlContent += `<div style="margin-top: 32px; padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b;">
      <h3 style="color: #92400e; margin-bottom: 12px;">📄 Extracted Data (${data.ocrData.length} sources)</h3>`;
    for (const ocr of data.ocrData) {
      htmlContent += `<div style="margin-bottom: 16px;">
        <p style="font-weight: 600; color: #b45309;">${escapeHtml(ocr.label)} (${ocr.textLength} chars)</p>
        <pre style="background: #fff; padding: 12px; border-radius: 4px; font-size: 0.85rem; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(ocr.content.substring(0, 1000))}${ocr.content.length > 1000 ? '...' : ''}</pre>
      </div>`;
    }
    htmlContent += `</div>`;
  }
  
  if (data.actionLogs && data.actionLogs.length > 0) {
    htmlContent += `<div style="margin-top: 32px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0;">
      <h3 style="color: #0f172a; margin-bottom: 12px;">🔄 Action Chain (${data.actionLogs.length} actions)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead><tr style="background: #f1f5f9;">
          <th style="padding: 8px; text-align: left;">#</th>
          <th style="padding: 8px; text-align: left;">Action</th>
          <th style="padding: 8px; text-align: left;">Status</th>
          <th style="padding: 8px; text-align: left;">Output</th>
        </tr></thead><tbody>`;
    for (const log of data.actionLogs) {
      const statusIcon = log.success ? '✅' : '❌';
      const outputPreview = log.output.length > 80 ? log.output.substring(0, 80) + '...' : log.output;
      htmlContent += `<tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px;">${log.index}</td>
        <td style="padding: 8px; font-weight: 600;">${escapeHtml(log.type)}</td>
        <td style="padding: 8px;">${statusIcon}</td>
        <td style="padding: 8px; color: #64748b;">${escapeHtml(outputPreview)}</td>
      </tr>`;
    }
    htmlContent += `</tbody></table></div>`;
  }
  
  let imagesHTML = '';
  if (images && images.length > 0) {
    imagesHTML = '<div class="pdf-images">';
    for (const img of images) {
      const safeSrc = img.src && img.src.startsWith('data:') ? img.src : (img.src || '');
      if (!safeSrc) continue;
      imagesHTML += `
        <figure>
          <img src="${safeSrc}" alt="${escapeHtml(img.alt || 'Image')}" />
          ${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
    }
    imagesHTML += '</div>';
  }

  const headerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet Logo" style="width:32px;height:32px;object-fit:contain;"/>`
    : '🌠';

  const footerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet AI" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:6px;"/>`
    : '🌠';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #1e293b;
      background: #ffffff;
      padding: 0;
      line-height: 1.7;
      min-height: 100vh;
    }
    .page-break { page-break-before: always; height: 0; margin-top: 40px; }
    .page-container {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 60px 100px;
      border: 1px solid ${outline};
      background: #ffffff;
      min-height: calc(100vh - 40px);
      overflow: visible;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .brand {
      display: flex;
      align-items: center; gap: 12px;
      font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.25rem; color: #0f172a;
    }
    .brand span { color: ${accent}; }
    h1 { 
      font-family: 'Outfit', sans-serif; font-size: 2.25rem; font-weight: 700; 
      margin-bottom: 12px; color: #0f172a; line-height: 1.2;
    }
    h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600; margin: 32px 0 12px; color: #1e293b; }
    h3 { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 600; margin: 24px 0 10px; color: ${accent}; }
    table { border-collapse: collapse; width: 100%; margin: 24px 0; border: 1px solid #e2e8f0; page-break-inside: avoid; }
    thead { page-break-after: avoid; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: #f8fafc; color: #475569; padding: 12px 16px; text-align: left; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; page-break-after: avoid; }
    td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    pre { background: #0f172a; color: #f8fafc; padding: 16px; overflow-x: auto; margin: 24px 0; white-space: pre-wrap; word-break: break-all; }
    .footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 15px 60px; background: #ffffff; border-top: 1px solid #f1f5f9;
      font-size: 0.75rem; color: #94a3b8;
    }
    .footer-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; color: ${accent}; }
    .pdf-images { margin: 32px 0; clear: both; }
    .pdf-images figure { margin: 24px 0; text-align: center; page-break-inside: avoid; clear: both; display: block; }
    .pdf-images img { max-width: 100%; width: auto; height: auto; max-height: 600px; display: block; margin: 0 auto; }
    .pdf-images figcaption { font-size: 0.85rem; color: #64748b; margin-top: 12px; font-style: italic; text-align: center; }
    .katex-display { margin: 16px 0; overflow-x: auto; }
    .katex { font-size: 1.1em; }
    .math-block { background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${accent}; }
  </style>
</head>
<body>
  <div class="page-container">
    <header>
      <div class="brand">${headerLogoHTML} Comet<span>AI</span></div>
      <div style="font-size: 0.75rem; font-weight: 600; color: #16a34a; background: #f0fdf4; padding: 4px 12px;">✓ Verified</div>
    </header>
    <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 24px;">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • By Comet AI</div>
    ${htmlContent}
    ${imagesHTML}
  </div>
  <div class="footer">
    <div class="footer-brand">${footerLogoHTML} Comet AI</div>
    <span>${escapeHtml(data.title)} • ${new Date().getFullYear()}</span>
  </div>
</body>
</html>`;
}

export function buildEnhancedPDFFromJSON(
  data: EnhancedPDFData,
  iconBase64: string | null,
  images?: PDFImage[],
  actionLogs?: PDFActionLog[],
  ocrData?: PDFOCRData[]
): string {
  const accent = data.theme === 'dark' ? '#22d3ee' : '#0ea5e9';
  const outline = data.theme === 'dark' ? '#334155' : '#f1f5f9';
  const bgColor = data.theme === 'dark' ? '#0f172a' : '#ffffff';
  const textColor = data.theme === 'dark' ? '#f1f5f9' : '#1e293b';
  const mutedColor = data.theme === 'dark' ? '#94a3b8' : '#64748b';
  
  const headerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet Logo" style="width:32px;height:32px;object-fit:contain;"/>`
    : '🌠';
  const footerLogoHTML = iconBase64
    ? `<img src="${iconBase64}" alt="Comet AI" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:6px;"/>`
    : '🌠';

  let pagesHTML = '';
  
  for (let i = 0; i < data.pages.length; i++) {
    const page = data.pages[i];
    const pageStyles = getDetailLevelStyles(page.detailLevel);
    const pageIcon = page.icon ? getIcon(page.icon) : '';
    
    let sectionsHTML = '';
    
    if (page.sections && page.sections.length > 0) {
      for (const section of page.sections) {
        const sectionIcon = section.icon ? getIcon(section.icon) : '📋';
        const sectionStyles = section.detailLevel ? getDetailLevelStyles(section.detailLevel) : pageStyles;
        const sectionContent = section.content.length > sectionStyles.maxContentLength 
          ? section.content.substring(0, sectionStyles.maxContentLength) + '...'
          : section.content;
        
        sectionsHTML += `
          <div style="margin-bottom: 24px; padding: ${sectionStyles.padding};">
            <h3 style="color: ${accent}; margin-bottom: 8px; font-size: 1.1rem;">
              ${sectionIcon} ${escapeHtml(section.title)}
            </h3>
            <div style="font-size: ${sectionStyles.fontSize}; line-height: 1.6;">${buildBodyFromMarkdown(sectionContent)}</div>
          </div>
        `;
      }
    } else {
      const content = page.content.length > pageStyles.maxContentLength
        ? page.content.substring(0, pageStyles.maxContentLength) + '...'
        : page.content;
      sectionsHTML = `<div style="font-size: ${pageStyles.fontSize}; padding: ${pageStyles.padding};">${buildBodyFromMarkdown(content)}</div>`;
    }
    
    const isLastPage = i === data.pages.length - 1;
    
    pagesHTML += `
      <div class="page-section" data-page="${i + 1}">
        <div style="margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid ${outline};">
          <h2 style="font-family: 'Outfit', sans-serif; font-size: 1.5rem; color: ${textColor}; margin-bottom: 8px;">
            ${pageIcon} ${escapeHtml(page.title)}
          </h2>
          <span style="font-size: 0.75rem; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 0.5px;">
            ${page.detailLevel === 'brief' ? 'Quick View' : page.detailLevel === 'detailed' ? 'In-Depth Analysis' : 'Standard'} • Page ${i + 1} of ${data.pages.length}
          </span>
        </div>
        ${sectionsHTML}
      </div>
      ${!isLastPage ? '<div class="page-break"></div>' : ''}
    `;
  }

  let imagesHTML = '';
  if (images && images.length > 0) {
    imagesHTML = '<div class="pdf-images" style="margin-top: 40px;">';
    for (const img of images) {
      const safeSrc = img.src && img.src.startsWith('data:') ? img.src : (img.src || '');
      if (!safeSrc) continue;
      imagesHTML += `
        <figure>
          <img src="${safeSrc}" alt="${escapeHtml(img.alt || 'Image')}" />
          ${img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
    }
    imagesHTML += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Inter:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; }
    body { font-family: 'Inter', system-ui, sans-serif; color: ${textColor}; background: ${bgColor}; padding: 0; line-height: 1.7; min-height: 100vh; }
    .page-break { page-break-before: always; height: 0; margin-top: 40px; }
    .page-container { max-width: 860px; margin: 0 auto; padding: 40px 60px 100px; border: 1px solid ${outline}; background: ${bgColor}; min-height: calc(100vh - 40px); overflow: visible; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid ${outline}; }
    .brand { display: flex; align-items: center; gap: 12px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.25rem; color: ${textColor}; }
    .brand span { color: ${accent}; }
    h1 { font-family: 'Outfit', sans-serif; font-size: 2.25rem; font-weight: 700; margin-bottom: 12px; color: ${textColor}; line-height: 1.2; }
    h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 600; margin: 32px 0 12px; color: ${textColor}; }
    h3 { font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 600; margin: 24px 0 10px; color: ${accent}; }
    table { border-collapse: collapse; width: 100%; margin: 24px 0; border: 1px solid ${outline}; page-break-inside: avoid; }
    thead { page-break-after: avoid; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th { background: ${data.theme === 'dark' ? '#1e293b' : '#f8fafc'}; color: ${mutedColor}; padding: 12px 16px; text-align: left; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid ${outline}; page-break-after: avoid; }
    td { padding: 10px 16px; border-bottom: 1px solid ${outline}; font-size: 0.9rem; }
    pre { background: ${data.theme === 'dark' ? '#1e293b' : '#0f172a'}; color: #f8fafc; padding: 16px; overflow-x: auto; margin: 24px 0; white-space: pre-wrap; word-break: break-all; }
    blockquote { border-left: 4px solid ${accent}; padding: 12px 24px; background: ${data.theme === 'dark' ? '#1e293b' : '#f0f9ff'}; color: ${textColor}; margin: 24px 0; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; padding: 15px 60px; background: ${bgColor}; border-top: 1px solid ${outline}; font-size: 0.75rem; color: ${mutedColor}; }
    .footer-brand { display: flex; align-items: center; gap: 6px; font-weight: 600; color: ${accent}; }
    .pdf-images { margin: 32px 0; clear: both; }
    .pdf-images figure { margin: 24px 0; text-align: center; page-break-inside: avoid; clear: both; display: block; }
    .pdf-images img { max-width: 100%; width: auto; height: auto; max-height: 600px; display: block; margin: 0 auto; }
    .pdf-images figcaption { font-size: 0.85rem; color: ${mutedColor}; margin-top: 12px; font-style: italic; text-align: center; }
    .toc { background: ${data.theme === 'dark' ? '#1e293b' : '#f8fafc'}; padding: 24px; margin-bottom: 32px; border-radius: 8px; }
    .toc-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${outline}; }
    .toc-item:last-child { border-bottom: none; }
    .toc-page { color: ${accent}; font-weight: 600; }
  </style>
</head>
<body>
  <div class="page-container">
    <header>
      <div class="brand">${headerLogoHTML} Comet<span>AI</span></div>
      <div style="font-size: 0.75rem; font-weight: 600; color: #16a34a; background: #f0fdf4; padding: 4px 12px;">✓ AI Generated</div>
    </header>
    <div style="font-size: 0.85rem; color: ${mutedColor}; margin-bottom: 24px;">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} • By Comet AI</div>
    
    <h1>${escapeHtml(data.title)}</h1>
    ${data.subtitle ? `<p style="font-size: 1.1rem; color: ${mutedColor}; margin-bottom: 8px;">${escapeHtml(data.subtitle)}</p>` : ''}
    ${data.author ? `<p style="font-size: 0.9rem; color: ${mutedColor}; margin-bottom: 24px;"><strong>Author:</strong> ${escapeHtml(data.author)}</p>` : ''}
    
    ${data.pages.length > 1 ? `
    <div class="toc">
      <h3 style="margin-bottom: 16px;">📑 Table of Contents</h3>
      ${data.pages.map((p, i) => `
        <div class="toc-item">
          <span>${p.icon ? getIcon(p.icon) : ''} ${escapeHtml(p.title)}</span>
          <span class="toc-page">Page ${i + 1}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${pagesHTML}
    ${imagesHTML}
  </div>
  <div class="footer">
    <div class="footer-brand">${footerLogoHTML} Comet AI</div>
    <span>${escapeHtml(data.title)} • ${new Date().getFullYear()}</span>
  </div>
</body>
</html>`;
}

export function generateSmartPDF(
  content: string,
  iconBase64: string | null,
  images?: PDFImage[],
  actionLogs?: PDFActionLog[],
  ocrData?: PDFOCRData[]
): string {
  let template = 'professional';
  let title = 'Document';
  let sanitizedContent = content;

  const templateMatch = sanitizedContent.match(/\[TEMPLATE:([^\]]+)\]/i);
  if (templateMatch) {
    template = templateMatch[1].trim().toLowerCase();
    sanitizedContent = sanitizedContent.replace(/\[TEMPLATE:[^\]]+\]/gi, '');
  }

  const jsonMatch = sanitizedContent.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    const robustResult = robustJSONParse(jsonMatch[0]);
    if (robustResult.success) {
      const parsed = robustResult.data;
      if (parsed.template) template = parsed.template.toLowerCase();
      if (parsed.title) title = parsed.title;
      if (parsed.content && typeof parsed.content === 'string' && parsed.content.length > 0) {
        sanitizedContent = parsed.content;
      }
    }
  }

  if (sanitizedContent.length < 20 && title) {
    sanitizedContent = title;
  }

  const templateStyles: Record<string, PDFStyles> = {
    professional: { accentColor: '#0ea5e9', outlineColor: '#cbd5f5', background: '#ffffff' },
    executive: { accentColor: '#8b5cf6', outlineColor: '#e0d7ff', background: '#f8f5ff' },
    minimalist: { accentColor: '#475569', outlineColor: '#e2e8f0', background: '#ffffff' },
    academic: { accentColor: '#0f172a', outlineColor: '#cbd5f5', background: '#f8fafc' },
    dark: { accentColor: '#facc15', outlineColor: '#374151', background: '#030712' },
  };

  const styles = templateStyles[template] || templateStyles.professional;
  return buildCleanPDFContent(sanitizedContent, title, iconBase64, images, styles);
}

export function buildCapabilityReportPDF(
  capabilities: { author: string; version: string; features: string[]; platform: string; },
  screenshotBase64?: string,
  iconBase64?: string | null
): string {
  let screenshotSection = '';
  if (screenshotBase64) {
    screenshotSection = `
      <div style="margin: 40px 0; text-align: center;">
        <h2 style="color: #0f172a;">Visual Intelligence</h2>
        <img src="${screenshotBase64}" style="max-width: 100%; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.18);" />
      </div>
    `;
  }
  const logo = iconBase64 ? `<img src="${iconBase64}" style="width:40px;height:40px;"/>` : '🌠';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&family=Inter:wght@400;600&display=swap');
    body { font-family: 'Inter', sans-serif; background: #f8fafc; padding: 60px; }
    .card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: white; padding: 60px; border-radius: 24px; text-align: center; margin-bottom: 40px; }
    h1 { font-family: 'Outfit', sans-serif; font-size: 3rem; }
    .feature { background: #f1f5f9; padding: 20px; border-radius: 16px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>${logo}</div>
    <h1>Comet AI Browser</h1>
    <p>Version ${capabilities.version}</p>
  </div>
  <div class="card">
    <h2>Capabilities</h2>
    ${capabilities.features.map(f => `<div class="feature"><strong>${f.split(':')[0]}</strong>: ${f.split(':').slice(1).join(':')}</div>`).join('')}
    ${screenshotSection}
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <strong>Author:</strong> ${capabilities.author}
    </div>
  </div>
</body>
</html>`;
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

export function lsSet(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
}

export function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { }
}

export function tryGetIconBase64(): string | null {
  try { return (window as any).__cometIconBase64 ?? null; } catch { return null; }
}

export async function preloadCometIcon(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).__cometIconBase64) return;

  const tryCanvas = (src: string): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32; canvas.height = 32;
          canvas.getContext('2d')?.drawImage(img, 0, 0, 32, 32);
          const data = canvas.toDataURL('image/png');
          (window as any).__cometIconBase64 = data;
          resolve(data);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  if (await tryCanvas('/icon.png')) return;
  if (await tryCanvas('/icon.ico')) return;
}
