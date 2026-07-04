const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function validateURL(url: string): { isSafe: boolean; issues: string[] } {
    const issues: string[] = [];
    try {
        const parsed = new URL(url);
        if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
            issues.push(`Protocol "${parsed.protocol}" is not allowed.`);
        }
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) {
            issues.push('IP address in URL — potential phishing.');
        }
    } catch {
        issues.push('Invalid URL format.');
    }
    return { isSafe: issues.length === 0, issues };
}
