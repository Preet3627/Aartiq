const fetch = require('cross-fetch');
const { JSDOM } = require('jsdom');
const { fetchPageContent: sharedFetchPageContent, DEFAULT_UA } = require('./web-extractor');

class WebSearchProvider {
  constructor() {
    this.keys = {};
  }

  configure(keys) {
    this.keys = { ...this.keys, ...keys };
  }

  _getKey(name) {
    return this.keys[name] || process.env[name] || '';
  }

  async search(query, provider, count) {
    provider = provider || this._detectBestProvider();
    count = count || 8;

    switch (provider) {
      case 'google': return this._searchGoogle(query, count);
      case 'googlescrape': return this._searchGoogleScrape(query, count);
      case 'brave': return this._searchBrave(query, count);
      case 'tavily': return this._searchTavily(query, count);
      case 'serp': return this._searchSerp(query, count);
      case 'duckduckgo': return this._searchDuckDuckGo(query, count);
      case 'youtube': return this._searchYouTube(query, count);
      default: return this._searchGoogle(query, count);
    }
  }

  _detectBestProvider() {
    if (this._getKey('GOOGLE_API_KEY') && this._getKey('GOOGLE_SEARCH_ENGINE_ID')) return 'google';
    if (this._getKey('BRAVE_API_KEY')) return 'brave';
    if (this._getKey('TAVILY_API_KEY')) return 'tavily';
    if (this._getKey('SERP_API_KEY')) return 'serp';
    return 'googlescrape';
  }

  getAvailableProviders() {
    const providers = ['googlescrape', 'duckduckgo'];
    if (this._getKey('GOOGLE_API_KEY') && this._getKey('GOOGLE_SEARCH_ENGINE_ID')) providers.push('google');
    if (this._getKey('BRAVE_API_KEY')) providers.push('brave');
    if (this._getKey('TAVILY_API_KEY')) providers.push('tavily');
    if (this._getKey('SERP_API_KEY')) providers.push('serp');
    return providers;
  }

  async _searchGoogle(query, count) {
    const apiKey = this._getKey('GOOGLE_API_KEY');
    const searchEngineId = this._getKey('GOOGLE_SEARCH_ENGINE_ID');
    if (!apiKey || !searchEngineId) throw new Error('Google API Key and Search Engine ID not configured');

    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${searchEngineId}&num=${Math.min(count, 10)}`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Search error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.items || []).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
    }));
  }

  async _searchGoogleScrape(query, count) {
    try {
      const res = await fetch(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${Math.min(count, 20)}&hl=en`,
        {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
          },
        }
      );

      if (!res.ok) {
        if (res.status === 429) {
          console.warn('[WebSearch] Google returned 429 (rate limited), falling back to DuckDuckGo');
          return this._searchDuckDuckGo(query, count);
        }
        throw new Error(`Google Search scrape error ${res.status}`);
      }

      const html = await res.text();
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const results = [];

      // Multiple selector strategies to handle Google DOM changes
      const selectors = [
        // Primary: modern div.g containers
        'div.g',
        // Fallback: newer container class
        'div.MjjYud',
        // Fallback: search result with role
        'div[jscontroller][role="heading"] ~ div',
        // Fallback: any div containing h3 within a search result
        'div.sr-only ~ div.g',
      ];

      let blocks = [];
      for (const sel of selectors) {
        blocks = [...doc.querySelectorAll(sel)];
        if (blocks.length > 0) break;
      }

      for (const block of blocks) {
        if (results.length >= count) break;

        // Try multiple anchor selectors
        let anchor = block.querySelector('a[href^="http"]:not([href*="google.com"])');
        if (!anchor) anchor = block.querySelector('a[jsname="UWckNb"]');
        if (!anchor) anchor = block.querySelector('a[href^="/url?q="]');
        if (!anchor) continue;

        // Extract title from h3
        const titleEl = block.querySelector('h3');
        if (!titleEl) continue;
        const title = titleEl.textContent.trim();
        if (!title) continue;

        // Extract URL
        let url = anchor.getAttribute('href') || '';
        if (url.startsWith('/url?q=')) {
          url = decodeURIComponent(url.replace('/url?q=', '').split('&')[0]);
        }
        if (!url.startsWith('http')) continue;

        // Try multiple snippet selectors
        const snippetSelectors = [
          'div.VwiC3b',
          'div[data-sncf]',
          'span.st',
          'div.lEBKkf',
          'div[role="heading"] + div',
        ];
        let snippet = '';
        for (const ss of snippetSelectors) {
          const el = block.querySelector(ss);
          if (el) {
            snippet = el.textContent.trim();
            break;
          }
        }

        // Deduplicate by URL
        if (!results.some(r => r.url === url)) {
          results.push({ title, url, snippet });
        }
      }

      // If no results with CSS selectors, try regex fallback
      if (results.length === 0) {
        return this._searchGoogleScrapeFallback(html, count);
      }

      return results;
    } catch (e) {
      console.warn(`[WebSearch] Google scrape failed: ${e.message}`);
      try {
        return await this._searchDuckDuckGo(query, count);
      } catch {
        return [];
      }
    }
  }

  _searchGoogleScrapeFallback(html, count) {
    const results = [];
    const patterns = [
      // Pattern: <a href="/url?q=URL"> with <h3> title
      /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi,
      // Pattern: Direct links with h3
      /<a[^>]+href="(https?:\/\/(?!www\.google\.)[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && results.length < count) {
        let url = match[1].trim();
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        if (!title || !url.startsWith('http')) continue;

        // Extract snippet near this result
        const beforeText = html.substring(Math.max(0, match.index - 500), match.index);
        const afterText = html.substring(match.index, match.index + 1000);
        const context = beforeText + afterText;

        let snippet = '';
        const snippetMatch = context.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (snippetMatch) {
          snippet = snippetMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        if (!results.some(r => r.url === url)) {
          results.push({ title, url, snippet });
        }
      }
      if (results.length > 0) break;
    }

    return results;
  }

  async _searchBrave(query, count) {
    const apiKey = this._getKey('BRAVE_API_KEY');
    if (!apiKey) throw new Error('BRAVE_API_KEY not configured');

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      { headers: { 'X-Subscription-Token': apiKey } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Brave Search error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.web?.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
    }));
  }

  async _searchTavily(query, count) {
    const apiKey = this._getKey('TAVILY_API_KEY');
    if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: count,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tavily Search error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
    }));
  }

  async _searchSerp(query, count) {
    const apiKey = this._getKey('SERP_API_KEY');
    if (!apiKey) throw new Error('SERP_API_KEY not configured');

    const res = await fetch(
      `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${count}&engine=google`
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SerpAPI error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.organic_results || []).map(r => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
    }));
  }

  async _searchDuckDuckGo(query, count) {
    try {
      const htmlRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }
      );

      if (!htmlRes.ok) {
        throw new Error(`DuckDuckGo HTML search error ${htmlRes.status}`);
      }

      const html = await htmlRes.text();
      const results = [];
      const snippets = [];

      // Try multiple HTML patterns (DDG changes their markup frequently)
      const patterns = [
        // Pattern 1: Modern DDG result links (class="result__a")
        { link: /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
          snippet: /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi },
        // Pattern 2: Article result items with heading links
        { link: /<article[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
          snippet: /<article[^>]*>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi },
      ];

      for (const pattern of patterns) {
        if (results.length >= count) break;
        snippets.length = 0;

        // Collect snippets
        let sMatch;
        while ((sMatch = pattern.snippet.exec(html)) !== null) {
          snippets.push(sMatch[1].replace(/<[^>]*>/g, '').trim());
        }

        // Collect links
        let linkMatch;
        while ((linkMatch = pattern.link.exec(html)) !== null && results.length < count) {
          let rawUrl = linkMatch[1].trim();
          const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
          if (!title) continue;
          const cleanUrl = this._cleanDdgUrl(rawUrl);
          if (!cleanUrl || results.some(r => r.url === cleanUrl)) continue;
          const snippet = snippets[results.length] || '';
          results.push({ title, url: cleanUrl, snippet });
        }
      }

      return results;
    } catch (e) {
      console.warn(`[WebSearch] DuckDuckGo HTML search failed: ${e.message}`);
      try {
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&t=aartiq`
        );
        if (!res.ok) return [];
        const data = await res.json();
        const fallback = [];
        if (data.RelatedTopics) {
          for (const topic of data.RelatedTopics.slice(0, count)) {
            if (topic.Text && topic.FirstURL) {
              fallback.push({
                title: topic.Text.split(' - ')[0] || 'Related Topic',
                url: topic.FirstURL,
                snippet: topic.Text,
              });
            }
          }
        }
        if (data.Abstract) {
          fallback.unshift({
            title: data.Headline || data.Heading || 'Summary',
            url: data.AbstractURL || '',
            snippet: data.Abstract,
          });
        }
        return fallback;
      } catch (e2) {
        console.warn(`[WebSearch] DuckDuckGo API fallback also failed: ${e2.message}`);
        return [];
      }
    }
  }

  _cleanDdgUrl(rawUrl) {
    try {
      const decoded = rawUrl.replace(/&amp;/g, '&');
      const urlObj = new URL(decoded, 'https://duckduckgo.com');
      if (urlObj.hostname === 'duckduckgo.com' && urlObj.pathname === '/l/') {
        const uddg = urlObj.searchParams.get('uddg');
        if (uddg) return decodeURIComponent(uddg);
      }
      if (urlObj.hostname === 'duckduckgo.com' && decoded.includes('uddg=')) {
        const match = decoded.match(/uddg=([^&]+)/);
        if (match) return decodeURIComponent(match[1]);
      }
      return decoded;
    } catch {
      return rawUrl;
    }
  }

  async fetchPageContent(url, maxChars = 8000) {
    return sharedFetchPageContent(url, { maxChars });
  }

  async _searchYouTube(query, count) {
    try {
      const res = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`,
        {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        }
      );
      if (!res.ok) throw new Error(`YouTube search error ${res.status}`);

      const html = await res.text();
      const results = [];

      // YouTube embeds initial data in ytInitialData JSON
      const dataMatch = html.match(/var ytInitialData\s*=\s*({[\s\S]*?});\s*<\/script>/);
      if (dataMatch) {
        try {
          const data = JSON.parse(dataMatch[1]);
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          for (const section of contents) {
            const items = section?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              if (results.length >= count) break;
              const vid = item?.videoRenderer;
              if (!vid) continue;
              const videoId = vid.videoId;
              const title = vid.title?.runs?.[0]?.text || '';
              const url = `https://www.youtube.com/watch?v=${videoId}`;
              const snippet = vid.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r) => r.text).join('') ||
                vid.descriptionSnippet?.runs?.map((r) => r.text).join('') || '';
              const channel = vid.ownerText?.runs?.[0]?.text || '';
              const length = vid.lengthText?.simpleText || '';
              const thumbnail = vid.thumbnail?.thumbnails?.[vid.thumbnail.thumbnails.length - 1]?.url || '';

              results.push({
                title,
                url,
                snippet: snippet || channel,
                videoId,
                channel,
                length,
                thumbnail,
              });
            }
          }
        } catch (e) {
          console.warn('[WebSearch] YouTube JSON parse failed:', e.message);
        }
      }

      // Fallback: regex extraction from raw HTML
      if (results.length === 0) {
        const urlPattern = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
        const seen = new Set();
        let match;
        while ((match = urlPattern.exec(html)) !== null && results.length < count) {
          const videoId = match[1];
          if (seen.has(videoId)) continue;
          seen.add(videoId);
          results.push({
            title: `YouTube Video ${videoId}`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            snippet: '',
            videoId,
            channel: '',
            length: '',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          });
        }
      }

      return results;
    } catch (e) {
      console.warn(`[WebSearch] YouTube search failed: ${e.message}`);
      return [];
    }
  }

  async searchForContext(query, provider) {
    try {
      const results = await this.search(query, provider, 1);
      return results
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
        .join('\n\n');
    } catch (e) {
      console.warn(`[WebSearch] ${e.message}`);
      return '';
    }
  }
}

module.exports = { WebSearchProvider };
