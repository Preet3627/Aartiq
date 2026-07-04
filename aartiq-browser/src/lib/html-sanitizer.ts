let purify: { sanitize: (html: string, options?: any) => string } | null = null;

try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const dompurify = require('dompurify');
        purify = dompurify.default || dompurify;
    }
} catch {
    // DOMPurify uses window/document — not available in main process
}

export interface SanitizeOptions {
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
    ALLOW_DATA_ATTR?: boolean;
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
}

const DEFAULT_OPTIONS: SanitizeOptions = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};

export function sanitizeHTML(html: string, options?: SanitizeOptions): string {
    if (!purify) {
        console.warn('[html-sanitizer] DOMPurify not available (non-browser context). HTML not sanitized.');
        return html;
    }
    return purify.sanitize(html, {
        ...DEFAULT_OPTIONS,
        ...options,
    });
}
