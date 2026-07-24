function isValidUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Already has protocol
  if (/^https?:\/\//i.test(trimmed)) {
    try { new URL(trimmed); return true; } catch { return false; }
  }

  // Pure IP address (IPv4)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(trimmed)) return true;

  // localhost
  if (/^localhost(:\d+)?$/i.test(trimmed)) return true;

  // Domain with TLD (has dots)
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:[0-9]+)?(\/.*)?$/.test(trimmed)) return true;

  // Domain without TLD but with path or port (e.g., localhost:3000/test)
  if (/^[a-zA-Z0-9-]+:\d+(\/.*)?$/.test(trimmed)) return true;
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed)) return true;

  // Known local hostnames
  if (/^(localhost|local\.host|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?(\/.*)?$/i.test(trimmed)) return true;

  return false;
}

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Already has protocol
  if (/^https?:\/\//i.test(trimmed)) {
    try { new URL(trimmed); return trimmed; } catch { return ''; }
  }

  // IP address
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // localhost
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Domain-like (has a dot and looks like a hostname)
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:\d+)?(\/.*)?$/.test(trimmed) &&
      /\.\w{2,}/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Domain without recognized TLD but with port (e.g., myserver:8080)
  if (/^[a-zA-Z0-9-]+:\d+(\/.*)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Not a URL — return as-is (caller should treat as search query)
  return '';
}

function isSearchQuery(input) {
  return !isValidUrl(input);
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function getSearchUrl(query, engine = 'google') {
  const engines = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=',
    yandex: 'https://yandex.com/search/?text=',
    baidu: 'https://www.baidu.com/s?wd=',
    ecosia: 'https://www.ecosia.org/search?q=',
  };
  const base = engines[engine] || engines.google;
  return `${base}${encodeURIComponent(query)}`;
}

module.exports = { isValidUrl, normalizeUrl, isSearchQuery, getDomain, getSearchUrl };
