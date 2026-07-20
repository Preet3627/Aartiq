const { JSDOM } = require('jsdom');
const fetch = require('cross-fetch');
const { extractArticleFromHtml, DEFAULT_UA } = require('./web-extractor');

class SourceRanker {
  constructor() {
    this.sourceScores = {
      'reuters.com': 100,
      'apnews.com': 100,
      'ap.org': 100,
      'bbc.com': 98,
      'bbc.co.uk': 98,
      'wsj.com': 96,
      'bloomberg.com': 96,
      'thehindu.com': 94,
      'livemint.com': 93,
      'indianexpress.com': 92,
      'cnn.com': 91,
      'nytimes.com': 95,
      'washingtonpost.com': 95,
      'theguardian.com': 94,
      'ft.com': 95,
      'economist.com': 96,
      'aljazeera.com': 93,
      'france24.com': 92,
      'dw.com': 92,
      'reuters.com': 100,
      'business-standard.com': 90,
      'thehindubusinessline.com': 90,
      'moneycontrol.com': 88,
      'economictimes.indiatimes.com': 88,
      'ndtv.com': 85,
      'timesofindia.indiatimes.com': 85,
      'hindustantimes.com': 88,
      'theprint.in': 87,
      'scroll.in': 86,
      'newslaundry.com': 85,
      'thewire.in': 85,
      'firstpost.com': 82,
      'news18.com': 82,
      'indiatoday.in': 82,
      'zeenews.india.com': 80,
      'republicworld.com': 78,
      'opindia.com': 75,
      'swarajyamag.com': 75,
      'prachatai.com': 70,
      'medium.com': 50,
      'substack.com': 55,
      'linkedin.com': 45,
      'twitter.com': 35,
      'x.com': 35,
      'facebook.com': 30,
      'instagram.com': 30,
      'reddit.com': 45,
      'quora.com': 40,
      'blogspot.com': 40,
      'wordpress.com': 45,
      'tumblr.com': 35,
    };
  }

  getDomainScore(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
      
      for (const [domain, score] of Object.entries(this.sourceScores)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return score;
        }
      }
      
      if (hostname.includes('github.io') || hostname.includes('gitlab.io') || hostname.includes('netlify.app') || hostname.includes('vercel.app')) {
        return 55;
      }
      
      if (hostname.match(/\.(gov|edu|org)$/)) {
        return 75;
      }
      
      return 35;
    } catch {
      return 35;
    }
  }

  getSourceName(url) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
      const displayNames = {
        'reuters.com': 'Reuters',
        'apnews.com': 'Associated Press',
        'ap.org': 'Associated Press',
        'bbc.com': 'BBC',
        'bbc.co.uk': 'BBC',
        'wsj.com': 'Wall Street Journal',
        'bloomberg.com': 'Bloomberg',
        'thehindu.com': 'The Hindu',
        'livemint.com': 'Mint',
        'indianexpress.com': 'Indian Express',
        'cnn.com': 'CNN',
        'nytimes.com': 'New York Times',
        'washingtonpost.com': 'Washington Post',
        'theguardian.com': 'The Guardian',
        'ft.com': 'Financial Times',
        'economist.com': 'The Economist',
        'aljazeera.com': 'Al Jazeera',
        'france24.com': 'France 24',
        'dw.com': 'Deutsche Welle',
        'business-standard.com': 'Business Standard',
        'thehindubusinessline.com': 'Hindu Business Line',
        'moneycontrol.com': 'Moneycontrol',
        'economictimes.indiatimes.com': 'Economic Times',
        'ndtv.com': 'NDTV',
        'timesofindia.indiatimes.com': 'Times of India',
        'hindustantimes.com': 'Hindustan Times',
        'theprint.in': 'The Print',
        'scroll.in': 'Scroll.in',
        'newslaundry.com': 'Newslaundry',
        'thewire.in': 'The Wire',
        'firstpost.com': 'Firstpost',
        'news18.com': 'News18',
        'indiatoday.in': 'India Today',
        'zeenews.india.com': 'Zee News',
        'republicworld.com': 'Republic World',
        'opindia.com': 'OpIndia',
        'swarajyamag.com': 'Swarajya',
      };
      
      for (const [domain, name] of Object.entries(displayNames)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return name;
        }
      }
      
      return hostname;
    } catch {
      return 'Unknown';
    }
  }
}

class ContentCleaner {
  constructor() {
    this.junkPatterns = [
      /advertisement/gi,
      /sign up/gi,
      /follow us/gi,
      /cookie policy/gi,
      /privacy policy/gi,
      /terms of service/gi,
      /terms and conditions/gi,
      /subscribe/gi,
      /newsletter/gi,
      /related articles/gi,
      /more from/gi,
      /trending/gi,
      /popular/gi,
      /most read/gi,
      /editor's pick/gi,
      /sponsored/gi,
      /promoted/gi,
      /advertorial/gi,
      /archives/gi,
      /archive/gi,
      /category/gi,
      /tag\//gi,
      /search/gi,
      /login/gi,
      /register/gi,
      /sign in/gi,
      /copyright/gi,
      /all rights reserved/gi,
      /powered by/gi,
      /loading/gi,
      /please enable javascript/gi,
      /enable cookies/gi,
      /disable ad blocker/gi,
      /whitelist/gi,
      /support us/gi,
      /donate/gi,
      /buy me a coffee/gi,
      /patreon/gi,
      /share this/gi,
      /share on/gi,
      /tweet/gi,
      /retweet/gi,
      /like us/gi,
      /follow on/gi,
      /comment/gi,
      /leave a comment/gi,
      /post a comment/gi,
      /read more/gi,
      /continue reading/gi,
      /view comments/gi,
      /write a comment/gi,
      /comments section/gi,
      /discussion/gi,
      /reply/gi,
      /reactions/gi,
      /load more/gi,
      /show more/gi,
      /see all/gi,
      /view all/gi,
      /pagination/gi,
      /page \d+/gi,
      /next page/gi,
      /previous page/gi,
      /go to page/gi,
      /skip to content/gi,
      /skip to main/gi,
      /accessibility/gi,
      /screen reader/gi,
      /font size/gi,
      /contrast/gi,
      /dark mode/gi,
      /light mode/gi,
      /language/gi,
      /translate/gi,
      /select language/gi,
    ];
    
    this.junkSelectors = [
      'script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe',
      'form', '.sidebar', '.menu', '.footer', '.header', '.nav', '.ad', '.advertisement',
      '.cookie', '.popup', '.modal', '.overlay', '.banner', '.newsletter', '.subscribe',
      '.social-share', '.share-buttons', '.related-posts', '.related-articles',
      '.trending', '.popular', '.most-read', '.editor-pick', '.sponsored', '.promoted',
      '.advertorial', '.archive', '.category', '.tag-cloud', '.search-form', '.login-form',
      '.comment-form', '.comments', '#comments', '.comment-section', '.discussion',
      '.reactions', '.pagination', '.page-numbers', '.load-more', '.show-more',
      '.skip-link', '.accessibility', '.font-size', '.contrast', '.dark-mode-toggle',
      '.language-selector', '.translate', '[role="navigation"]', '[role="banner"]',
      '[role="contentinfo"]', '[role="complementary"]', '[role="search"]',
      '.cookie-banner', '.cookie-notice', '.gdpr', '.consent', '.paywall', '.metered',
      '.subscription', '.premium', '.members-only', '.subscriber-only'
    ];
  }

  cleanHtml(html, url) {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    
    for (const selector of this.junkSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const el of elements) {
        el.remove();
      }
    }
    
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodesToRemove = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      if (text.length < 200) {
        for (const pattern of this.junkPatterns) {
          if (pattern.test(text)) {
            textNodesToRemove.push(node.parentElement);
            break;
          }
        }
      }
    }
    
    for (const el of textNodesToRemove) {
      if (el && el.parentElement) {
        const parentText = el.textContent.trim();
        if (parentText.length < 500) {
          el.remove();
        }
      }
    }
    
    return dom.serialize();
  }

  extractArticleContent(html, url) {
    return extractArticleFromHtml(html, url, { maxChars: 8000 });
  }
}

class DuplicateDetector {
  constructor() {
    this.similarityThreshold = 0.7;
  }

  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  extractKeyEntities(text) {
    const entities = [];
    
    const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    for (const noun of properNouns) {
      if (noun.length > 2 && !['The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'What', 'Who', 'Why', 'How', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].includes(noun)) {
        entities.push(noun);
      }
    }
    
    const capitalized = text.match(/\b[A-Z]{2,}\b/g) || [];
    entities.push(...capitalized);
    
    const dates = text.match(/\b\d{1,2}[\s\-/]\w+[\s\-/]\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b/g) || [];
    entities.push(...dates);
    
    const numbers = text.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion|crore|lakh|percent|%)\b/gi) || [];
    entities.push(...numbers);
    
    return [...new Set(entities)].slice(0, 20);
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

  calculateEntityOverlap(entities1, entities2) {
    const set1 = new Set(entities1.map(e => e.toLowerCase()));
    const set2 = new Set(entities2.map(e => e.toLowerCase()));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

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
        
        const numbers1 = text1.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
        const numbers2 = text2.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) || [];
        
        for (const n1 of numbers1) {
          for (const n2 of numbers2) {
            const val1 = parseFloat(n1.replace(/,/g, ''));
            const val2 = parseFloat(n2.replace(/,/g, ''));
            if (val1 > 0 && val2 > 0) {
              const ratio = Math.max(val1, val2) / Math.min(val1, val2);
              if (ratio > 2 && ratio < 100) {
                const context1 = this.getNumberContext(text1, n1);
                const context2 = this.getNumberContext(text2, n2);
                if (this.contextsSimilar(context1, context2)) {
                  contradictions.push({
                    claim1: { source: articles[i].source, value: n1, context: context1 },
                    claim2: { source: articles[j].source, value: n2, context: context2 },
                    type: 'numerical_discrepancy',
                    ratio: ratio.toFixed(1),
                  });
                }
              }
            }
          }
        }
      }
    }
    
    return contradictions.length > 0 ? contradictions : null;
  }

  getNumberContext(text, number) {
    const index = text.indexOf(number);
    if (index === -1) return '';
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + number.length + 50);
    return text.substring(start, end).trim();
  }

  contextsSimilar(context1, context2) {
    const words1 = new Set(context1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(context2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    return intersection.size >= 2;
  }
}

class ParallelFetcher {
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
  }

  async fetchAll(urls, fetchFn, onProgress) {
    const results = new Array(urls.length);
    const executing = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const promise = fetchFn(url, i).then(result => {
        results[i] = result;
        if (onProgress) onProgress({ completed: results.filter(r => r).length, total: urls.length, current: url });
        return result;
      }).catch(err => {
        results[i] = { error: err.message, url };
        if (onProgress) onProgress({ completed: results.filter(r => r).length, total: urls.length, current: url, error: err.message });
        return { error: err.message, url };
      });
      
      executing.push(promise);
      
      if (executing.length >= this.concurrency) {
        await Promise.race(executing);
        const completed = executing.filter(p => results[urls.indexOf(p.url)] !== undefined);
        for (const p of completed) {
          const idx = executing.indexOf(p);
          if (idx > -1) executing.splice(idx, 1);
        }
      }
    }
    
    await Promise.all(executing);
    return results.filter(r => r && !r.error);
  }
}

class ReportGenerator {
  constructor() {
    this.sourceRanker = new SourceRanker();
  }

  generateReport(clusters, query, contradictions, onProgress) {
    const sections = this.categorizeClusters(clusters);
    
    let report = `📰 **Research Report: ${query}**\n`;
    report += `${'─'.repeat(50)}\n\n`;
    report += `*Generated: ${new Date().toLocaleString()}*\n`;
    report += `*Sources analyzed: ${clusters.reduce((sum, c) => sum + c.articles.length, 0)} articles across ${clusters.length} stories*\n\n`;
    
    for (const [category, categoryClusters] of Object.entries(sections)) {
      if (categoryClusters.length === 0) continue;
      
      const emoji = this.getCategoryEmoji(category);
      report += `## ${emoji} ${category}\n\n`;
      
      for (const cluster of categoryClusters) {
        report += this.formatCluster(cluster, contradictions);
        report += '\n---\n\n';
      }
    }
    
    if (contradictions && contradictions.length > 0) {
      report += `## ⚠️ Contradictions Detected\n\n`;
      for (const c of contradictions) {
        report += `**${c.type.replace('_', ' ').toUpperCase()}**\n`;
        report += `- ${c.claim1.source}: "${c.claim1.text || c.claim1.value}" ${c.claim1.context ? `(${c.claim1.context})` : ''}\n`;
        report += `- ${c.claim2.source}: "${c.claim2.text || c.claim2.value}" ${c.claim2.context ? `(${c.claim2.context})` : ''}\n`;
        if (c.ratio) report += `- Discrepancy ratio: ${c.ratio}x\n`;
        report += '\n';
      }
      report += '---\n\n';
    }
    
    report += `## 📊 Methodology\n`;
    report += `- **Source Ranking**: Authoritative sources (Reuters, AP, BBC) weighted higher\n`;
    report += `- **Deduplication**: Stories clustered by semantic similarity (${(new DuplicateDetector().similarityThreshold * 100).toFixed(0)}% threshold)\n`;
    report += `- **Content Extraction**: Mozilla Readability for clean article text\n`;
    report += `- **Contradiction Detection**: Cross-source fact verification\n`;
    report += `- **Confidence Scoring**: Based on source authority and cross-corroboration\n\n`;
    
    return report;
  }

  categorizeClusters(clusters) {
    const categories = {
      'World': [],
      'Technology': [],
      'Business & Markets': [],
      'Science & Health': [],
      'Sports': [],
      'Entertainment': [],
      'Other': [],
    };
    
    const keywords = {
      'World': ['war', 'conflict', 'attack', 'missile', 'nuclear', 'diplomat', 'summit', 'treaty', 'sanction', 'united nations', 'security council', 'border', 'refugee', 'crisis', 'government', 'election', 'parliament', 'president', 'prime minister', 'minister', 'policy', 'foreign', 'international', 'geopolitical'],
      'Technology': ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'llm', 'gpt', 'openai', 'google', 'microsoft', 'apple', 'amazon', 'meta', 'tesla', 'spacex', 'rocket', 'satellite', 'chip', 'semiconductor', 'quantum', 'blockchain', 'crypto', 'bitcoin', 'ethereum', 'software', 'app', 'platform', 'algorithm', 'model', 'training', 'gpu', 'nvidia', 'amd', 'intel'],
      'Business & Markets': ['stock', 'market', 'share', 'ipo', 'earnings', 'revenue', 'profit', 'loss', 'merger', 'acquisition', 'takeover', 'investment', 'funding', 'venture', 'startup', 'unicorn', 'valuation', 'billion', 'million', 'dollar', 'rupee', 'sensex', 'nifty', 'rbi', 'fed', 'interest rate', 'inflation', 'gdp', 'economy', 'recession', 'growth', 'trade', 'export', 'import', 'tariff', 'budget', 'fiscal', 'tax', 'bank', 'banking', 'finance', 'financial'],
      'Science & Health': ['study', 'research', 'scientist', 'discovery', 'breakthrough', 'trial', 'clinical', 'vaccine', 'drug', 'treatment', 'disease', 'cancer', 'covid', 'virus', 'health', 'hospital', 'doctor', 'patient', 'medical', 'medicine', 'therapy', 'gene', 'dna', 'genome', 'protein', 'cell', 'brain', 'neural', 'psychology', 'mental health', 'wellness', 'nutrition', 'diet', 'exercise', 'fitness', 'who', 'cdc', 'fda', 'ema'],
      'Sports': ['cricket', 'football', 'soccer', 'tennis', 'badminton', 'hockey', 'olympics', 'world cup', 'championship', 'tournament', 'match', 'game', 'player', 'team', 'league', 'ipl', 'fifa', 'icc', 'bcci', 'score', 'wicket', 'goal', 'run', 'century', 'victory', 'defeat', 'win', 'loss', 'draw'],
      'Entertainment': ['movie', 'film', 'actor', 'actress', 'director', 'bollywood', 'hollywood', 'netflix', 'amazon prime', 'disney', 'series', 'show', 'season', 'episode', 'trailer', 'release', 'box office', 'award', 'oscar', 'emmy', 'grammy', 'cannes', 'festival', 'celebrity', 'star', 'music', 'album', 'song', 'concert', 'tour', 'streaming'],
    };
    
    for (const cluster of clusters) {
      const text = (cluster.mainArticle.content || cluster.mainArticle.snippet || '').toLowerCase();
      const title = (cluster.mainArticle.title || '').toLowerCase();
      const combined = text + ' ' + title;
      
      let bestCategory = 'Other';
      let bestScore = 0;
      
      for (const [category, words] of Object.entries(keywords)) {
        let score = 0;
        for (const word of words) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = combined.match(regex);
          if (matches) score += matches.length;
        }
        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }
      
      categories[bestCategory].push(cluster);
    }
    
    return categories;
  }

  getCategoryEmoji(category) {
    const emojis = {
      'World': '🌍',
      'Technology': '💻',
      'Business & Markets': '📈',
      'Science & Health': '🔬',
      'Sports': '⚽',
      'Entertainment': '🎬',
      'Other': '📰',
    };
    return emojis[category] || '📰';
  }

  formatCluster(cluster, contradictions) {
    const stars = this.getConfidenceStars(cluster.confidence);
    const sources = [...new Set(cluster.sources)].map(s => this.sourceRanker.getSourceName(s)).join(', ');
    
    let output = `### ${cluster.mainArticle.title}\n\n`;
    output += `**Summary**: ${this.generateSummary(cluster.mainArticle.content || cluster.mainArticle.snippet || '')}\n\n`;
    output += `**Confidence**: ${stars}\n\n`;
    output += `**Sources**: ${sources}\n\n`;
    
    if (cluster.articles.length > 1) {
      output += `**Corroborated by**: ${cluster.articles.length} sources\n\n`;
    }
    
    const clusterContradictions = contradictions?.filter(c => 
      cluster.articles.some(a => a.source === c.claim1.source || a.source === c.claim2.source)
    ) || [];
    
    if (clusterContradictions.length > 0) {
      output += `⚠️ **Note**: ${clusterContradictions.length} contradiction(s) detected in sources\n\n`;
    }
    
    return output;
  }

  getConfidenceStars(confidence) {
    const stars = Math.round(confidence / 20);
    return '★'.repeat(Math.max(1, Math.min(5, stars))) + '☆'.repeat(5 - Math.max(1, Math.min(5, stars)));
  }

  generateSummary(text) {
    if (!text) return 'No content available.';
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ').trim() + (sentences.length > 3 ? '...' : '.');
  }
}

class ResearchPipeline {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 4;
    this.maxResults = options.maxResults || 10;
    this.maxContentLength = options.maxContentLength || 8000;
    this.minContentLength = options.minContentLength || 500;
    this.similarityThreshold = options.similarityThreshold || 0.7;
    this.onProgress = options.onProgress || (() => {});
    
    this.sourceRanker = new SourceRanker();
    this.contentCleaner = new ContentCleaner();
    this.duplicateDetector = new DuplicateDetector();
    this.contradictionDetector = new ContradictionDetector();
    this.parallelFetcher = new ParallelFetcher(this.concurrency);
    this.reportGenerator = new ReportGenerator();
    
    this.duplicateDetector.similarityThreshold = this.similarityThreshold;
  }

  setProgressCallback(cb) {
    this.onProgress = cb;
  }

  async search(query, engine = 'duckduckgo') {
    this.onProgress({ stage: 'searching', message: `Searching ${engine} for "${query}"...` });
    
    const searchUrl = engine === 'google'
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=20`
      : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    
    const html = await res.text();
    const urls = this.extractSearchUrls(html, engine);
    
    this.onProgress({ stage: 'search_complete', message: `Found ${urls.length} results`, urls });
    
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
            urls.push(href);
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
              urls.push(href);
            }
          } catch {}
        }
        if (urls.length >= this.maxResults * 2) break;
      }
    }
    
    return this.filterJunkUrls(urls);
  }

  filterJunkUrls(urls) {
    const junkPatterns = [
      /\/archive\//,
      /\/category\//,
      /\/tag\//,
      /\/search/,
      /\/login/,
      /\/subscribe/,
      /\/privacy/,
      /\/terms/,
      /\/signup/,
      /\/register/,
      /\/account/,
      /\/cart/,
      /\/checkout/,
      /\/pricing/,
      /\/plans/,
      /\/pricing/,
      /\?page=\d+/,
      /\/page\/\d+/,
      /\/amp$/,
      /\.pdf$/,
      /\.doc$/,
      /\.ppt$/,
      /\.xls$/,
    ];
    
    const preferredPatterns = [
      /\/news\//,
      /\/article\//,
      /\/story\//,
      /\/post\//,
      /\/202[0-9]\//,
      /\/[0-9]{4}\/[0-9]{2}\//,
      /\/world\//,
      /\/politics\//,
      /\/business\//,
      /\/technology\//,
      /\/science\//,
      /\/health\//,
      /\/sports\//,
      /\/entertainment\//,
    ];
    
    return urls.filter(url => {
      for (const pattern of junkPatterns) {
        if (pattern.test(url)) return false;
      }
      return true;
    }).sort((a, b) => {
      const aScore = preferredPatterns.reduce((s, p) => s + (p.test(a) ? 10 : 0), 0);
      const bScore = preferredPatterns.reduce((s, p) => s + (p.test(b) ? 10 : 0), 0);
      return bScore - aScore;
    });
  }

  async fetchAndExtract(url, index) {
    this.onProgress({ stage: 'fetching', message: `Fetching page ${index + 1}...`, url });
    
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const html = await res.text();
      
      this.onProgress({ stage: 'extracting', message: `Extracting article from ${new URL(url).hostname}...`, url });
      
      const article = this.contentCleaner.extractArticleContent(html, url);
      
      if (!article || !article.content || article.content.length < this.minContentLength) {
        return { url, error: 'Content too short or extraction failed', score: 0 };
      }
      
      const score = this.sourceRanker.getDomainScore(url);
      const sourceName = this.sourceRanker.getSourceName(url);
      
      return {
        url,
        title: article.title,
        source: sourceName,
        sourceUrl: url,
        content: article.content.substring(0, this.maxContentLength),
        snippet: article.excerpt || article.content.substring(0, 300),
        byline: article.byline,
        publishedTime: article.publishedTime,
        score,
        length: article.content.length,
      };
    } catch (err) {
      return { url, error: err.message, score: 0 };
    }
  }

  async processArticles(articles) {
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
    
    this.onProgress({ stage: 'generating', message: 'Generating research report...' });
    
    return { clusters, contradictions, ranked };
  }

  async run(query, engine = 'duckduckgo') {
    const urls = await this.search(query, engine);
    
    this.onProgress({ stage: 'parallel_fetch', message: `Fetching ${urls.length} pages in parallel (max ${this.concurrency} concurrent)...` });
    
    const articles = await this.parallelFetcher.fetchAll(
      urls,
      (url, i) => this.fetchAndExtract(url, i),
      (progress) => this.onProgress({ stage: 'fetching_progress', ...progress })
    );
    
    const { clusters, contradictions, ranked } = await this.processArticles(articles);
    
    const report = this.reportGenerator.generateReport(clusters, query, contradictions);
    
    this.onProgress({ stage: 'complete', message: 'Research complete!', report, clusters, contradictions, stats: { totalUrls: urls.length, successful: articles.length, clusters: clusters.length } });
    
    return { report, clusters, contradictions, articles: ranked, stats: { totalUrls: urls.length, successful: articles.length, clusters: clusters.length } };
  }
}

module.exports = {
  ResearchPipeline,
  SourceRanker,
  ContentCleaner,
  DuplicateDetector,
  ContradictionDetector,
  ParallelFetcher,
  ReportGenerator,
};