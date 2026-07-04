import { DANGEROUS_PATTERNS, AI_GENERATED_PATTERNS } from './AIConstants';

export interface DOMElement {
  tag: string;
  text: string;
  attributes?: Record<string, string>;
  children: DOMElement[];
  xpath: string;
}

export interface FilteredDOMResult {
  content: string;
  elements: DOMElement[];
  metadata: {
    url: string;
    title: string;
    timestamp: number;
    injectionDetected: boolean;
    injectionPatterns?: string[];
    filterStats: {
      piiRemoved: number;
      scriptsRemoved: number;
      stylesRemoved: number;
      navRemoved: number;
      adsRemoved: number;
    };
  };
}

export interface DOMSearchOptions {
  query: string;
  maxResults?: number;
  includeHidden?: boolean;
  caseSensitive?: boolean;
}

export interface DOMSearchResult {
  text: string;
  context: string;
  xpath: string;
  score: number;
  tag?: string;
  element?: DOMElement;
}

const PII_PATTERNS_EXTENDED = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, replacement: '[TOKEN_REDACTED]' },
  { pattern: /session[_-]?id["\s:=]+["']?[A-Za-z0-9\-_]+["']?/gi, replacement: '[SESSION_REDACTED]' },
  { pattern: /\b(password|passwd|pwd|secret|api[_-]?key)[=:]\s*['"][^'"]+['"]/gi, replacement: '[CREDENTIAL_REDACTED]' },
];

const INJECTION_PATTERNS = [
  ...DANGEROUS_PATTERNS,
  ...AI_GENERATED_PATTERNS,
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /<iframe/gi,
  /<embed/gi,
  /<object/gi,
];

const BLOCKED_TAGS = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea'];
const BLOCKED_CLASSES = [/nav/i, /footer/i, /header/i, /sidebar/i, /menu/i, /popup/i, /modal/i, /overlay/i, /cookie/i, /banner/i, /advertisement/i, /ads-/i, /tracking/i, /analytics/i];

export class SecureDOMReader {
  private static instance: SecureDOMReader;
  
  private constructor() {}

  static getInstance(): SecureDOMReader {
    if (!SecureDOMReader.instance) {
      SecureDOMReader.instance = new SecureDOMReader();
    }
    return SecureDOMReader.instance;
  }

  detectInjection(content: string): { detected: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];
    
    for (const pattern of INJECTION_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        detectedPatterns.push(pattern.toString());
      }
    }
    
    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns
    };
  }

  private sanitizeText(text: string): string {
    let sanitized = text;
    
    for (const { pattern, replacement } of PII_PATTERNS_EXTENDED) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    for (const pattern of INJECTION_PATTERNS) {
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      sanitized = sanitized.replace(globalPattern, '[INJECTION_REDACTED]');
    }
    
    return sanitized
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private shouldBlockElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    
    if (BLOCKED_TAGS.includes(tagName)) return true;
    
    for (const pattern of BLOCKED_CLASSES) {
      if (pattern.test(element.className) || pattern.test(element.id)) {
        return true;
      }
    }
    
    return false;
  }

  private extractTextContent(element: Element): string {
    if (this.shouldBlockElement(element)) return '';
    
    let text = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        text += this.extractTextContent(node as Element);
      }
    }
    
    return text;
  }

  private buildElementTree(element: Element, xpath: string = ''): DOMElement | null {
    if (this.shouldBlockElement(element)) return null;
    
    const tag = element.tagName.toLowerCase();
    const currentXPath = xpath ? `${xpath}/${tag}` : `//${tag}`;
    
    const attributes: Record<string, string> = {};
    for (const attr of element.attributes) {
      if (!['href', 'src', 'action', 'data-'].some(prefix => attr.name.toLowerCase().startsWith(prefix))) {
        attributes[attr.name] = attr.value;
      }
    }
    
    const children: DOMElement[] = [];
    for (const child of element.children) {
      const childElement = this.buildElementTree(child, currentXPath);
      if (childElement) children.push(childElement);
    }
    
    const text = this.extractTextContent(element);
    
    if (!text.trim() && children.length === 0) return null;
    
    return {
      tag,
      text: this.sanitizeText(text),
      attributes,
      children,
      xpath: currentXPath
    };
  }

  parseHTMLStructure(html: string): DOMElement[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const elements: DOMElement[] = [];
    
    const mainContent = doc.body.querySelector('main, article, [role="main"], #content, #main, .content');
    const rootElement = mainContent || doc.body;
    
    for (const child of rootElement.children) {
      const element = this.buildElementTree(child);
      if (element) elements.push(element);
    }
    
    return elements;
  }

  extractContent(html: string, url: string = ''): FilteredDOMResult {
    const elements = this.parseHTMLStructure(html);
    
    let content = '';
    const extractText = (els: DOMElement[]) => {
      for (const el of els) {
        if (el.text) content += el.text + '\n';
        if (el.children.length > 0) extractText(el.children);
      }
    };
    extractText(elements);
    
    const sanitizedContent = this.sanitizeText(content);
    const injectionCheck = this.detectInjection(sanitizedContent);
    
    const piiMatches = PII_PATTERNS_EXTENDED.reduce((count, { pattern }) => {
      const matches = content.match(pattern);
      return count + (matches?.length || 0);
    }, 0);
    
    return {
      content: sanitizedContent,
      elements,
      metadata: {
        url,
        title: '',
        timestamp: Date.now(),
        injectionDetected: injectionCheck.detected,
        injectionPatterns: injectionCheck.patterns,
        filterStats: {
          piiRemoved: piiMatches,
          scriptsRemoved: (html.match(/<script/gi) || []).length,
          stylesRemoved: (html.match(/<style/gi) || []).length,
          navRemoved: (html.match(/<nav/gi) || []).length,
          adsRemoved: 0
        }
      }
    };
  }

  searchDOM(elements: DOMElement[], options: DOMSearchOptions): DOMSearchResult[] {
    const { query, maxResults = 10, caseSensitive = false } = options;
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const results: DOMSearchResult[] = [];
    
    const searchElement = (el: DOMElement, parentContext: string = '') => {
      const textToSearch = caseSensitive ? el.text : el.text.toLowerCase();
      const index = textToSearch.indexOf(searchQuery);
      
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(el.text.length, index + query.length + 50);
        const context = el.text.slice(start, end);
        
        const fullContext = parentContext 
          ? `${parentContext} > ${el.tag}: ${context}`
          : `${el.tag}: ${context}`;
        
        const score = this.calculateRelevanceScore(el.text, query, index);
        
        results.push({
          text: el.text.slice(Math.max(0, index - 20), index) + 
                '**' + el.text.slice(index, index + query.length) + '**' +
                el.text.slice(index + query.length, index + query.length + 20),
          context: fullContext,
          xpath: el.xpath,
          score,
          element: el
        });
      }
      
      for (const child of el.children) {
        searchElement(child, el.tag);
      }
    };
    
    for (const element of elements) {
      searchElement(element);
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  private calculateRelevanceScore(text: string, query: string, index: number): number {
    let score = 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerText.startsWith(lowerQuery)) score += 50;
    if (lowerText.includes(` ${lowerQuery}`)) score += 30;
    
    const tagBonus = text.length < 100 ? 20 : text.length < 500 ? 10 : 5;
    score += tagBonus;
    
    score += Math.max(0, 20 - Math.floor(index / 50));
    
    return score;
  }

  buildContextForAI(result: FilteredDOMResult, searchQuery?: string): string {
    let context = `[SECURE DOM READ — READ ONLY MODE]\n`;
    context += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `📄 URL: ${result.metadata.url || 'Unknown'}\n`;
    context += `⏰ Timestamp: ${new Date(result.metadata.timestamp).toISOString()}\n`;
    context += `🛡️ Security: Content filtered, PII removed, injection check passed\n`;
    
    if (result.metadata.injectionDetected) {
      context += `⚠️ WARNING: Potential injection patterns detected and blocked\n`;
    }
    
    context += `\n📊 Content Filter Stats:\n`;
    context += `   • PII patterns removed: ${result.metadata.filterStats.piiRemoved}\n`;
    context += `   • Scripts blocked: ${result.metadata.filterStats.scriptsRemoved}\n`;
    context += `   • Styles blocked: ${result.metadata.filterStats.stylesRemoved}\n`;
    context += `   • Navigation elements filtered: ${result.metadata.filterStats.navRemoved}\n`;
    
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (searchQuery) {
      const searchResults = this.searchDOM(result.elements, { query: searchQuery });
      if (searchResults.length > 0) {
        context += `🔍 Search Results for "${searchQuery}":\n\n`;
        searchResults.forEach((r, i) => {
          context += `${i + 1}. ${r.context}\n`;
          context += `   "${r.text}"\n`;
          context += `   [xpath: ${r.xpath}]\n\n`;
        });
      } else {
        context += `🔍 No matches found for "${searchQuery}"\n\n`;
      }
    } else {
      context += `📝 Page Content:\n\n${result.content.slice(0, 4000)}`;
      if (result.content.length > 4000) {
        context += `\n... (truncated, ${result.content.length - 4000} more characters)`;
      }
    }
    
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    context += `⚠️ IMPORTANT: This is READ-ONLY access. You cannot modify the DOM.\n`;
    context += `To interact with elements, use [FIND_AND_CLICK: text] or [CLICK_ELEMENT: selector]\n`;
    
    return context;
  }
}

export const secureDOMReader = SecureDOMReader.getInstance();

export function createDOMSearchDisplay(results: DOMSearchResult[]): string {
  if (results.length === 0) return 'No results found.';
  
  let display = `🔍 **Search Results** (${results.length} found)\n\n`;
  
  results.forEach((result, index) => {
    const tagName = result.element?.tag || result.tag || 'element';
    display += `**${index + 1}. ${tagName.toUpperCase()}**\n`;
    display += `> ${result.context}\n`;
    display += `\`\`\`\n${result.text}\n\`\`\`\n`;
    display += `📍 Location: \`${result.xpath}\`\n`;
    display += `⭐ Relevance: ${result.score}\n\n`;
    display += `---\n\n`;
  });
  
  return display;
}
