const { Plugin } = require('../../src/lib/plugin-sdk');

const SUSPICIOUS_DOM_PATTERNS = [
  /password-breacher/i, /credit-card-scraper/i, /key-logger/i,
  /crypto-miner/i, /phishing-frame/i, /malware-redirect/i,
];

class PageAnalyzerPlugin extends Plugin {
  constructor() {
    super({
      id: 'aartiq-page-analyzer',
      name: 'Page Analyzer',
      version: '1.0.0',
      description: 'Analyze web page structure, SEO, accessibility, and readability',
      type: 'command',
      permissions: ['network'],
    });
  }

  async onLoad() {
    this.context.log('Page Analyzer loaded');

    this.registerCommand({
      id: 'analyze-seo',
      name: 'Analyze SEO',
      description: 'Analyze SEO elements of the current page',
      params: [{ name: 'url', type: 'string', required: true, description: 'Page URL' }],
      handler: async (params) => {
        const html = await this._fetchPage(params.url);
        const title = this._extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
        const description = this._extract(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
        const ogTitle = this._extract(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
        const ogDesc = this._extract(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
        const ogImage = this._extract(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
        const canonical = this._extract(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
        const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
        const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
        const imgTags = html.match(/<img[\s>]/gi) || [];
        const imgAlts = imgTags.filter(t => /alt\s*=\s*["']/.test(t)).length;
        const lang = this._extract(html, /<html[^>]+lang=["']([^"']*)["']/i);
        const viewport = this._extract(html, /<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i);
        const hasRobots = /<meta[^>]+name=["']robots["']/i.test(html);
        const hasSitemap = /<link[^>]+type=["']application\/xml["']/.test(html) || /sitemap/i.test(html);
        const wordCount = this._wordCount(this._extractText(html));

        const issues = [];
        if (!title) issues.push('❌ Missing <title> tag');
        else if (title.length < 30 || title.length > 60) issues.push(`⚠️ Title length (${title.length}) outside ideal 30-60 chars`);
        if (!description) issues.push('❌ Missing meta description');
        else if (description.length < 50 || description.length > 160) issues.push(`⚠️ Description length (${description.length}) outside ideal 50-160 chars`);
        if (!ogTitle) issues.push('❌ Missing og:title');
        if (!ogDesc) issues.push('❌ Missing og:description');
        if (!ogImage) issues.push('⚠️ Missing og:image');
        if (!canonical) issues.push('⚠️ No canonical URL');
        if (h1Count === 0) issues.push('❌ No H1 heading');
        if (h1Count > 1) issues.push(`⚠️ ${h1Count} H1 tags (should be 1)`);
        if (!lang) issues.push('⚠️ Missing lang attribute on <html>');
        if (!viewport) issues.push('❌ Missing viewport meta tag');
        if (!hasRobots) issues.push('⚠️ No robots meta tag');

        const score = Math.max(0, Math.round(100 - (issues.length * 8)));
        const rating = score >= 80 ? '🟢 Great' : score >= 50 ? '🟡 Needs Work' : '🔴 Poor';

        return {
          success: true,
          output: [
            `📊 SEO Analysis: ${params.url}`,
            `Score: ${score}/100 (${rating})`,
            '',
            '--- Basic Info ---',
            `Title: ${title || '(missing)'}`,
            `Description: ${(description || '(missing)').substring(0, 80)}...`,
            `Language: ${lang || '(not set)'}`,
            `Words: ${wordCount}`,
            '',
            '--- Structure ---',
            `H1 tags: ${h1Count}`,
            `H2 tags: ${h2Count}`,
            `Images: ${imgTags.length} (${imgAlts} with alt text)`,
            '',
            '--- Social ---',
            `og:title: ${ogTitle || '❌'}`,
            `og:description: ${ogDesc ? '✅' : '❌'}`,
            `og:image: ${ogImage ? '✅' : '❌'}`,
            '',
            '--- Issues Found (${issues.length}) ---`,
            issues.length ? issues.join('\n') : '✅ No major issues found!',
          ].join('\n'),
        };
      },
    });

    this.registerCommand({
      id: 'check-links',
      name: 'Check Links',
      description: 'Find all links on a page and check their status',
      params: [{ name: 'url', type: 'string', required: true, description: 'Page URL' }],
      handler: async (params) => {
        const html = await this._fetchPage(params.url);
        const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
        const links = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const href = match[1];
          if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
            links.push(href);
          }
        }

        const unique = [...new Set(links)].slice(0, 50);
        let working = 0, broken = 0, skipped = 0;

        const results = [];
        for (const link of unique) {
          try {
            const absolute = link.startsWith('http') ? link : new URL(link, params.url).href;
            const status = await this._checkLink(absolute);
            if (status >= 200 && status < 400) {
              working++;
              results.push(`✅ ${status} ${link.substring(0, 60)}`);
            } else {
              broken++;
              results.push(`❌ ${status} ${link.substring(0, 60)}`);
            }
          } catch {
            skipped++;
          }
        }

        return {
          success: true,
          output: [
            `🔗 Link Check: ${params.url}`,
            `Total links found: ${links.length}`,
            `Unique checked: ${unique.length}`,
            `✅ Working: ${working}`,
            `❌ Broken: ${broken}`,
            `⏭️  Skipped: ${skipped}`,
            '',
            ...results.slice(0, 30),
          ].join('\n'),
        };
      },
    });

    this.registerCommand({
      id: 'readability-score',
      name: 'Readability Score',
      description: 'Calculate the readability score of page content',
      params: [{ name: 'content', type: 'string', required: true, description: 'Text content to analyze' }],
      handler: async (params) => {
        const text = params.content;
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chars = text.replace(/\s/g, '').length;
        const syllables = this._countSyllables(text);
        const wordCount = words.length;
        const sentenceCount = sentences.length || 1;

        const avgWordsPerSentence = wordCount / sentenceCount;
        const avgCharsPerWord = chars / wordCount;
        const avgSyllablesPerWord = syllables / wordCount;

        const flesch = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

        let grade, level;
        if (flesch >= 90) { grade = '5th grade'; level = 'Very Easy'; }
        else if (flesch >= 80) { grade = '6th grade'; level = 'Easy'; }
        else if (flesch >= 70) { grade = '7th grade'; level = 'Fairly Easy'; }
        else if (flesch >= 60) { grade = '8th-9th grade'; level = 'Standard'; }
        else if (flesch >= 50) { grade = '10th-12th grade'; level = 'Fairly Difficult'; }
        else if (flesch >= 30) { grade = 'College'; level = 'Difficult'; }
        else { grade = 'College Graduate'; level = 'Very Difficult'; }

        return {
          success: true,
          output: [
            '📖 Readability Analysis',
            '',
            '--- Stats ---',
            `Words: ${wordCount}`,
            `Sentences: ${sentenceCount}`,
            `Characters: ${chars}`,
            `Syllables: ${syllables}`,
            '',
            '--- Scores ---',
            `Avg words/sentence: ${avgWordsPerSentence.toFixed(1)}`,
            `Avg syllables/word: ${avgSyllablesPerWord.toFixed(2)}`,
            `Flesch Reading Ease: ${flesch.toFixed(1)}`,
            '',
            '--- Result ---',
            `Level: ${level}`,
            `Grade: ${grade}`,
          ].join('\n'),
        };
      },
    });
  }

  async _fetchPage(url) {
    const urlObj = new URL(url);
    const http = urlObj.protocol === 'https:' ? require('https') : require('http');
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 10000, headers: { 'User-Agent': 'Aartiq-PageAnalyzer/1.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk.toString());
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  _checkLink(url) {
    return new Promise((resolve) => {
      const http = url.startsWith('https') ? require('https') : require('http');
      const req = http.get(url, { timeout: 5000, method: 'HEAD' }, (res) => {
        resolve(res.statusCode);
        res.resume();
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(0); });
      req.end();
    });
  }

  _extract(html, regex) {
    const m = regex.exec(html);
    return m ? m[1].trim() : null;
  }

  _extractText(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _wordCount(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  _countSyllables(text) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
    let count = 0;
    for (const word of words) {
      let syl = 0;
      const chars = word.split('');
      for (let i = 0; i < chars.length; i++) {
        if ('aeiouy'.includes(chars[i])) {
          if (i === 0 || !'aeiouy'.includes(chars[i - 1])) syl++;
        }
      }
      if (word.endsWith('e') && syl > 1) syl--;
      if (syl === 0) syl = 1;
      count += syl;
    }
    return count;
  }
}

module.exports = new PageAnalyzerPlugin();
