/**
 * Search Context Store
 * Tracks recent searches, page reads, and OCR results to avoid redundant fetching
 */

export interface SearchContext {
    id: string;
    type: 'web_search' | 'page_content' | 'ocr' | 'dom';
    query?: string;
    url?: string;
    title?: string;
    content: string;
    timestamp: number;
    expiresAt: number;
    charCount: number;
}

class SearchContextStore {
    private contexts: SearchContext[] = [];
    private maxContexts = 10;
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    generateId(): string {
        return `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    addContext(context: Omit<SearchContext, 'id' | 'timestamp' | 'expiresAt' | 'charCount'>): SearchContext {
        const now = Date.now();
        const newContext: SearchContext = {
            ...context,
            id: this.generateId(),
            timestamp: now,
            expiresAt: now + this.defaultTTL,
            charCount: context.content.length,
        };

        this.contexts.unshift(newContext);

        // Keep only last N contexts
        if (this.contexts.length > this.maxContexts) {
            this.contexts = this.contexts.slice(0, this.maxContexts);
        }

        this.cleanup();
        this.persist();

        return newContext;
    }

    addWebSearch(query: string, results: string): SearchContext {
        return this.addContext({
            type: 'web_search',
            query,
            content: results,
        });
    }

    addPageContent(url: string, title: string, content: string): SearchContext {
        return this.addContext({
            type: 'page_content',
            url,
            title,
            content,
        });
    }

    addOCR(content: string, label?: string): SearchContext {
        return this.addContext({
            type: 'ocr',
            query: label,
            content,
        });
    }

    addDOM(url: string, query: string, content: string): SearchContext {
        return this.addContext({
            type: 'dom',
            query,
            url,
            content,
        });
    }

    getRecentContext(type?: SearchContext['type']): SearchContext | null {
        this.cleanup();
        const contexts = type 
            ? this.contexts.filter(c => c.type === type)
            : this.contexts;
        return contexts[0] || null;
    }

    getRecentContexts(count: number = 5, type?: SearchContext['type']): SearchContext[] {
        this.cleanup();
        const contexts = type 
            ? this.contexts.filter(c => c.type === type)
            : this.contexts;
        return contexts.slice(0, count);
    }

    getContextsByType(type: SearchContext['type']): SearchContext[] {
        this.cleanup();
        return this.contexts.filter(c => c.type === type);
    }

    hasRecentSearch(query: string, maxAge: number = 5 * 60 * 1000): SearchContext | null {
        const now = Date.now();
        const cutoff = now - maxAge;
        
        // Check for similar query
        const queryLower = query.toLowerCase();
        for (const ctx of this.contexts) {
            if (ctx.type !== 'web_search') continue;
            if (ctx.timestamp < cutoff) continue;
            
            const ctxQueryLower = (ctx.query || '').toLowerCase();
            // Check for exact match or significant overlap
            if (ctxQueryLower === queryLower || 
                ctxQueryLower.includes(queryLower) ||
                queryLower.includes(ctxQueryLower)) {
                return ctx;
            }
        }
        return null;
    }

    hasRecentPageContent(url: string, maxAge: number = 5 * 60 * 1000): SearchContext | null {
        const now = Date.now();
        const cutoff = now - maxAge;
        
        for (const ctx of this.contexts) {
            if (ctx.type !== 'page_content') continue;
            if (ctx.timestamp < cutoff) continue;
            if (ctx.url === url) return ctx;
        }
        return null;
    }

    clear(): void {
        this.contexts = [];
        this.persist();
    }

    private cleanup(): void {
        const now = Date.now();
        this.contexts = this.contexts.filter(c => c.expiresAt > now);
    }

    private persist(): void {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('aartiq_search_contexts', JSON.stringify(this.contexts));
            }
        } catch (e) {
            console.warn('[SearchContext] Failed to persist:', e);
        }
    }

    load(): void {
        try {
            if (typeof localStorage !== 'undefined') {
                const data = localStorage.getItem('aartiq_search_contexts');
                if (data) {
                    this.contexts = JSON.parse(data);
                    this.cleanup();
                }
            }
        } catch (e) {
            console.warn('[SearchContext] Failed to load:', e);
            this.contexts = [];
        }
    }

    getContextSummary(): string {
        this.cleanup();
        
        if (this.contexts.length === 0) {
            return 'No recent context available.';
        }

        const parts: string[] = ['## RECENT CONTEXT AVAILABLE'];
        parts.push('(Use this data instead of re-searching if relevant)\n');

        for (const ctx of this.contexts) {
            const age = Math.round((Date.now() - ctx.timestamp) / 1000);
            const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;
            
            switch (ctx.type) {
                case 'web_search':
                    parts.push(`### WEB SEARCH: "${ctx.query}" (${ageStr})`);
                    parts.push(`\`\`\`\n${ctx.content.substring(0, 1000)}${ctx.content.length > 1000 ? '\n...[truncated]' : ''}\n\`\`\``);
                    break;
                case 'page_content':
                    parts.push(`### PAGE: "${ctx.title || ctx.url}" (${ageStr})`);
                    parts.push(`URL: ${ctx.url}`);
                    parts.push(`\`\`\`\n${ctx.content.substring(0, 1000)}${ctx.content.length > 1000 ? '\n...[truncated]' : ''}\n\`\`\``);
                    break;
                case 'ocr':
                    parts.push(`### OCR: "${ctx.query || 'Screen capture'}" (${ageStr})`);
                    parts.push(`\`\`\`\n${ctx.content.substring(0, 500)}${ctx.content.length > 500 ? '\n...[truncated]' : ''}\n\`\`\``);
                    break;
                case 'dom':
                    parts.push(`### DOM: "${ctx.query}" on ${ctx.url} (${ageStr})`);
                    parts.push(`\`\`\`\n${ctx.content.substring(0, 500)}${ctx.content.length > 500 ? '\n...[truncated]' : ''}\n\`\`\``);
                    break;
            }
            parts.push('');
        }

        return parts.join('\n');
    }
}

export const searchContextStore = new SearchContextStore();
searchContextStore.load();
