const { JSDOM } = require('jsdom');
const fetch = require('cross-fetch');
const { extractArticleFromHtml, DEFAULT_UA } = require('./web-extractor');

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE RANKER — Expanded domain trust scoring + content quality signals
// ═══════════════════════════════════════════════════════════════════════════════
class SourceRanker {
  constructor() {
    this.sourceScores = {
      'reuters.com': 100, 'apnews.com': 100, 'ap.org': 100,
      'bbc.com': 98, 'bbc.co.uk': 98, 'wsj.com': 96, 'bloomberg.com': 96,
      'nytimes.com': 95, 'washingtonpost.com': 95, 'ft.com': 95,
      'economist.com': 96, 'theguardian.com': 94,
      'thehindu.com': 94, 'livemint.com': 93, 'aljazeera.com': 93,
      'france24.com': 92, 'dw.com': 92, 'indianexpress.com': 92,
      'cnn.com': 91, 'business-standard.com': 90,
      'thehindubusinessline.com': 90, 'techcrunch.com': 90,
      'arstechnica.com': 89, 'theverge.com': 89, 'wired.com': 88,
      'moneycontrol.com': 88, 'economictimes.indiatimes.com': 88,
      'hindustantimes.com': 88, 'theprint.in': 87, 'scroll.in': 86,
      'ndtv.com': 85, 'timesofindia.indiatimes.com': 85,
      'newslaundry.com': 85, 'thewire.in': 85, 'firstpost.com': 82,
      'news18.com': 82, 'indiatoday.in': 82, 'engadget.com': 82,
      'mashable.com': 80, 'gizmodo.com': 80, 'zeenews.india.com': 80,
      'venturebeat.com': 80, 'zdnet.com': 82, 'cnet.com': 80,
      'hackernews.com': 78, 'republicworld.com': 78,
      'opindia.com': 75, 'swarajyamag.com': 75,
      'prachatai.com': 70, 'polygon.com': 75, 'theinformation.com': 85,
      'semianalysis.com': 80, 'stratechery.com': 78,
      'medium.com': 50, 'substack.com': 55, 'linkedin.com': 45,
      'twitter.com': 35, 'x.com': 35, 'facebook.com': 30,
      'instagram.com': 30, 'reddit.com': 45, 'quora.com': 40,
      'blogspot.com': 40, 'wordpress.com': 45, 'tumblr.com': 35,
      'youtube.com': 50, 'wikipedia.org': 70,
    };

    this.displayNames = {
      'reuters.com': 'Reuters', 'apnews.com': 'Associated Press', 'ap.org': 'Associated Press',
      'bbc.com': 'BBC', 'bbc.co.uk': 'BBC', 'wsj.com': 'Wall Street Journal',
      'bloomberg.com': 'Bloomberg', 'nytimes.com': 'New York Times',
      'washingtonpost.com': 'Washington Post', 'ft.com': 'Financial Times',
      'economist.com': 'The Economist', 'theguardian.com': 'The Guardian',
      'thehindu.com': 'The Hindu', 'livemint.com': 'Mint',
      'aljazeera.com': 'Al Jazeera', 'france24.com': 'France 24', 'dw.com': 'Deutsche Welle',
      'indianexpress.com': 'Indian Express', 'cnn.com': 'CNN',
      'techcrunch.com': 'TechCrunch', 'arstechnica.com': 'Ars Technica',
      'theverge.com': 'The Verge', 'wired.com': 'Wired',
      'business-standard.com': 'Business Standard',
      'thehindubusinessline.com': 'Hindu Business Line',
      'moneycontrol.com': 'Moneycontrol',
      'economictimes.indiatimes.com': 'Economic Times',
      'hindustantimes.com': 'Hindustan Times', 'theprint.in': 'The Print',
      'scroll.in': 'Scroll.in', 'ndtv.com': 'NDTV',
      'timesofindia.indiatimes.com': 'Times of India',
      'firstpost.com': 'Firstpost', 'news18.com': 'News18',
      'indiatoday.in': 'India Today', 'engadget.com': 'Engadget',
      'mashable.com': 'Mashable', 'gizmodo.com': 'Gizmodo',
      'zeenews.india.com': 'Zee News', 'venturebeat.com': 'VentureBeat',
      'zdnet.com': 'ZDNet', 'cnet.com': 'CNET', 'republicworld.com': 'Republic World',
      'opindia.com': 'OpIndia', 'swarajyamag.com': 'Swarajya',
      'polygon.com': 'Polygon', 'theinformation.com': 'The Information',
      'stratechery.com': 'Stratechery', 'semianalysis.com': 'SemiAnalysis',
      'hackernews.com': 'Hacker News', 'medium.com': 'Medium',
      'substack.com': 'Substack', 'reddit.com': 'Reddit',
      'wikipedia.org': 'Wikipedia', 'youtube.com': 'YouTube',
    };
  }

  getDomainScore(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
      for (const [domain, score] of Object.entries(this.sourceScores)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) return score;
      }
      if (hostname.includes('github.io') || hostname.includes('gitlab.io') || hostname.includes('netlify.app') || hostname.includes('vercel.app')) return 55;
      if (hostname.match(/\.(gov|edu)$/)) return 80;
      if (hostname.match(/\.org$/)) return 65;
      return 35;
    } catch { return 35; }
  }

  getSourceName(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
      for (const [domain, name] of Object.entries(this.displayNames)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) return name;
      }
      return hostname;
    } catch { return 'Unknown'; }
  }

  getSourceFavicon(url) {
    try {
      const origin = new URL(url).origin;
      return `${origin}/favicon.ico`;
    } catch { return ''; }
  }

  scoreContentQuality(article) {
    let qualityScore = 0;
    const content = article.content || '';
    const title = article.title || '';

    if (content.length > 2000) qualityScore += 20;
    else if (content.length > 1000) qualityScore += 10;
    else if (content.length > 500) qualityScore += 5;

    if (article.byline) qualityScore += 15;
    if (article.publishedTime) qualityScore += 10;

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 100);
    if (paragraphs.length > 5) qualityScore += 15;
    else if (paragraphs.length > 3) qualityScore += 8;

    const junkRatio = this._calculateJunkRatio(content);
    if (junkRatio < 0.1) qualityScore += 20;
    else if (junkRatio < 0.2) qualityScore += 10;
    else qualityScore -= 10;

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length > 10) qualityScore += 10;

    const numbers = content.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
    if (numbers.length > 5) qualityScore += 5;

    return Math.max(0, Math.min(100, qualityScore));
  }

  _calculateJunkRatio(text) {
    const junkPatterns = [/subscribe now/gi, /sign up/gi, /cookie/gi, /newsletter/gi, /follow us/gi, /share this/gi, /advertisement/gi, /sponsored/gi, /click here/gi, /read more/gi];
    let junkCount = 0;
    for (const p of junkPatterns) {
      const matches = text.match(p);
      if (matches) junkCount += matches.length;
    }
    const words = text.split(/\s+/).length;
    return words > 0 ? Math.min(1, junkCount / (words / 50)) : 0;
  }

  getCompositeScore(url, article) {
    const domainScore = this.getDomainScore(url);
    const contentQuality = this.scoreContentQuality(article);
    return Math.round(domainScore * 0.6 + contentQuality * 0.4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT CLEANER — Multi-strategy article extraction with fallback chain
// ═══════════════════════════════════════════════════════════════════════════════
class ContentCleaner {
  constructor() {
    this.junkSelectors = [
      'script', 'style', 'noscript', 'iframe:not([src*="youtube"]):not([src*="vimeo"])',
      'nav', 'footer', 'header', 'aside',
      '.sidebar', '.menu', '.footer', '.header', '.nav', '.navbar',
      '.ad', '.advertisement', '.ads', '.ad-slot', '.ad-wrapper',
      '.cookie', '.cookie-banner', '.cookie-notice', '.gdpr', '.consent',
      '.popup', '.modal', '.overlay', '.banner:not(article .banner)',
      '.newsletter', '.subscribe', '.subscription',
      '.social-share', '.share-buttons', '.share-bar', '.social-links',
      '.related-posts', '.related-articles', '.recommended',
      '.trending', '.popular', '.most-read', '.editor-pick',
      '.sponsored', '.promoted', '.advertorial',
      '.pagination', '.page-numbers', '.load-more',
      '.comments', '#comments', '.comment-section', '.discussion',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '[role="complementary"]', '[role="search"]',
      '.paywall', '.metered', '.premium', '.subscriber-only',
    ];

    this.junkTextPatterns = [
      /subscribe now/gi, /sign up for our newsletter/gi, /follow us on/gi,
      /cookie policy/gi, /privacy policy/gi, /terms of (?:service|use)/gi,
      /all rights reserved/gi, /copyright \d{4}/gi, /powered by/gi,
      /enable (?:javascript|cookies)/gi, /disable ad blocker/gi,
      /share this (?:article|story)/gi, /tweet this/gi, /pin this/gi,
      /leave a (?:comment|reply)/gi, /write a comment/gi,
      /load more (?:comments|stories)/gi, /show more/gi,
      /skip to (?:content|main)/gi, /accessibility statement/gi,
      /select language/gi, /download our app/gi,
      /buy (?:this|us a coffee)/gi, /support us/gi, /donate/gi,
      /patreon/gi, /members only/gi,
      /more from (?:this|the) (?:author|source)/gi,
      /related (?:articles?|stories?)/gi, /trending now/gi,
      /most popular/gi, /editor.s pick/gi,
    ];
  }

  extractArticleContent(html, url) {
    return extractArticleFromHtml(html, url, { maxChars: 12000 });
  }

  extractWithFallback(html, url) {
    const strategies = [
      () => this._extractWithReadability(html, url),
      () => this._extractByArticleTag(html, url),
      () => this._extractByMainOrRole(html, url),
      () => this._extractByArticleBody(html, url),
      () => this._extractByParagraphs(html, url),
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result && result.content && result.content.length > 200) {
          return result;
        }
      } catch {}
    }

    return this.extractArticleContent(html, url);
  }

  _extractWithReadability(html, url) {
    return extractArticleFromHtml(html, url, { maxChars: 12000 });
  }

  _extractByArticleTag(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const article = doc.querySelector('article');
    if (!article) return null;
    return this._extractStructured(article, url);
  }

  _extractByMainOrRole(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const main = doc.querySelector('main, [role="main"]');
    if (!main) return null;
    return this._extractStructured(main, url);
  }

  _extractByArticleBody(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const body = doc.querySelector('[itemprop="articleBody"], .article-body, .post-content, .entry-content, .story-body');
    if (!body) return null;
    return this._extractStructured(body, url);
  }

  _extractByParagraphs(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    this._removeJunkElements(doc);
    const paragraphs = doc.querySelectorAll('p');
    const texts = [];
    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length > 80 && !this._isJunkText(text)) {
        texts.push(text);
      }
    }
    if (texts.length < 2) return null;
    const title = doc.querySelector('h1')?.textContent?.trim() || '';
    const byline = doc.querySelector('[rel="author"], .author, .byline')?.textContent?.trim() || '';
    const content = texts.join('\n\n');
    return { title, byline, content, excerpt: texts[0]?.substring(0, 300) || '', siteName: this._extractSiteName(doc, url), url };
  }

  _extractStructured(element, url) {
    const title = element.querySelector('h1, h2')?.textContent?.trim() || '';
    const byline = element.querySelector('[rel="author"], .author, .byline, [class*="author"]')?.textContent?.trim() || '';
    const paragraphs = element.querySelectorAll('p');
    const texts = [];
    for (const p of paragraphs) {
      const text = p.textContent.trim();
      if (text.length > 40 && !this._isJunkText(text)) {
        texts.push(text);
      }
    }
    const content = texts.join('\n\n');
    return { title, byline, content, excerpt: texts[0]?.substring(0, 300) || '', siteName: this._extractSiteName(element, url), url };
  }

  _removeJunkElements(doc) {
    for (const sel of this.junkSelectors) {
      try {
        for (const el of doc.querySelectorAll(sel)) el.remove();
      } catch {}
    }
  }

  _isJunkText(text) {
    return this.junkTextPatterns.some(p => p.test(text));
  }

  _extractSiteName(doc, url) {
    const og = doc.querySelector('meta[property="og:site_name"]');
    if (og) return og.getAttribute('content') || '';
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  }

  cleanHtml(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    this._removeJunkElements(doc);
    return dom.serialize();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH PLANNER — Intent detection, topic decomposition, coverage tracking
// ═══════════════════════════════════════════════════════════════════════════════
class ResearchPlanner {
  constructor(query) {
    this.query = query;
    this.subtopics = this._decomposeQuery(query);
    this.coveredSubtopics = new Set();
    this.searchedQueries = new Set();
    this.collectedSources = [];
    this.maxIterations = 4;
    this.iteration = 0;
  }

  _decomposeQuery(query) {
    const subtopics = [];
    const q = query.toLowerCase();

    subtopics.push({ id: 'main', label: 'Core topic', query: query, priority: 1, covered: false });

    const decomposePatterns = [
      { pattern: /\b(news|latest|recent|today|updates?)\b/i, subtopic: 'recent-news', label: 'Recent news & updates' },
      { pattern: /\b(funding|invest(?:ment|ed|ors?)|raised?|valuation|series)\b/i, subtopic: 'funding', label: 'Funding & investments' },
      { pattern: /\b(security|breach|hack|vulnerability|attack|cyber)\b/i, subtopic: 'security', label: 'Security incidents' },
      { pattern: /\b(research|paper|study|findings?|discover(?:y|ies))\b/i, subtopic: 'research', label: 'Research & findings' },
      { pattern: /\b(regulat(?:ion|ory)|compliance|law|legislation|policy|ban)\b/i, subtopic: 'regulation', label: 'Regulations & policy' },
      { pattern: /\b(product|launch|release|feature|update|version)\b/i, subtopic: 'product', label: 'Product launches' },
      { pattern: /\b(company|companies|startup|firms?|acquisition|merger|buyout)\b/i, subtopic: 'companies', label: 'Company news' },
      { pattern: /\b(market|stock|share|trading|sector|industry|economy)\b/i, subtopic: 'market', label: 'Market & financial' },
      { pattern: /\b(compet(?:ition|ing)|versus|vs\.?|compared?|alternative)\b/i, subtopic: 'competition', label: 'Competition & comparisons' },
      { pattern: /\b(future|outlook|predict|forecast|trend|expect)\b/i, subtopic: 'outlook', label: 'Future outlook & trends' },
      { pattern: /\b(impact|effect|consequence|result|outcome)\b/i, subtopic: 'impact', label: 'Impact & consequences' },
      { pattern: /\b(controversy|scandal|criticis|debate|backlash)\b/i, subtopic: 'controversy', label: 'Controversies & debates' },
    ];

    for (const { pattern, subtopic, label } of decomposePatterns) {
      if (pattern.test(q)) {
        const subQuery = this._generateSubQuery(query, subtopic);
        subtopics.push({ id: subtopic, label, query: subQuery, priority: 2, covered: false });
      }
    }

    if (subtopics.length <= 2) {
      const autoSubtopics = [
        { id: 'overview', label: 'General overview', query: `${query} overview explained`, priority: 2 },
        { id: 'latest', label: 'Latest developments', query: `${query} latest news today`, priority: 2 },
      ];
      for (const st of autoSubtopics) {
        if (!subtopics.find(s => s.id === st.id)) subtopics.push(st);
      }
    }

    return subtopics.sort((a, b) => a.priority - b.priority);
  }

  _generateSubQuery(query, subtopic) {
    const modifiers = {
      'recent-news': 'latest news today',
      'funding': 'funding investment raised',
      'security': 'security breach vulnerability',
      'research': 'research paper study findings',
      'regulation': 'regulation policy law',
      'product': 'product launch release',
      'companies': 'company startup acquisition',
      'market': 'market stock price',
      'competition': 'compared to alternatives',
      'outlook': 'future outlook trends predictions',
      'impact': 'impact effect consequences',
      'controversy': 'controversy criticism debate',
    };
    return `${query} ${modifiers[subtopic] || ''}`.trim();
  }

  getNextSearchQuery() {
    for (const subtopic of this.subtopics) {
      if (!subtopic.covered && !this.searchedQueries.has(subtopic.query)) {
        this.searchedQueries.add(subtopic.query);
        return { query: subtopic.query, subtopicId: subtopic.id, label: subtopic.label };
      }
    }
    return null;
  }

  markSubtopicCovered(subtopicId, sources) {
    const subtopic = this.subtopics.find(s => s.id === subtopicId);
    if (subtopic) {
      subtopic.covered = true;
      this.coveredSubtopics.add(subtopicId);
    }
    if (sources) this.collectedSources.push(...sources);
  }

  getCoverage() {
    const total = this.subtopics.length;
    const covered = this.subtopics.filter(s => s.covered).length;
    return {
      total,
      covered,
      percentage: total > 0 ? Math.round((covered / total) * 100) : 0,
      subtopics: this.subtopics.map(s => ({ ...s })),
      needsMore: covered < total && this.iteration < this.maxIterations,
      threshold: 70,
    };
  }

  canContinue() {
    return this.iteration < this.maxIterations && this.getNextSearchQuery() !== null;
  }

  incrementIteration() {
    this.iteration++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DUPLICATE DETECTOR — Article clustering by semantic similarity
// ═══════════════════════════════════════════════════════════════════════════════
class DuplicateDetector {
  constructor() {
    this.similarityThreshold = 0.7;
  }

  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  extractKeyEntities(text) {
    const entities = [];
    const stopwords = new Set(['The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'What', 'Who', 'Why', 'How', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
    const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    for (const noun of properNouns) {
      if (noun.length > 2 && !stopwords.has(noun)) entities.push(noun);
    }
    const capitalized = text.match(/\b[A-Z]{2,}\b/g) || [];
    entities.push(...capitalized);
    const dates = text.match(/\b\d{1,2}[\s\-/]\w+[\s\-/]\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b/g) || [];
    entities.push(...dates);
    const numbers = text.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion|crore|lakh|percent|%)\b/gi) || [];
    entities.push(...numbers);
    return [...new Set(entities)].slice(0, 20);
  }

  calculateEntityOverlap(entities1, entities2) {
    const set1 = new Set(entities1.map(e => e.toLowerCase()));
    const set2 = new Set(entities2.map(e => e.toLowerCase()));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  clusterArticles(articles) {
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < articles.length; i++) {
      if (used.has(i)) continue;
      const cluster = {
        id: clusters.length,
        mainArticle: articles[i],
        articles: [articles[i]],
        sources: [articles[i].source],
        entities: this.extractKeyEntities(articles[i].content || articles[i].snippet || ''),
        confidence: articles[i].score || 50,
      };
      used.add(i);
      for (let j = i + 1; j < articles.length; j++) {
        if (used.has(j)) continue;
        const similarity = this.calculateSimilarity(
          articles[i].content || articles[i].snippet || '',
          articles[j].content || articles[j].snippet || ''
        );
        const entityOverlap = this.calculateEntityOverlap(
          this.extractKeyEntities(articles[i].content || articles[i].snippet || ''),
          this.extractKeyEntities(articles[j].content || articles[j].snippet || '')
        );
        if (similarity > this.similarityThreshold || entityOverlap > 0.5) {
          cluster.articles.push(articles[j]);
          cluster.sources.push(articles[j].source);
          cluster.entities = [...new Set([...cluster.entities, ...this.extractKeyEntities(articles[j].content || articles[j].snippet || '')])];
          cluster.confidence = Math.max(cluster.confidence, articles[j].score || 50);
          used.add(j);
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRADICTION DETECTOR — Cross-source factual verification
// ═══════════════════════════════════════════════════════════════════════════════
class ContradictionDetector {
  constructor() {
    this.contradictionPatterns = [
      { pattern: /\b(increased|rose|grew|surged|jumped|climbed)\b/gi, opposite: /\b(decreased|fell|dropped|declined|plunged|slumped)\b/gi },
      { pattern: /\b(killed|died|deaths?|fatalities?)\b/gi, opposite: /\b(survived|alive|recovered|injured)\b/gi },
      { pattern: /\b(guilty|convicted|sentenced)\b/gi, opposite: /\b(innocent|acquitted|cleared|exonerated)\b/gi },
      { pattern: /\b(approved|passed|enacted|signed)\b/gi, opposite: /\b(rejected|blocked|vetoed|stalled|failed)\b/gi },
      { pattern: /\b(agreed|deal|agreement|accord)\b/gi, opposite: /\b(disagreed|stalemate|impasse|breakdown|collapsed)\b/gi },
      { pattern: /\b(launched|started|began|commenced)\b/gi, opposite: /\b(stopped|halted|suspended|delayed|postponed|cancelled)\b/gi },
    ];
  }

  detectContradictions(cluster) {
    const articles = cluster.articles;
    if (articles.length < 2) return null;
    const contradictions = [];
    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const text1 = (articles[i].content || articles[i].snippet || '').toLowerCase();
        const text2 = (articles[j].content || articles[j].snippet || '').toLowerCase();
        for (const { pattern, opposite } of this.contradictionPatterns) {
          const matches1 = text1.match(pattern);
          const matches2 = text2.match(opposite);
          if (matches1 && matches2) {
            contradictions.push({
              claim1: { source: articles[i].source, text: matches1[0] },
              claim2: { source: articles[j].source, text: matches2[0] },
              type: 'numerical_or_factual',
            });
          }
          const matches1b = text1.match(opposite);
          const matches2b = text2.match(pattern);
          if (matches1b && matches2b) {
            contradictions.push({
              claim1: { source: articles[i].source, text: matches1b[0] },
              claim2: { source: articles[j].source, text: matches2b[0] },
              type: 'numerical_or_factual',
            });
          }
        }
        const nums1 = text1.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
        const nums2 = text2.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
        for (const n1 of nums1) {
          for (const n2 of nums2) {
            const v1 = parseFloat(n1.replace(/,/g, ''));
            const v2 = parseFloat(n2.replace(/,/g, ''));
            if (v1 > 0 && v2 > 0) {
              const ratio = Math.max(v1, v2) / Math.min(v1, v2);
              if (ratio >= 2 && ratio <= 100) {
                contradictions.push({
                  claim1: { source: articles[i].source, text: n1 },
                  claim2: { source: articles[j].source, text: n2 },
                  type: 'numerical_discrepancy',
                  ratio: ratio.toFixed(1),
                });
              }
            }
          }
        }
      }
    }
    return contradictions.length > 0 ? contradictions : null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARALLEL FETCHER — Concurrent page fetching with abort support
// ═══════════════════════════════════════════════════════════════════════════════
class ParallelFetcher {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
  }

  async fetchAll(urls, fetchFn, onProgress) {
    const results = [];
    const executing = new Set();
    let index = 0;

    const fetchNext = async () => {
      while (index < urls.length) {
        const i = index++;
        const url = urls[i];
        const promise = fetchFn(url, i).then(result => {
          executing.delete(promise);
          if (onProgress) onProgress({ completed: results.length + 1, total: urls.length, url });
          return result;
        }).catch(err => {
          executing.delete(promise);
          return { url, error: err.message, score: 0 };
        });
        executing.add(promise);
        results.push(promise);
        if (executing.size >= this.concurrency) {
          await Promise.race(executing);
        }
      }
    };

    await fetchNext();
    return Promise.all(results);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR — Structured research report with charts data
// ═══════════════════════════════════════════════════════════════════════════════
class ReportGenerator {
  constructor() {
    this.categoryKeywords = {
      'World': ['war', 'conflict', 'politics', 'election', 'government', 'president', 'minister', 'parliament', 'diplomacy', 'sanctions', 'treaty', 'united nations', 'nato', 'eu', 'foreign'],
      'Technology': ['ai', 'artificial intelligence', 'software', 'hardware', 'startup', 'tech', 'google', 'apple', 'microsoft', 'openai', 'anthropic', 'nvidia', 'chip', 'semiconductor', 'robot', 'quantum', 'blockchain', 'crypto', 'coding', 'developer'],
      'Business & Markets': ['stock', 'market', 'share', 'trading', 'investment', 'revenue', 'profit', 'earnings', 'ipo', 'valuation', 'merger', 'acquisition', 'funding', 'bank', 'finance', 'economy', 'gdp', 'inflation'],
      'Science & Health': ['research', 'study', 'scientist', 'discovery', 'vaccine', 'disease', 'health', 'medical', 'clinical', 'trial', 'fda', 'who', 'nasa', 'space', 'climate', 'environment', 'gene'],
      'Sports': ['match', 'game', 'tournament', 'championship', 'league', 'player', 'team', 'score', 'win', 'loss', 'cup', 'world cup', 'olympics'],
      'Entertainment': ['movie', 'film', 'music', 'album', 'concert', 'celebrity', 'actor', 'actress', 'director', 'streaming', 'netflix', 'disney', 'award', 'oscar', 'grammy'],
    };
    this.categoryEmojis = {
      'World': '🌍', 'Technology': '💻', 'Business & Markets': '📈',
      'Science & Health': '🔬', 'Sports': '⚽', 'Entertainment': '🎬', 'Other': '📰',
    };
  }

  classifyCluster(cluster) {
    const text = (cluster.mainArticle.title + ' ' + (cluster.mainArticle.content || '').substring(0, 500)).toLowerCase();
    let bestCategory = 'Other';
    let bestScore = 0;
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) score++;
      }
      if (score > bestScore) { bestScore = score; bestCategory = category; }
    }
    return bestCategory;
  }

  generateSummary(content, maxSentences = 3) {
    if (!content) return '';
    const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 30);
    if (sentences.length <= maxSentences) return content;
    return sentences.slice(0, maxSentences).join(' ') + '...';
  }

  confidenceStars(score) {
    const stars = Math.max(1, Math.min(5, Math.round(score / 20)));
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  generateReport(clusters, query, contradictions = [], planner = null) {
    const timestamp = new Date().toISOString().replace('T', ' at ').substring(0, 19);
    const totalSources = clusters.reduce((sum, c) => sum + c.articles.length, 0);

    const categorized = {};
    for (const cluster of clusters) {
      const cat = this.classifyCluster(cluster);
      if (!categorized[cat]) categorized[cat] = [];
      categorized[cat].push(cluster);
    }

    const sections = [];
    sections.push(`# 🔬 ${query}`);
    sections.push('');
    sections.push(`*Research Report — Generated ${timestamp}*`);
    sections.push(`*${totalSources} sources analyzed across ${clusters.length} distinct stories*`);
    sections.push('');

    // Executive summary
    sections.push('## 📋 Executive Summary');
    sections.push('');
    const allTitles = clusters.slice(0, 5).map(c => c.mainArticle.title).filter(Boolean);
    if (allTitles.length > 0) {
      sections.push(`This report covers ${clusters.length} distinct stories from ${totalSources} sources on "${query}".`);
      sections.push('');
      sections.push('**Key stories:**');
      for (const title of allTitles) {
        sections.push(`- ${title}`);
      }
    }
    sections.push('');

    // Key takeaways
    sections.push('## 🎯 Key Takeaways');
    sections.push('');
    const topClusters = clusters.slice(0, Math.min(5, clusters.length));
    for (let i = 0; i < topClusters.length; i++) {
      const cluster = topClusters[i];
      const summary = this.generateSummary(cluster.mainArticle.content || cluster.mainArticle.snippet, 2);
      sections.push(`${i + 1}. **${cluster.mainArticle.title || 'Story ' + (i + 1)}** — ${summary}`);
    }
    sections.push('');

    // Category sections
    const categoryOrder = ['Technology', 'Business & Markets', 'World', 'Science & Health', 'Sports', 'Entertainment', 'Other'];
    for (const category of categoryOrder) {
      const catClusters = categorized[category];
      if (!catClusters || catClusters.length === 0) continue;
      const emoji = this.categoryEmojis[category] || '📰';
      sections.push(`## ${emoji} ${category}`);
      sections.push('');
      for (const cluster of catClusters) {
        sections.push(`### ${cluster.mainArticle.title || 'Untitled'}`);
        sections.push('');
        const summary = this.generateSummary(cluster.mainArticle.content || cluster.mainArticle.snippet);
        sections.push(`**Summary:** ${summary}`);
        sections.push('');
        sections.push(`**Confidence:** ${this.confidenceStars(cluster.confidence)}`);
        sections.push(`**Sources:** ${cluster.sources.join(', ')}`);
        if (cluster.articles.length > 1) {
          sections.push(`**Corroborated by:** ${cluster.articles.length} sources`);
        }
        if (cluster.mainArticle.url) {
          sections.push(`**Link:** ${cluster.mainArticle.url}`);
        }
        sections.push('');
        sections.push('---');
        sections.push('');
      }
    }

    // Contradictions
    if (contradictions.length > 0) {
      sections.push('## ⚠️ Contradictions Detected');
      sections.push('');
      for (const c of contradictions) {
        sections.push(`**${c.type}**`);
        sections.push(`- ${c.claim1.source}: "${c.claim1.text}"`);
        sections.push(`- ${c.claim2.source}: "${c.claim2.text}"`);
        if (c.ratio) sections.push(`- Discrepancy ratio: ${c.ratio}x`);
        sections.push('');
      }
    }

    // Sources
    sections.push('## 📚 Sources');
    sections.push('');
    const allArticles = clusters.flatMap(c => c.articles);
    const seenUrls = new Set();
    for (const article of allArticles) {
      if (article.url && !seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        sections.push(`- [${article.source || 'Source'}](${article.url}) — ${article.title || 'Untitled'}`);
      }
    }
    sections.push('');

    // Methodology
    sections.push('## 📊 Methodology');
    sections.push('');
    sections.push('- **Source Ranking:** Domain authority + content quality scoring');
    sections.push('- **Deduplication:** Semantic clustering with entity overlap detection');
    sections.push('- **Content Extraction:** Multi-strategy extraction (Readability → DOM selectors → paragraph extraction)');
    sections.push('- **Contradiction Detection:** Cross-source factual verification');
    sections.push('- **Coverage:** Iterative search until subtopic coverage threshold met');
    if (planner) {
      const coverage = planner.getCoverage();
      sections.push(`- **Coverage:** ${coverage.percentage}% (${coverage.covered}/${coverage.total} subtopics)`);
    }
    sections.push('');

    return sections.join('\n');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH PIPELINE — Main orchestrator with iterative search loop
// ═══════════════════════════════════════════════════════════════════════════════
class ResearchPipeline {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 4;
    this.maxResults = options.maxResults || 12;
    this.maxContentLength = options.maxContentLength || 12000;
    this.minContentLength = options.minContentLength || 300;
    this.similarityThreshold = options.similarityThreshold || 0.7;
    this.coverageThreshold = options.coverageThreshold || 70;
    this.maxIterations = options.maxIterations || 4;
    this.onProgress = options.onProgress || (() => {});
    this.abortController = null;

    this.sourceRanker = new SourceRanker();
    this.contentCleaner = new ContentCleaner();
    this.duplicateDetector = new DuplicateDetector();
    this.contradictionDetector = new ContradictionDetector();
    this.parallelFetcher = new ParallelFetcher(this.concurrency);
    this.reportGenerator = new ReportGenerator();

    this.duplicateDetector.similarityThreshold = this.similarityThreshold;
    this.allArticles = [];
    this.allUrls = new Set();
  }

  setProgressCallback(cb) {
    this.onProgress = cb;
  }

  cancel() {
    if (this.abortController) this.abortController.abort();
  }

  // ── Search ──────────────────────────────────────────────────────────────
  async search(query, engine = 'duckduckgo') {
    this.onProgress({ stage: 'searching', message: `Searching ${engine} for "${query}"...`, query });

    const searchUrl = engine === 'google'
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=20`
      : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: this.abortController?.signal,
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);

    const html = await res.text();
    const urls = this.extractSearchUrls(html, engine);

    this.onProgress({ stage: 'search_complete', message: `Found ${urls.length} results for "${query}"`, urls: urls.slice(0, 10), query });

    return urls.slice(0, this.maxResults * 2);
  }

  extractSearchUrls(html, engine) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const urls = [];
    const seen = new Set();

    if (engine === 'google') {
      const selectors = ['div.g a[href^="http"]', 'div.MjjYud a[href^="http"]', 'a[href^="/url?q="]'];
      for (const selector of selectors) {
        const links = doc.querySelectorAll(selector);
        for (const link of links) {
          let href = link.getAttribute('href');
          if (href.startsWith('/url?q=')) {
            href = decodeURIComponent(href.replace('/url?q=', '').split('&')[0]);
          }
          if (href.startsWith('http') && !href.includes('google.com') && !seen.has(href)) {
            seen.add(href);
            const title = link.querySelector('h3')?.textContent?.trim() || link.textContent?.trim()?.substring(0, 100) || '';
            urls.push({ url: href, title });
          }
        }
        if (urls.length >= this.maxResults * 2) break;
      }
    } else {
      const links = doc.querySelectorAll('a.result__a, a[class*="result"]');
      for (const link of links) {
        let href = link.getAttribute('href');
        if (href) {
          try {
            const urlObj = new URL(href, 'https://duckduckgo.com');
            if (urlObj.hostname === 'duckduckgo.com' && (urlObj.pathname === '/l/' || urlObj.pathname === '/m/')) {
              const uddg = urlObj.searchParams.get('uddg');
              if (uddg) href = decodeURIComponent(uddg);
            }
            if (href.startsWith('http') && !seen.has(href)) {
              seen.add(href);
              const title = link.textContent?.trim()?.substring(0, 100) || '';
              urls.push({ url: href, title });
            }
          } catch {}
        }
        if (urls.length >= this.maxResults * 2) break;
      }
    }

    return this.filterJunkUrls(urls);
  }

  filterJunkUrls(urlEntries) {
    const junkPatterns = [
      /\/archive\//, /\/category\//, /\/tag\//, /\/search/, /\/login/,
      /\/subscribe/, /\/privacy/, /\/terms/, /\/signup/, /\/register/,
      /\/account/, /\/cart/, /\/checkout/, /\/pricing/, /\/plans/,
      /\?page=\d+/, /\/page\/\d+/, /\.pdf$/, /\.doc$/, /\.ppt$/, /\.xls$/,
    ];
    const preferredPatterns = [
      /\/news\//, /\/article\//, /\/story\//, /\/post\//,
      /\/202[0-9]\//, /\/[0-9]{4}\/[0-9]{2}\//,
      /\/world\//, /\/politics\//, /\/business\//, /\/technology\//,
      /\/science\//, /\/health\//, /\/sports\//, /\/entertainment\//,
    ];

    return urlEntries.filter(entry => {
      const url = typeof entry === 'string' ? entry : entry.url;
      for (const pattern of junkPatterns) {
        if (pattern.test(url)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aUrl = typeof a === 'string' ? a : a.url;
      const bUrl = typeof b === 'string' ? b : b.url;
      const aScore = preferredPatterns.reduce((s, p) => s + (p.test(aUrl) ? 10 : 0), 0);
      const bScore = preferredPatterns.reduce((s, p) => s + (p.test(bUrl) ? 10 : 0), 0);
      return bScore - aScore;
    });
  }

  // ── Fetch & Extract ─────────────────────────────────────────────────────
  async fetchAndExtract(urlEntry, index) {
    const url = typeof urlEntry === 'string' ? urlEntry : urlEntry.url;
    const searchTitle = typeof urlEntry === 'object' ? urlEntry.title : '';

    this.onProgress({ stage: 'fetching', message: `Reading ${this.sourceRanker.getSourceName(url)}...`, url, index });

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
        signal: this.abortController?.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();
      this.onProgress({ stage: 'extracting', message: `Extracting from ${this.sourceRanker.getSourceName(url)}...`, url });

      const article = this.contentCleaner.extractWithFallback(html, url);

      if (!article || !article.content || article.content.length < this.minContentLength) {
        return { url, error: 'Content too short or extraction failed', score: 0, source: this.sourceRanker.getSourceName(url) };
      }

      const finalTitle = article.title || searchTitle || '';
      const enrichedArticle = {
        url,
        title: finalTitle,
        source: this.sourceRanker.getSourceName(url),
        sourceUrl: url,
        favicon: this.sourceRanker.getSourceFavicon(url),
        content: article.content.substring(0, this.maxContentLength),
        snippet: article.excerpt || article.content.substring(0, 300),
        byline: article.byline,
        publishedTime: article.publishedTime,
        score: this.sourceRanker.getCompositeScore(url, article),
        domainScore: this.sourceRanker.getDomainScore(url),
        contentQuality: this.sourceRanker.scoreContentQuality(article),
        length: article.content.length,
      };

      this.onProgress({ stage: 'extracted', message: `Extracted ${Math.round(enrichedArticle.length / 1000)}k chars from ${enrichedArticle.source}`, url, score: enrichedArticle.score });

      return enrichedArticle;
    } catch (err) {
      this.onProgress({ stage: 'fetch_error', message: `Failed to read ${this.sourceRanker.getSourceName(url)}: ${err.message}`, url });
      return { url, error: err.message, score: 0, source: this.sourceRanker.getSourceName(url) };
    }
  }

  // ── Process Articles ────────────────────────────────────────────────────
  processArticles(articles) {
    this.onProgress({ stage: 'ranking', message: 'Ranking sources by authority...' });

    const ranked = articles
      .filter(a => !a.error)
      .sort((a, b) => b.score - a.score);

    this.onProgress({ stage: 'clustering', message: 'Clustering duplicate stories...' });
    const clusters = this.duplicateDetector.clusterArticles(ranked);

    this.onProgress({ stage: 'contradiction_check', message: 'Checking for contradictions...' });
    const contradictions = [];
    for (const cluster of clusters) {
      const detected = this.contradictionDetector.detectContradictions(cluster);
      if (detected) contradictions.push(...detected);
    }

    return { clusters, contradictions, ranked };
  }

  // ── Main Pipeline with Iterative Search ─────────────────────────────────
  async run(query, engine = 'duckduckgo') {
    this.abortController = new AbortController();
    const planner = new ResearchPlanner(query);
    this.allArticles = [];
    this.allUrls = new Set();

    this.onProgress({
      stage: 'planning',
      message: `Planning research for "${query}"...`,
      subtopics: planner.subtopics.map(s => ({ id: s.id, label: s.label })),
    });

    // Iterative search loop
    while (planner.canContinue()) {
      planner.incrementIteration();
      const nextSearch = planner.getNextSearchQuery();
      if (!nextSearch) break;

      this.onProgress({
        stage: 'follow_up_search',
        message: `Searching for: ${nextSearch.label}`,
        iteration: planner.iteration,
        subtopic: nextSearch.label,
      });

      try {
        const urls = await this.search(nextSearch.query, engine);
        const newUrls = urls.filter(u => {
          const url = typeof u === 'string' ? u : u.url;
          if (this.allUrls.has(url)) return false;
          this.allUrls.add(url);
          return true;
        });

        if (newUrls.length === 0) {
          planner.markSubtopicCovered(nextSearch.subtopicId, []);
          continue;
        }

        this.onProgress({
          stage: 'parallel_fetch',
          message: `Reading ${newUrls.length} pages for "${nextSearch.label}"...`,
          urlCount: newUrls.length,
        });

        const articles = await this.parallelFetcher.fetchAll(
          newUrls,
          (url, i) => this.fetchAndExtract(url, i),
          (progress) => this.onProgress({ stage: 'fetching_progress', ...progress })
        );

        const successful = articles.filter(a => !a.error);
        this.allArticles.push(...successful);

        planner.markSubtopicCovered(nextSearch.subtopicId, successful.map(a => ({ source: a.source, url: a.url })));

        const coverage = planner.getCoverage();
        this.onProgress({
          stage: 'coverage_update',
          message: `Coverage: ${coverage.percentage}% (${coverage.covered}/${coverage.total} subtopics)`,
          coverage,
        });
      } catch (err) {
        if (err.name === 'AbortError') break;
        this.onProgress({ stage: 'search_error', message: `Search error: ${err.message}` });
      }
    }

    // Final processing
    if (this.allArticles.length === 0) {
      this.onProgress({ stage: 'complete', message: 'No articles found', report: '', clusters: [], contradictions: [], stats: { totalUrls: 0, successful: 0, clusters: 0 } });
      return { report: 'No articles found for this query.', clusters: [], contradictions: [], articles: [], stats: { totalUrls: 0, successful: 0, clusters: 0 } };
    }

    this.onProgress({ stage: 'processing', message: `Processing ${this.allArticles.length} articles...` });

    const { clusters, contradictions, ranked } = this.processArticles(this.allArticles);
    const coverage = planner.getCoverage();

    this.onProgress({ stage: 'generating', message: 'Generating research report...' });

    const report = this.reportGenerator.generateReport(clusters, query, contradictions, planner);

    const sourceSummary = this._buildSourceSummary(ranked);

    this.onProgress({
      stage: 'complete',
      message: 'Research complete!',
      report,
      clusters,
      contradictions,
      sourceSummary,
      coverage,
      stats: {
        totalUrls: this.allUrls.size,
        successful: ranked.length,
        clusters: clusters.length,
        iterations: planner.iteration,
        coverage: coverage.percentage,
      },
    });

    return {
      report,
      clusters,
      contradictions,
      articles: ranked,
      sourceSummary,
      coverage,
      stats: {
        totalUrls: this.allUrls.size,
        successful: ranked.length,
        clusters: clusters.length,
        iterations: planner.iteration,
        coverage: coverage.percentage,
      },
    };
  }

  _buildSourceSummary(ranked) {
    const sourceMap = new Map();
    for (const article of ranked) {
      const existing = sourceMap.get(article.source);
      if (existing) {
        existing.articleCount++;
        existing.totalScore += article.score;
      } else {
        sourceMap.set(article.source, {
          name: article.source,
          favicon: article.favicon || '',
          url: article.url,
          articleCount: 1,
          totalScore: article.score,
          avgScore: article.score,
          used: true,
        });
      }
    }
    return [...sourceMap.values()]
      .map(s => ({ ...s, avgScore: Math.round(s.totalScore / s.articleCount) }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }
}

module.exports = {
  ResearchPipeline,
  SourceRanker,
  ContentCleaner,
  ResearchPlanner,
  DuplicateDetector,
  ContradictionDetector,
  ParallelFetcher,
  ReportGenerator,
};
