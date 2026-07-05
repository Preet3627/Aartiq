const fetch = require('cross-fetch');

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
      case 'brave': return this._searchBrave(query, count);
      case 'tavily': return this._searchTavily(query, count);
      case 'serp': return this._searchSerp(query, count);
      case 'duckduckgo': return this._searchDuckDuckGo(query, count);
      default: return this._searchGoogle(query, count);
    }
  }

  _detectBestProvider() {
    if (this._getKey('GOOGLE_API_KEY') && this._getKey('GOOGLE_SEARCH_ENGINE_ID')) return 'google';
    if (this._getKey('BRAVE_API_KEY')) return 'brave';
    if (this._getKey('TAVILY_API_KEY')) return 'tavily';
    if (this._getKey('SERP_API_KEY')) return 'serp';
    return 'duckduckgo';
  }

  getAvailableProviders() {
    const providers = ['duckduckgo'];
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
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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

  async searchForContext(query, provider) {
    try {
      const results = await this.search(query, provider, 5);
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
