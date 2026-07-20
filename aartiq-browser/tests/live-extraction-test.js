#!/usr/bin/env node
/**
 * Live extraction regression test — requires Electron (run via `npm run test:extraction:live`).
 * Tests the actual extract-page-content pipeline against real-world sites.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

const { extractArticleFromHtml, stripJunkFromDom, extractText } = require('../src/lib/web-extractor');

const TEST_URL = 'https://techcrunch.com/category/artificial-intelligence/';
const TIMEOUT = 30000;

let mainWindow;

async function extractFromRenderer(wc) {
  const html = await wc.executeJavaScript(`document.documentElement.outerHTML || ''`);
  if (!html || html.length < 200) return '';

  const url = 'https://techcrunch.com/category/artificial-intelligence/';
  const articleResult = extractArticleFromHtml(html, url, { maxChars: 50000 });
  const hasByline = !!(articleResult && articleResult.byline);
  const readabilitySufficient = articleResult && articleResult.length > 1000;
  const extracted = (articleResult && articleResult.content) || '';

  if (readabilitySufficient || (hasByline && extracted.length > 500)) {
    return { content: articleResult.content, method: 'readability', byline: articleResult.byline || '' };
  }

  // Fallback: JSDOM + stripJunkFromDom
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(html, { url });
  stripJunkFromDom(dom.window.document);
  const text = extractText(dom.window.document);
  return { content: text, method: 'dom-fallback', byline: '' };
}

async function runTests() {
  const failures = [];
  const passes = [];

  console.log('=== Live Extraction Regression Test ===');
  console.log(`Target: ${TEST_URL}\n`);

  // Test 1: Navigate and wait for content
  console.log('[1] Navigating and waiting for content...');
  await mainWindow.loadURL(TEST_URL);
  // Wait for hydration (TechCrunch is React/Next.js)
  await new Promise(r => setTimeout(r, 5000));

  const wc = mainWindow.webContents;

  // Test 2: DOM_SEARCH for h3 elements
  console.log('[2] Running DOM_SEARCH for "h3"...');
  const h3Results = await wc.executeJavaScript(`
    (() => {
      const els = document.querySelectorAll('h3');
      const results = [];
      for (let i = 0; i < Math.min(els.length, 5); i++) {
        const el = els[i];
        const text = (el.textContent || '').trim();
        const link = el.querySelector('a');
        const href = link ? link.getAttribute('href') : '';
        results.push({ text, href });
      }
      return results;
    })()
  `);

  if (h3Results && h3Results.length > 0) {
    passes.push(`DOM_SEARCH h3: found ${h3Results.length}+ results`);
    console.log(`  PASS: Found ${h3Results.length} h3 elements (showing first 5):`);
    h3Results.forEach((r, i) => console.log(`    ${i + 1}. "${r.text}" ${r.href}`));
  } else {
    failures.push('DOM_SEARCH h3: no results found');
    console.log('  FAIL: No h3 elements found');
  }

  // Test 3: READ_PAGE_CONTENT
  console.log('\n[3] Running READ_PAGE_CONTENT...');
  const result = await extractFromRenderer(wc);

  if (!result || !result.content) {
    failures.push('READ_PAGE_CONTENT: no content returned');
    console.log('  FAIL: No content returned');
  } else {
    const len = result.content.length;
    console.log(`  Method: ${result.method}, Length: ${len} chars`);

    // Assert minimum length
    if (len >= 1000) {
      passes.push(`READ_PAGE_CONTENT length: ${len} chars (>= 1000)`);
    } else {
      failures.push(`READ_PAGE_CONTENT length too short: ${len} chars`);
      console.log(`  FAIL: Content too short (${len} < 1000)`);
    }

    // Assert no nav junk at start
    const startsWithJunk = /^(Topics|Home|Startups|Venture|Apple|Apps|Biotech|Cryptocurrency)/.test(result.content);
    if (!startsWithJunk) {
      passes.push('READ_PAGE_CONTENT: no nav junk at start');
    } else {
      failures.push('READ_PAGE_CONTENT: starts with nav/menu content');
      console.log(`  FAIL: Content starts with junk: "${result.content.substring(0, 80)}..."`);
    }

    // Assert contains article content
    if (result.content.includes('OpenAI') || result.content.includes('AI') || result.content.includes('robotics')) {
      passes.push('READ_PAGE_CONTENT: contains article content');
    } else {
      failures.push('READ_PAGE_CONTENT: missing expected article keywords');
      console.log('  FAIL: No article keywords found in content');
    }

    console.log(`  Content preview: "${result.content.substring(0, 120)}..."`);
  }

  // Summary
  console.log('\n=== Results ===');
  passes.forEach(p => console.log(`  PASS: ${p}`));
  failures.forEach(f => console.log(`  FAIL: ${f}`));
  console.log(`\n${passes.length} passed, ${failures.length} failed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }

  app.quit();
}

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // headless
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const timeout = setTimeout(() => {
    console.error(`\nTIMEOUT: Test exceeded ${TIMEOUT / 1000}s limit`);
    app.exit(1);
  }, TIMEOUT);

  runTests()
    .catch(err => {
      console.error('Test error:', err);
      app.exit(1);
    })
    .finally(() => clearTimeout(timeout));
});
