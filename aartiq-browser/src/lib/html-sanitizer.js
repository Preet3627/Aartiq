"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHTML = sanitizeHTML;
var purify = null;
try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        var dompurify = require('dompurify');
        purify = dompurify.default || dompurify;
    }
}
catch (_a) {
    // DOMPurify uses window/document — not available in main process
}
var DEFAULT_OPTIONS = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};
function sanitizeHTML(html, options) {
    if (!purify) {
        console.warn('[html-sanitizer] DOMPurify not available (non-browser context). HTML not sanitized.');
        return html;
    }
    return purify.sanitize(html, __assign(__assign({}, DEFAULT_OPTIONS), options));
}
