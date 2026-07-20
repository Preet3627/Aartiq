const fetch = require('cross-fetch');
const { JSDOM } = require('jsdom');

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const JUNK_SELECTORS = [
  'script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe',
  'form', '.sidebar', '.menu', '.footer', '.header', '.nav', '.ad', '.advertisement',
  '.cookie', '.popup', '.modal', '.overlay', '.banner', '.newsletter', '.subscribe',
  '.social-share', '.share-buttons', '.related-posts', '.related-articles',
  '.trending', '.popular', '.most-read', '.sponsored', '.promoted',
  '.pagination', '.page-numbers', '.skip-link', '.cookie-banner', '.cookie-notice',
  '.gdpr', '.consent', '.paywall', '.subscription',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]', '[role="complementary"]', '[role="search"]',
  // Reuters-style flat nav containers
  '[data-testid*="nav"]', '[data-testid*="footer"]', '[data-testid*="menu"]',
  '[data-testid*="header"]', '[class*="site-index"]', '[class*="SiteIndex"]',
  '[class*="footer"]', '[class*="Footer"]', '[class*="nav-"]', '[class*="Nav"]',
];

const CONTENT_SELECTORS = 'main, article, [role="main"], #content, #main, .content, .post, .entry, .article';

let _readabilityAvailable = false;
try {
  require('@mozilla/readability');
  _readabilityAvailable = true;
} catch (_) {}

function stripJunkFromDom(doc) {
  // Phase 1: Remove elements matching known junk selectors (tags, classes, roles)
  for (const sel of JUNK_SELECTORS) {
    try {
      for (const el of doc.querySelectorAll(sel)) el.remove();
    } catch (_) {}
  }

  // Phase 2: Remove high link-density blocks — containers where >70% of text
  // is inside <a> tags. These are almost always navigation menus, site indexes,
  // or footer link blocks — regardless of tag name or class. This catches
  // sites like Reuters that use flat <div> structures without semantic tags.
  const contentSelectors = CONTENT_SELECTORS.split(',').map(s => s.trim());
  const JUNK_DENSITY_THRESHOLD = 0.7;
  const MIN_LINKS_FOR_DENSITY = 3;

  try {
    const containers = doc.querySelectorAll('div, section, aside');
    for (const container of containers) {
      // Skip elements that are content containers (main, article, [role="main"], etc.)
      if (contentSelectors.some(sel => { try { return container.matches(sel); } catch (_) { return false; } })) continue;

      const links = container.querySelectorAll('a');
      if (links.length < MIN_LINKS_FOR_DENSITY) continue;

      const totalText = (container.textContent || '').trim().length;
      if (totalText < 50) continue;

      const linkTextLen = Array.from(links).reduce((sum, a) => sum + (a.textContent || '').length, 0);
      const density = linkTextLen / totalText;

      if (density > JUNK_DENSITY_THRESHOLD) {
        container.remove();
      }
    }
  } catch (_) {}
}

function extractText(doc) {
  const main = doc.querySelector(CONTENT_SELECTORS);
  const text = main ? main.textContent : (doc.body ? doc.body.textContent : '');
  return (text || '').replace(/\s+/g, ' ').trim();
}

function extractFromHtml(html, url, options = {}) {
  const { maxChars = 8000, useReadability = true } = options;

  if (useReadability && _readabilityAvailable) {
    try {
      const { Readability } = require('@mozilla/readability');
      const dom = new JSDOM(html, { url: url || 'about:blank' });
      const reader = new Readability(dom.window.document, {
        charThreshold: 100,
        keepClasses: false,
      });
      const article = reader.parse();
      if (article && article.textContent) {
        return article.textContent.replace(/\s+/g, ' ').trim().substring(0, maxChars);
      }
    } catch (_) {}
  }

  const dom = new JSDOM(html, { url: url || 'about:blank' });
  stripJunkFromDom(dom.window.document);
  return extractText(dom.window.document).substring(0, maxChars);
}

async function fetchPageContent(url, options = {}) {
  const { maxChars = 8000, timeout = 10000, useReadability = true, userAgent } = options;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent || DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout,
    });
    if (!res.ok) return '';
    const html = await res.text();
    return extractFromHtml(html, url, { maxChars, useReadability });
  } catch (e) {
    console.warn(`[WebExtractor] fetchPageContent failed for ${url}: ${e.message}`);
    return '';
  }
}

function extractArticleFromHtml(html, url, options = {}) {
  const { maxChars = 8000 } = options;

  if (_readabilityAvailable) {
    try {
      const { Readability } = require('@mozilla/readability');
      const dom = new JSDOM(html, { url: url || 'about:blank' });
      const reader = new Readability(dom.window.document, {
        charThreshold: 100,
        keepClasses: false,
      });
      const article = reader.parse();
      if (article && article.textContent) {
        return {
          title: article.title || '',
          byline: article.byline || '',
          content: article.textContent.replace(/\s+/g, ' ').trim().substring(0, maxChars),
          html: article.content || '',
          length: article.textContent.length,
          excerpt: article.excerpt || '',
          siteName: article.siteName || '',
          publishedTime: article.publishedTime || '',
        };
      }
    } catch (_) {}
  }

  const dom = new JSDOM(html, { url: url || 'about:blank' });
  stripJunkFromDom(dom.window.document);
  const text = extractText(dom.window.document).substring(0, maxChars);
  return {
    title: dom.window.document.title || '',
    byline: '',
    content: text,
    html: '',
    length: text.length,
    excerpt: text.substring(0, 300),
    siteName: '',
    publishedTime: '',
  };
}

module.exports = { fetchPageContent, extractFromHtml, extractArticleFromHtml, stripJunkFromDom, extractText, DEFAULT_UA, JUNK_SELECTORS, CONTENT_SELECTORS };
