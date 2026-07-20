const path = require('path');
const fs = require('fs');

const { extractFromHtml, extractArticleFromHtml, stripJunkFromDom, extractText } = require('../src/lib/web-extractor');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('Regression: extract-page-content pipeline', () => {
  describe('Listing page (TechCrunch-like category page)', () => {
    let html;
    beforeAll(() => {
      html = readFixture('listing-page.html');
    });

    it('Readability alone returns short content for listing pages', () => {
      const result = extractArticleFromHtml(html, 'https://techcrunch.com/category/artificial-intelligence/', { maxChars: 50000 });
      expect(result.length).toBeLessThan(1000);
    });

    it('JSDOM fallback with stripJunkFromDom produces substantial content', () => {
      // Simulates the extract-page-content fallback path:
      // Readability returned too little -> parse with JSDOM + strip junk -> extract text
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html, { url: 'https://techcrunch.com/category/artificial-intelligence/' });
      stripJunkFromDom(dom.window.document);
      const text = extractText(dom.window.document);

      // Must have substantial content
      expect(text.length).toBeGreaterThan(1000);

      // Must NOT contain nav/menu items (these are in junk selectors that get stripped)
      expect(text).not.toMatch(/^Home\s/);
      expect(text).not.toMatch(/Startups\s+Venture\s+Apple/);

      // Must contain article titles
      expect(text).toContain('OpenAI Announces GPT-5');
      expect(text).toContain('Anthropic Ships Claude 5.1');
      expect(text).toContain('Google DeepMind Unveils');
    });

    it('stripped junk selectors match web-extractor JUNK_SELECTORS', () => {
      // Verify the nav/footer/header elements are targeted by JUNK_SELECTORS
      const { JUNK_SELECTORS } = require('../src/lib/web-extractor');
      expect(JUNK_SELECTORS).toContain('nav');
      expect(JUNK_SELECTORS).toContain('footer');
      expect(JUNK_SELECTORS).toContain('header');
      expect(JUNK_SELECTORS).toContain('.cookie-banner');
      expect(JUNK_SELECTORS).toContain('.advertisement');
      expect(JUNK_SELECTORS).toContain('.social-share');
      expect(JUNK_SELECTORS).toContain('.sidebar');
      expect(JUNK_SELECTORS).toContain('.pagination');
      expect(JUNK_SELECTORS).toContain('[role="navigation"]');
      expect(JUNK_SELECTORS).toContain('[role="banner"]');
      expect(JUNK_SELECTORS).toContain('[role="contentinfo"]');
      expect(JUNK_SELECTORS).toContain('[role="complementary"]');
    });
  });

  describe('Article page', () => {
    let html;
    beforeAll(() => {
      html = readFixture('article-page.html');
    });

    it('Readability extracts full article content with byline', () => {
      const result = extractArticleFromHtml(html, 'https://techcrunch.com/2026/07/18/openai-new-model/', { maxChars: 50000 });

      expect(result.length).toBeGreaterThan(2000);
      expect(result.byline).toContain('Kyle Wiggers');
      expect(result.title).toContain('GPT-5');
      expect(result.content).toContain('OpenAI today announced GPT-5');
      expect(result.content).toContain('multi-step reasoning');
      expect(result.content).toContain('92% on the GPQA Diamond');
    });

    it('Readability output passes the 1000-char heuristic', () => {
      const result = extractArticleFromHtml(html, 'https://techcrunch.com/2026/07/18/openai-new-model/', { maxChars: 50000 });

      // This is the condition: readabilitySufficient || hasByline
      const readabilitySufficient = result.length > 1000;
      const hasByline = !!result.byline;
      expect(readabilitySufficient || hasByline).toBe(true);
    });

    it('byline check catches short articles under 1000 chars but rejects thin content', () => {
      // Simulate a short but genuine article with a byline (300+ chars of content)
      const shortHtml = `<html><body>
        <article>
          <h1>Short Post About AI Ethics</h1>
          <p class="author">By Jane Doe</p>
          <p>Artificial intelligence is rapidly transforming industries across the globe, from healthcare to finance to transportation. As these systems become more capable, the ethical implications of their deployment grow more urgent. Researchers and policymakers are grappling with questions about bias, transparency, accountability, and the long-term impact on employment and society.</p>
        </article>
      </body></html>`;

      const result = extractArticleFromHtml(shortHtml, 'https://example.com/short', { maxChars: 50000 });

      // Content is ~400 chars with a byline -> accepted (above 300-char minimum)
      const readabilitySufficient = result.length > 1000;
      const hasBylineAndContent = !!(result.byline) && result.length > 300;
      expect(hasBylineAndContent).toBe(true);
      expect(readabilitySufficient || hasBylineAndContent).toBe(true);

      // Simulate a very thin article (< 300 chars) with a byline -> rejected, falls to fallback
      const tinyHtml = `<html><body>
        <article>
          <h1>Tiny Post</h1>
          <p class="author">By Jane Doe</p>
          <p>Brief note.</p>
        </article>
      </body></html>`;

      const tinyResult = extractArticleFromHtml(tinyHtml, 'https://example.com/tiny', { maxChars: 50000 });
      const tinyHasBylineAndContent = !!(tinyResult.byline) && tinyResult.length > 300;
      expect(tinyHasBylineAndContent).toBe(false);
    });
  });

  describe('DOM_SEARCH CSS selector heuristic', () => {
    // Tests the same regex used in the search-dom IPC handler
    const selectorRegex = /[.#\[\]:>+~]|^(h[1-6]|div|span|p|a|button|input|img|ul|li|table|tr|td|th|article|section|nav|header|footer|main|aside|form|label|select|option|textarea|video|audio|canvas|svg)(\s+\w+)*$/i;

    it.each([
      'h2', 'h3', 'h1', 'div', 'span', 'a', 'button', 'img', 'article', 'section', 'nav',
      'main', 'aside', 'footer', 'header', 'table', 'tr', 'td', 'li', 'ul', 'form',
      'label', 'input', 'select', 'textarea', 'video', 'audio', 'canvas', 'svg',
    ])('detects tag selector "%s"', (q) => {
      expect(selectorRegex.test(q.trim())).toBe(true);
    });

    it.each([
      '.my-class', '#my-id', 'div.content', 'a[href]',
      'h3.river-item__title', 'main[role="main"]',
      'div > p', 'nav.primary-nav',
      'button[type="submit"]', '.sidebar .widget',
      'ul li a', 'main article h1', 'section div p span',
    ])('detects complex selector "%s"', (q) => {
      expect(selectorRegex.test(q.trim())).toBe(true);
    });

    it.each([
      'OpenAI', 'Claude', 'Google DeepMind', 'hello world',
      'AI news', 'something without selector chars',
      'how to train a model',
    ])('does NOT treat "%s" as a selector (plain text search)', (q) => {
      expect(selectorRegex.test(q.trim())).toBe(false);
    });
  });

  describe('Reuters-style listing page (flat div nav, no semantic tags)', () => {
    let html;
    beforeAll(() => {
      html = readFixture('reuters-listing.html');
    });

    it('link-density heuristic strips flat div nav blocks', () => {
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html, { url: 'https://www.reuters.com/technology/artificial-intelligence/' });
      stripJunkFromDom(dom.window.document);
      const text = extractText(dom.window.document);

      // The flat div nav (12 links, ~95% link density) should be stripped
      expect(text).not.toContain('Site Index');
      expect(text).not.toMatch(/World\s+Business\s+Markets/);

      // But article content should remain
      expect(text).toContain('Data center protests go national');
      expect(text).toContain('TSMC expects');
      expect(text).toContain('OpenAI establishes');
      expect(text).toContain('Google DeepMind develops');
    });

    it('article content is preserved after junk stripping', () => {
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html, { url: 'https://www.reuters.com/technology/artificial-intelligence/' });
      stripJunkFromDom(dom.window.document);
      const text = extractText(dom.window.document);

      // Must have substantial content
      expect(text.length).toBeGreaterThan(500);

      // Must contain article headlines
      expect(text).toContain('Data center protests go national as backlash grows');
      expect(text).toContain('TSMC expects');
      expect(text).toContain('Nvidia beats revenue estimates');
    });

    it('data-testid nav elements are caught by expanded selectors', () => {
      const { JSDOM } = require('jsdom');
      const dom = new JSDOM(html, { url: 'https://www.reuters.com/technology/artificial-intelligence/' });

      // Before stripping: site-index div exists
      expect(dom.window.document.querySelector('.site-index')).toBeTruthy();

      stripJunkFromDom(dom.window.document);

      // After stripping: site-index div should be removed
      expect(dom.window.document.querySelector('.site-index')).toBeFalsy();
    });
  });
});
