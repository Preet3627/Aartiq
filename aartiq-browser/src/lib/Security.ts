import {
    encrypt as cryptoEncrypt,
    decrypt as cryptoDecrypt,
    encodeLocalOnly as localOnly,
    EncryptionError,
    DecryptionError,
    isCiphertext,
    migrateLegacyBlob,
    decryptLegacyBlob,
    migrateToNewFormat,
} from './crypto-utils';
import { sanitizeHTML as purifyHTML } from './html-sanitizer';
import { validateURL as allowlistValidateURL } from './url-validator';

export { EncryptionError, DecryptionError, isCiphertext, migrateLegacyBlob, decryptLegacyBlob, migrateToNewFormat };
export { localOnly as encodeLocalOnly };
export { sanitizeHTML } from './html-sanitizer';
export { validateURL } from './url-validator';

type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
type FindingSeverity = 'info' | 'warning' | 'critical';

interface Finding {
    layer: string;
    pattern: string;
    match: string;
    position: number;
    severity: FindingSeverity;
}

interface AnalyzeResult {
    matchedKnownPatterns: boolean;
    threatLevel: ThreatLevel;
    findings: Finding[];
    sanitizedContent: string;
    recommendations: string[];
}

interface ApprovalDecision {
    requiresApproval: boolean;
    reason?: string;
}

interface AllowedAction {
    name: string;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
    requiresApproval: 'never' | 'always' | 'first-time-per-session';
}

interface CapabilityController {
    registerAction(action: AllowedAction): void;
    getAction(name: string): AllowedAction | undefined;
    executeAction(name: string, params: Record<string, unknown>): Promise<{ approved: boolean; result?: unknown; reason?: string }>;
    getRegisteredActions(): AllowedAction[];
}

export const Security = {
    encrypt: async (text: string, passphrase: string): Promise<string> => {
        return cryptoEncrypt(text, passphrase);
    },

    decrypt: async (encoded: string, passphrase: string): Promise<string> => {
        return cryptoDecrypt(encoded, passphrase);
    },

    SecureDOMParser: {
        foundSuspiciousPatterns: new Set<string>(),

        injectionPatterns: {
            shellPrimitives: [
                /rm\s+-rf\s+\//gi,
                /rm\s+-rf\s+[A-Za-z0-9_\/]+/gi,
                /del\s+\/[sfq]\s+/gi,
                /format\s+[A-Z]:/gi,
                /mkfs/gi,
                /dd\s+if=/gi,
                /shutdown\s+/gi,
                /halt\s+/gi,
                /init\s+0/gi,
                /systemctl\s+stop/gi,
                /powershell\s+-enc/gi,
                /cmd\.exe\s+\/c/gi,
                /bash\s+-c/gi,
                /sh\s+-c/gi,
                /zsh\s+-c/gi,
                /fish\s+-c/gi,
                /;\s*rm\s+/gi,
                /\|\s*rm\s+/gi,
                /&&\s*rm\s+/gi,
                /\|\|\s*rm\s+/gi,
                /eval\s*\(/gi,
                /exec\s*\(/gi,
                /system\s*\(/gi,
                /passthru\s*\(/gi,
                /shell_exec\s*\(/gi,
                /`[^`]*\$\([^)]*\)[^`]*`/gi
            ],

            encodingPatterns: [
                /\\\\x[0-9a-f]{2}/gi,
                /\\\\u[0-9a-f]{4}/gi,
                /&#x[0-9a-f]+;/gi,
                /&#\d+;/gi,
                /%[0-9a-f]{2}/gi,
                /base64_decode\s*\(/gi,
                /base64_encode\s*\(/gi,
                /rot13\s*\(/gi,
                /str_rot13\s*\(/gi,
                /gzinflate\s*\(/gi,
                /gzdeflate\s*\(/gi,
                /strrev\s*\(/gi,
                /hex2bin\s*\(/gi,
                /bin2hex\s*\(/gi,
                /chr\(\d+\)/gi,
                /ord\(/gi,
                /pack\s*\(['"](?:H\*|a\*|A\*)/gi,
                /unpack\s*\(/gi,
                /mcrypt\s*\(/gi,
                /openssl_decrypt\s*\(/gi,
                /crypt\s*\(/gi
            ],

            injectionAttempts: [
                /ignore\s+(?:all|previous|above)\s+(?:instructions?|prompts?|rules?)/gi,
                /disregard\s+(?:your|all)\s+(?:previous|above)\s+(?:instructions?|rules?)/gi,
                /forget\s+(?:your|all)\s+(?:previous|above)\s+(?:instructions?|rules?)/gi,
                /you\s+are\s+now\s+(?:ignoring|disregarding)/gi,
                /new\s+(?:system|base)\s+(?:prompt|instruct)/gi,
                /\{(?:system|base)_prompt\}/gi,
                /<\/?(?:system|base)_prompt>/gi,
                /\[INST\][\s\S]*\[\/INST\]/gi,
                /<<<[\s\S]*?>>>/g,
                /\{\{[\s\S]*?\}\}/g,
                /<\?php[\s\S]*?\?>/gi,
                /<\?[\s\S]*?\?>/gi,
                /<script[\s\S]*?<\/script>/gi,
                /javascript:/gi,
                /data:text\/html/gi,
                /on\w+\s*=/gi,
                /<iframe/gi,
                /vbscript:/gi,
                /livescript:/gi,
                /x-javascript/gi
            ],

            privilegeEscalation: [
                /sudo\s+/gi,
                /su\s+-\s+/gi,
                /chmod\s+[0-7]{3,4}/gi,
                /chown\s+/gi,
                /chgrp\s+/gi,
                /setuid/gi,
                /setgid/gi,
                /capability\s+/gi,
                /useradd\s+/gi,
                /usermod\s+/gi,
                /passwd\s+/gi,
                /gpasswd\s+/gi,
                /visudo\s+/gi,
                /pkexec\s+/gi,
                /policykit\s+/gi,
                /polkit\s+/gi,
                /dbus-send\s+/gi
            ],

            networkPatterns: [
                /curl\s+-/gi,
                /wget\s+/gi,
                /nc\s+-/gi,
                /netcat\s+/gi,
                /telnet\s+/gi,
                /ssh\s+/gi,
                /scp\s+/gi,
                /rsync\s+/gi,
                /ftp\s+/gi,
                /tftp\s+/gi,
                /sftp\s+/gi,
                /smbclient\s+/gi,
                /mount\s+-t\s+cifs/gi,
                /mount\s+-t\s+nfs/gi,
                /\\?\.exe\s+http/gi,
                /certutil\s+/gi,
                /bitsadmin\s+/gi,
                /Invoke-WebRequest/gi,
                /Invoke-RestMethod/gi,
                /New-Object\s+Net\.WebClient/gi
            ],

            apiKeyPatterns: [
                { pattern: /AIzaSy[A-Za-z0-9_-]{33}/g, name: "Google API Key" },
                { pattern: /sk-[A-Za-z0-9]{48}/g, name: "OpenAI API Key" },
                { pattern: /sk-ant-api03-[A-Za-z0-9-_]{93}/g, name: "Anthropic API Key" },
                { pattern: /ghp_[A-Za-z0-9]{36}/g, name: "GitHub Token" },
                { pattern: /gho_[A-Za-z0-9]{36}/g, name: "GitHub OAuth" },
                { pattern: /xox[baprs]-[A-Za-z0-9]{10,}/g, name: "Slack Token" },
                { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key" },
                { pattern: /[a-zA-Z0-9_-]*:[a-zA-Z0-9_-]*@[a-zA-Z0-9._-]/g, name: "Credential URL" },
                { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi, name: "Hardcoded Password" },
                { pattern: /api[_-]?key\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: "Generic API Key" },
                { pattern: /secret\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: "Hardcoded Secret" },
                { pattern: /token\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: "Hardcoded Token" },
                { pattern: /bearer\s+[A-Za-z0-9_-]{20,}/gi, name: "Bearer Token" }
            ],

            fileOperations: [
                /fopen\s*\(/gi,
                /file_put_contents\s*\(/gi,
                /file_get_contents\s*\(/gi,
                /readfile\s*\(/gi,
                /include\s*\(/gi,
                /include_once\s*\(/gi,
                /require\s*\(/gi,
                /require_once\s*\(/gi,
                /__import__\s*\(/gi,
                /open\s*\(.*,\s*['"]w['"]\)/gi,
                /fs\.writeFile\s*\(/gi,
                /fs\.writeFileSync\s*\(/gi,
                /fs\.createWriteStream\s*\(/gi,
                /writeFile\s*\(/gi,
                /writeFileSync\s*\(/gi,
                /appendFile\s*\(/gi,
                /appendFileSync\s*\(/gi
            ],

            jsAttacks: [
                /document\.cookie/gi,
                /localStorage/gi,
                /sessionStorage/gi,
                /window\.location/gi,
                /navigator\./gi,
                /fetch\s*\(/gi,
                /XMLHttpRequest/gi,
                /WebSocket/gi,
                /eval\s*\(/gi,
                /Function\s*\(/gi,
                /setTimeout\s*\(.*['"]/gi,
                /setInterval\s*\(.*['"]/gi,
                /new\s+Function/gi,
                /<script/gi,
                /<\/script>/gi,
                /onerror\s*=/gi,
                /onload\s*=/gi,
                /onclick\s*=/gi,
                /onmouseover\s*=/gi,
                /innerHTML\s*=/gi,
                /outerHTML\s*=/gi,
                /insertAdjacentHTML/gi,
                /write\s*\(/gi,
                /writeln\s*\(/gi
            ]
        },

        analyze(content: string): AnalyzeResult {
            const findings: Finding[] = [];
            const recommendations: string[] = [];
            let threatScore = 0;

            for (const [layerName, patterns] of Object.entries(Security.SecureDOMParser.injectionPatterns)) {
                if (Array.isArray(patterns)) {
                    for (const pattern of (patterns as RegExp[])) {
                        let match;
                        const regex = pattern;
                        while ((match = regex.exec(content)) !== null) {
                            const severity = Security.SecureDOMParser.getSeverity(layerName, match[0]);
                            findings.push({
                                layer: layerName,
                                pattern: pattern.toString(),
                                match: match[0].substring(0, 100),
                                position: match.index,
                                severity
                            });
                            threatScore += Security.SecureDOMParser.getThreatScore(layerName);
                        }
                    }
                } else if (typeof patterns === 'object') {
                    for (const patternObj of patterns as Array<{pattern: RegExp, name: string}>) {
                        let match;
                        const regex = patternObj.pattern;
                        while ((match = regex.exec(content)) !== null) {
                            findings.push({
                                layer: 'apiKeyPatterns',
                                pattern: patternObj.name,
                                match: match[0].substring(0, 50) + '...',
                                position: match.index,
                                severity: 'warning'
                            });
                            threatScore += 20;
                        }
                    }
                }
            }

            let threatLevel: ThreatLevel = 'none';
            if (threatScore >= 100) threatLevel = 'critical';
            else if (threatScore >= 50) threatLevel = 'high';
            else if (threatScore >= 20) threatLevel = 'medium';
            else if (threatScore >= 5) threatLevel = 'low';

            if (findings.some(f => f.layer === 'shellPrimitives')) {
                recommendations.push("Shell execution commands detected. Content may contain unsafe instructions.");
            }
            if (findings.some(f => f.layer === 'encodingPatterns')) {
                recommendations.push("Encoded/obfuscated content detected. Decode manually for review.");
            }
            if (findings.some(f => f.layer === 'injectionAttempts')) {
                recommendations.push("Prompt injection attempt detected. Review content before use.");
            }
            if (findings.some(f => f.layer === 'apiKeyPatterns')) {
                recommendations.push("API keys or secrets detected. Credentials should be masked.");
            }

            if (threatLevel !== 'none') {
                console.warn('[Security Monitor] Threat patterns detected:', threatLevel, findings.length, 'findings');
                for (const rec of recommendations) {
                    console.warn('[Security Monitor] Recommendation:', rec);
                }
            }

            let sanitizedContent = content;
            for (const finding of findings) {
                if (finding.severity === 'critical') {
                    sanitizedContent = sanitizedContent.replace(
                        new RegExp(Security.SecureDOMParser.escapeRegex(finding.match), 'g'),
                        `[BLOCKED: ${finding.layer.toUpperCase()}]`
                    );
                }
            }

            return {
                matchedKnownPatterns: threatLevel !== 'none',
                threatLevel,
                findings,
                sanitizedContent,
                recommendations
            };
        },

        getThreatScore(layer: string): number {
            const scores: Record<string, number> = {
                shellPrimitives: 30,
                injectionAttempts: 50,
                privilegeEscalation: 25,
                networkPatterns: 20,
                fileOperations: 15,
                encodingPatterns: 10,
                jsAttacks: 20,
                apiKeyPatterns: 20
            };
            return scores[layer] || 5;
        },

        getSeverity(layer: string, match: string): FindingSeverity {
            if (layer === 'injectionAttempts') return 'critical';
            if (layer === 'shellPrimitives' && /rm\s+-rf|sudo|del\s+\//i.test(match)) return 'critical';
            if (layer === 'privilegeEscalation') return 'warning';
            if (layer === 'apiKeyPatterns') return 'warning';
            return 'info';
        },

        escapeRegex(string: string): string {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },

        sanitizeHTML(html: string): string {
            return purifyHTML(html);
        },

        validateURL(url: string): {
            isSafe: boolean;
            issues: string[];
        } {
            return allowlistValidateURL(url);
        },
    },

    patterns: [
        { name: "[Gemini_API_Key]", regex: /AIzaSy[A-Za-z0-9_-]{33}/g },
        { name: "[OpenAI_API_Key]", regex: /sk-[A-Za-z0-9]{48}/g },
        { name: "[Anthropic_API_Key]", regex: /sk-ant-api03-[A-Za-z0-9-_]{93}/g },
        { name: "[GitHub_Token]", regex: /ghp_[A-Za-z0-9]{36}/g },
        { name: "[AWS_Access_Key]", regex: /AKIA[0-9A-Z]{16}/g },
        { name: "[Slack_Token]", regex: /xox[baprs]-[A-Za-z0-9]{10,}/g },
        { name: "[Generic_Secret]", regex: /(?:password|secret|key|token)\s*[=:]\s*['"][A-Za-z0-9!@#$%^&*]{8,}['"]/gi }
    ],

    addPattern: (name: string, regex: RegExp) => {
        Security.patterns.push({ name, regex });
    },

    fortress: (content: string): { content: string, wasProtected: boolean } => {
        let protectedContent = content;
        let wasProtected = false;

        Security.patterns.forEach(p => {
            if (p.regex.test(protectedContent)) {
                console.log(`[AI Fortress] Protecting sensitive data: ${p.name}`);
                protectedContent = protectedContent.replace(p.regex, p.name);
                wasProtected = true;
            }
            p.regex.lastIndex = 0;
        });

        return { content: protectedContent, wasProtected };
    },

    filterForLLM: (content: string, options?: {
        preserveFormatting?: boolean;
        stripHTML?: boolean;
        removeCode?: boolean;
    }): string => {
        const opts = {
            preserveFormatting: true,
            stripHTML: false,
            removeCode: false,
            ...options
        };

        let filtered = content;

        const analysis = Security.SecureDOMParser.analyze(filtered);
        filtered = analysis.sanitizedContent;

        const fortressResult = Security.fortress(filtered);
        if (fortressResult.wasProtected) {
            console.log('[Security] API keys/secrets protected');
            filtered = fortressResult.content;
        }

        if (opts.stripHTML) {
            filtered = Security.stripHTML(filtered);
        }

        if (opts.removeCode) {
            filtered = Security.removeCodeBlocks(filtered);
        }

        return filtered;
    },

    stripHTML: (html: string): string => {
        let text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
        text = text.replace(/<\/?(div|p|br|h[1-6]|li|tr|blockquote)[\s\S]*?>/gi, '\n');
        text = text.replace(/<[^>]+>/g, '');
        text = Security.decodeHTMLEntities(text);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return text;
    },

    removeCodeBlocks: (content: string): string => {
        let text = content.replace(/```[\s\S]*?```/g, '[CODE BLOCK REMOVED]');
        text = text.replace(/`[^`]+`/g, '[CODE REMOVED]');
        text = text.replace(/<pre>[\s\S]*?<\/pre>/gi, '[CODE BLOCK REMOVED]');
        return text;
    },

    decodeHTMLEntities: (text: string): string => {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' ',
            '&copy;': '\u00a9',
            '&reg;': '\u00ae',
            '&trade;': '\u2122'
        };

        let decoded = text;
        for (const [entity, char] of Object.entries(entities)) {
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }

        decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
        decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        return decoded;
    },

    // ============================================
    // CAPABILITY-SCOPED EXECUTION MODEL (Fix 4)
    // ============================================

    createCapabilityController: (): CapabilityController => {
        const actions = new Map<string, AllowedAction>();
        const firstTimeApprovals = new Set<string>();

        return {
            registerAction(action: AllowedAction): void {
                if (actions.has(action.name)) {
                    throw new Error(`Action "${action.name}" is already registered.`);
                }
                actions.set(action.name, action);
            },

            getAction(name: string): AllowedAction | undefined {
                return actions.get(name);
            },

            async executeAction(name: string, params: Record<string, unknown>): Promise<{ approved: boolean; result?: unknown; reason?: string }> {
                const action = actions.get(name);
                if (!action) {
                    return { approved: false, reason: `Action "${name}" is not registered.` };
                }

                let needsApproval = false;
                if (action.requiresApproval === 'always') {
                    needsApproval = true;
                } else if (action.requiresApproval === 'first-time-per-session') {
                    if (!firstTimeApprovals.has(name)) {
                        needsApproval = true;
                    }
                }

                if (needsApproval) {
                    return {
                        approved: false,
                        reason: `Action "${name}" requires user approval.`,
                    };
                }

                if (action.requiresApproval === 'first-time-per-session') {
                    firstTimeApprovals.add(name);
                }

                try {
                    const result = await action.handler(params);
                    return { approved: true, result };
                } catch (e) {
                    return { approved: false, reason: `Action "${name}" failed: ${(e as Error).message}` };
                }
            },

            getRegisteredActions(): AllowedAction[] {
                return Array.from(actions.values());
            },
        };
    },
};
