"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateURL = validateURL;
var SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
function validateURL(url) {
    var issues = [];
    try {
        var parsed = new URL(url);
        if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
            issues.push("Protocol \"".concat(parsed.protocol, "\" is not allowed."));
        }
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) {
            issues.push('IP address in URL — potential phishing.');
        }
    }
    catch (_a) {
        issues.push('Invalid URL format.');
    }
    return { isSafe: issues.length === 0, issues: issues };
}
