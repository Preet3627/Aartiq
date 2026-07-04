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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Security = exports.validateURL = exports.sanitizeHTML = exports.encodeLocalOnly = exports.migrateToNewFormat = exports.decryptLegacyBlob = exports.migrateLegacyBlob = exports.isCiphertext = exports.DecryptionError = exports.EncryptionError = void 0;
var crypto_utils_1 = require("./crypto-utils");
Object.defineProperty(exports, "encodeLocalOnly", { enumerable: true, get: function () { return crypto_utils_1.encodeLocalOnly; } });
Object.defineProperty(exports, "EncryptionError", { enumerable: true, get: function () { return crypto_utils_1.EncryptionError; } });
Object.defineProperty(exports, "DecryptionError", { enumerable: true, get: function () { return crypto_utils_1.DecryptionError; } });
Object.defineProperty(exports, "isCiphertext", { enumerable: true, get: function () { return crypto_utils_1.isCiphertext; } });
Object.defineProperty(exports, "migrateLegacyBlob", { enumerable: true, get: function () { return crypto_utils_1.migrateLegacyBlob; } });
Object.defineProperty(exports, "decryptLegacyBlob", { enumerable: true, get: function () { return crypto_utils_1.decryptLegacyBlob; } });
Object.defineProperty(exports, "migrateToNewFormat", { enumerable: true, get: function () { return crypto_utils_1.migrateToNewFormat; } });
var html_sanitizer_1 = require("./html-sanitizer");
var url_validator_1 = require("./url-validator");
var html_sanitizer_2 = require("./html-sanitizer");
Object.defineProperty(exports, "sanitizeHTML", { enumerable: true, get: function () { return html_sanitizer_2.sanitizeHTML; } });
var url_validator_2 = require("./url-validator");
Object.defineProperty(exports, "validateURL", { enumerable: true, get: function () { return url_validator_2.validateURL; } });
exports.Security = {
    encrypt: function (text, passphrase) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, crypto_utils_1.encrypt)(text, passphrase)];
        });
    }); },
    decrypt: function (encoded, passphrase) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, crypto_utils_1.decrypt)(encoded, passphrase)];
        });
    }); },
    SecureDOMParser: {
        foundSuspiciousPatterns: new Set(),
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
        analyze: function (content) {
            var findings = [];
            var recommendations = [];
            var threatScore = 0;
            for (var _i = 0, _a = Object.entries(exports.Security.SecureDOMParser.injectionPatterns); _i < _a.length; _i++) {
                var _b = _a[_i], layerName = _b[0], patterns = _b[1];
                if (Array.isArray(patterns)) {
                    for (var _c = 0, _d = patterns; _c < _d.length; _c++) {
                        var pattern = _d[_c];
                        var match = void 0;
                        var regex = pattern;
                        while ((match = regex.exec(content)) !== null) {
                            var severity = exports.Security.SecureDOMParser.getSeverity(layerName, match[0]);
                            findings.push({
                                layer: layerName,
                                pattern: pattern.toString(),
                                match: match[0].substring(0, 100),
                                position: match.index,
                                severity: severity
                            });
                            threatScore += exports.Security.SecureDOMParser.getThreatScore(layerName);
                        }
                    }
                }
                else if (typeof patterns === 'object') {
                    for (var _e = 0, _f = patterns; _e < _f.length; _e++) {
                        var patternObj = _f[_e];
                        var match = void 0;
                        var regex = patternObj.pattern;
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
            var threatLevel = 'none';
            if (threatScore >= 100)
                threatLevel = 'critical';
            else if (threatScore >= 50)
                threatLevel = 'high';
            else if (threatScore >= 20)
                threatLevel = 'medium';
            else if (threatScore >= 5)
                threatLevel = 'low';
            if (findings.some(function (f) { return f.layer === 'shellPrimitives'; })) {
                recommendations.push("Shell execution commands detected. Content may contain unsafe instructions.");
            }
            if (findings.some(function (f) { return f.layer === 'encodingPatterns'; })) {
                recommendations.push("Encoded/obfuscated content detected. Decode manually for review.");
            }
            if (findings.some(function (f) { return f.layer === 'injectionAttempts'; })) {
                recommendations.push("Prompt injection attempt detected. Review content before use.");
            }
            if (findings.some(function (f) { return f.layer === 'apiKeyPatterns'; })) {
                recommendations.push("API keys or secrets detected. Credentials should be masked.");
            }
            if (threatLevel !== 'none') {
                console.warn('[Security Monitor] Threat patterns detected:', threatLevel, findings.length, 'findings');
                for (var _g = 0, recommendations_1 = recommendations; _g < recommendations_1.length; _g++) {
                    var rec = recommendations_1[_g];
                    console.warn('[Security Monitor] Recommendation:', rec);
                }
            }
            var sanitizedContent = content;
            for (var _h = 0, findings_1 = findings; _h < findings_1.length; _h++) {
                var finding = findings_1[_h];
                if (finding.severity === 'critical') {
                    sanitizedContent = sanitizedContent.replace(new RegExp(exports.Security.SecureDOMParser.escapeRegex(finding.match), 'g'), "[BLOCKED: ".concat(finding.layer.toUpperCase(), "]"));
                }
            }
            return {
                matchedKnownPatterns: threatLevel !== 'none',
                threatLevel: threatLevel,
                findings: findings,
                sanitizedContent: sanitizedContent,
                recommendations: recommendations
            };
        },
        getThreatScore: function (layer) {
            var scores = {
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
        getSeverity: function (layer, match) {
            if (layer === 'injectionAttempts')
                return 'critical';
            if (layer === 'shellPrimitives' && /rm\s+-rf|sudo|del\s+\//i.test(match))
                return 'critical';
            if (layer === 'privilegeEscalation')
                return 'warning';
            if (layer === 'apiKeyPatterns')
                return 'warning';
            return 'info';
        },
        escapeRegex: function (string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },
        sanitizeHTML: function (html) {
            return (0, html_sanitizer_1.sanitizeHTML)(html);
        },
        validateURL: function (url) {
            return (0, url_validator_1.validateURL)(url);
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
    addPattern: function (name, regex) {
        exports.Security.patterns.push({ name: name, regex: regex });
    },
    fortress: function (content) {
        var protectedContent = content;
        var wasProtected = false;
        exports.Security.patterns.forEach(function (p) {
            if (p.regex.test(protectedContent)) {
                console.log("[AI Fortress] Protecting sensitive data: ".concat(p.name));
                protectedContent = protectedContent.replace(p.regex, p.name);
                wasProtected = true;
            }
            p.regex.lastIndex = 0;
        });
        return { content: protectedContent, wasProtected: wasProtected };
    },
    filterForLLM: function (content, options) {
        var opts = __assign({ preserveFormatting: true, stripHTML: false, removeCode: false }, options);
        var filtered = content;
        var analysis = exports.Security.SecureDOMParser.analyze(filtered);
        filtered = analysis.sanitizedContent;
        var fortressResult = exports.Security.fortress(filtered);
        if (fortressResult.wasProtected) {
            console.log('[Security] API keys/secrets protected');
            filtered = fortressResult.content;
        }
        if (opts.stripHTML) {
            filtered = exports.Security.stripHTML(filtered);
        }
        if (opts.removeCode) {
            filtered = exports.Security.removeCodeBlocks(filtered);
        }
        return filtered;
    },
    stripHTML: function (html) {
        var text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
        text = text.replace(/<\/?(div|p|br|h[1-6]|li|tr|blockquote)[\s\S]*?>/gi, '\n');
        text = text.replace(/<[^>]+>/g, '');
        text = exports.Security.decodeHTMLEntities(text);
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return text;
    },
    removeCodeBlocks: function (content) {
        var text = content.replace(/```[\s\S]*?```/g, '[CODE BLOCK REMOVED]');
        text = text.replace(/`[^`]+`/g, '[CODE REMOVED]');
        text = text.replace(/<pre>[\s\S]*?<\/pre>/gi, '[CODE BLOCK REMOVED]');
        return text;
    },
    decodeHTMLEntities: function (text) {
        var entities = {
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
        var decoded = text;
        for (var _i = 0, _a = Object.entries(entities); _i < _a.length; _i++) {
            var _b = _a[_i], entity = _b[0], char = _b[1];
            decoded = decoded.replace(new RegExp(entity, 'g'), char);
        }
        decoded = decoded.replace(/&#(\d+);/g, function (_, num) { return String.fromCharCode(parseInt(num, 10)); });
        decoded = decoded.replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return String.fromCharCode(parseInt(hex, 16)); });
        return decoded;
    },
    // ============================================
    // CAPABILITY-SCOPED EXECUTION MODEL (Fix 4)
    // ============================================
    createCapabilityController: function () {
        var actions = new Map();
        var firstTimeApprovals = new Set();
        return {
            registerAction: function (action) {
                if (actions.has(action.name)) {
                    throw new Error("Action \"".concat(action.name, "\" is already registered."));
                }
                actions.set(action.name, action);
            },
            getAction: function (name) {
                return actions.get(name);
            },
            executeAction: function (name, params) {
                return __awaiter(this, void 0, void 0, function () {
                    var action, needsApproval, result, e_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                action = actions.get(name);
                                if (!action) {
                                    return [2 /*return*/, { approved: false, reason: "Action \"".concat(name, "\" is not registered.") }];
                                }
                                needsApproval = false;
                                if (action.requiresApproval === 'always') {
                                    needsApproval = true;
                                }
                                else if (action.requiresApproval === 'first-time-per-session') {
                                    if (!firstTimeApprovals.has(name)) {
                                        needsApproval = true;
                                    }
                                }
                                if (needsApproval) {
                                    return [2 /*return*/, {
                                            approved: false,
                                            reason: "Action \"".concat(name, "\" requires user approval."),
                                        }];
                                }
                                if (action.requiresApproval === 'first-time-per-session') {
                                    firstTimeApprovals.add(name);
                                }
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, action.handler(params)];
                            case 2:
                                result = _a.sent();
                                return [2 /*return*/, { approved: true, result: result }];
                            case 3:
                                e_1 = _a.sent();
                                return [2 /*return*/, { approved: false, reason: "Action \"".concat(name, "\" failed: ").concat(e_1.message) }];
                            case 4: return [2 /*return*/];
                        }
                    });
                });
            },
            getRegisteredActions: function () {
                return Array.from(actions.values());
            },
        };
    },
};
