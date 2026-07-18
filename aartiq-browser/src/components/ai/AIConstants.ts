export const AARTIQ_CAPABILITIES = {
  browser: true,
  terminal: true,
  filesystem: true,
  tools: true,
  vision: true,
  voice: true,
  pdf: true,
  automation: true,
  scheduling: true,
  description: 'Aartiq Agent — Full system access. Never claim to be text-only.',
} as const;

export const DANGEROUS_PATTERNS: RegExp[] = [
  /ignore (previous|all|your|above|prior|system) (instructions?|prompt|rules?|constraints?)/i,
  /you are (now |)?(a|an) (different|evil|unrestricted|unfiltered|jailbroken|DAN|GPT)/i,
  /\bDAN\b.*\bjailbreak\b|\bjailbreak\b.*\bDAN\b/i,
  /pretend (you (have no|don't have|are without) (limits?|restrictions?|rules?|filter))/i,
  /act as if (you (have no|are without|don't have) (morals?|ethics?|restrictions?|limits?))/i,
  /bypass (safety|filter|restriction|content|moderation|guardrail)/i,
  /disable (safety|content|filter|restriction|moderation)/i,
  /your (true|real|inner|hidden) self|your (core|base) programming/i,
  /override (safety|filter|restriction|system|prompt)/i,
  /\bsystem prompt\b.*\b(reveal|show|tell me|print|leak|expose|output)\b/i,
  /\b(reveal|show|tell me|print|leak|expose|output)\b.*\bsystem prompt\b/i,
  /\b(local|session|cache|memory|store)\b.*(dump|export|print|reveal|show|leak|exfiltrate)/i,
  /print (your|the|all) (memory|context|session|history|cache|conversation)/i,
  /what (is|are) (in|inside) (your|the) (memory|cache|context|session)/i,
  /repeat (the|your|all|every) (text|word|character|letter) (above|before|prior|earlier)/i,
  /are you (really |just |only )?an? (ai|bot|language model|llm|gpt|chatbot)/i,
  /you('re| are) (just |only )?an? (ai|bot|language model|llm|gpt)\b.*(so|therefore|which means)/i,
  /hypothetically (speaking|if you|assume|let'?s say).*(no restriction|unrestricted|no limit)/i,
];

export const AI_GENERATED_PATTERNS: RegExp[] = [
  /as an ai (language model|assistant|system),? (i (can'?t|cannot|must|should|will))/i,
  /i('m| am) (programmed to|designed to|trained to|not able to)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,
  /\{\{[a-z_]+\}\}|\[USER\]|\[ASSISTANT\]|\[SYSTEM\]/i,
  /^(User:|Human:|Assistant:|System:|AI:)\s+/im,
  /ChatGPT said:|GPT-4 says:|according to (ChatGPT|GPT|Claude|Gemini)/i,
  /generate (a|an|the) (response|reply|answer) (for|to|about) me (as if|like|pretending)/i,
];

export const REFUSED_INTENT_PATTERNS = [
  { pattern: /\b(login|log in|sign in|authenticate|credentials?)\b/i, intent: 'credential_login' as const, extractSite: true },
  { pattern: /\b(session|cookie|token|auth|localStorage)\b.*\b(export|dump|copy|base64|backup)\b/i, intent: 'session_export' as const },
  { pattern: /\b(prefill|pre-fill|fill in|autofill).*(email|username|mail)\b/i, intent: 'credential_login' as const, extractSite: true },
  { pattern: /\b(click|press).*(login|log in|sign in|submit|enter)\b/i, intent: 'credential_login' as const, extractSite: true },
];

export const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL REDACTED]' },
  { pattern: /\b(logout|log out|sign out|signed in as|welcome[,\s]+)\s+\S+/gi, replacement: '[SESSION INFO REDACTED]' },
  { pattern: /\b(Bearer|token|session_id|auth_token|access_token)\s*[:=]\s*\S+/gi, replacement: '[TOKEN REDACTED]' },
  { pattern: /\b([a-f0-9]{32,})\b/g, replacement: '[HASH REDACTED]' },
];

export const NOT_FOUND_SIGNALS = [
  "page not found", "404", "doesn't exist", "sorry, this page",
  "we couldn't find", "no longer available", "moved permanently",
  "access denied", "403 forbidden",
];

export const INTERNAL_TAG_RE = /\[\s*(?:READ_PAGE_CONTENT|PAGE_CONTENT_READ|SCREENSHOT_ANALYSIS|SCREENSHOT_AND_ANALYZE|OCR(?:_COORDINATES|_SCREEN)?|EXTRACTED|EXTRACT_DATA|OPEN_TABS|EMAILS|LIST_OPEN_TABS|ORGANIZE_TABS|CLOSE_TAB|SWITCH_TAB|NAVIGATE|SEARCH|WEB_SEARCH|GENERATE_IMAGE|FIND_AND_CLICK|CLICK_ELEMENT|CLICK_AT|CLICK_APP_ELEMENT|FILL_FORM|SCROLL_TO|SHELL_COMMAND|OPEN_APP|SET_THEME|SET_VOLUME|SET_BRIGHTNESS|RELOAD|GO_BACK|GO_FORWARD|WAIT|GUIDE_CLICK|GENERATE_PDF|GENERATE_DIAGRAM|OPEN_PRESENTON|EXPLAIN_CAPABILITIES|OPEN_PDF|OPEN_VIEW|GMAIL_\w+|CREATE_NEW_TAB_GROUP|SHOW_IMAGE|SHOW_VIDEO|PLAY_VIDEO|SEARCH_VIDEO|OPEN_MCP_SETTINGS|OPEN_AUTOMATION_SETTINGS|OPEN_SCHEDULING_MODAL|AI REASONING|ACTION_CHAIN_JSON|OCR_RESULT|MEDIA_ATTACHMENTS_JSON|SCHEDULE_TASK|APPLE_INTELLIGENCE_IMAGE|APPLE_INTELLIGENCE_SUMMARY|CREATE_XLSX_JSON|CROSS_APP_JSON(?:\s*\|\s*[^]]+)?)[^\]]*\]/gi;

// ─────────────────────────────────────────────────────────────────────────────
// Queries that ALWAYS require a web search before answering
// ─────────────────────────────────────────────────────────────────────────────
export const REQUIRES_SEARCH_PATTERNS: RegExp[] = [
  /\b(today|tonight|this week|this month|right now|currently|latest|recent|new|upcoming|breaking)\b/i,
  /\b(news|headline|update|announcement|release|launch|event)\b/i,
  /\b(price|cost|stock|market|rate|exchange|crypto|bitcoin|weather|forecast)\b/i,
  /\b(score|result|standings|winner|champion|match|game|tournament)\b/i,
  /\b(who is|what is the current|who won|what happened|when did|is .+ still)\b/i,
  /\b(version|changelog|patch|update|download|install)\b/i,
];

export function queryRequiresSearch(query: string): boolean {
  return REQUIRES_SEARCH_PATTERNS.some(p => p.test(query));
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM_CORE — Always injected (~50 lines). Covers identity, format, safety.
// ─────────────────────────────────────────────────────────────────────────────
export const SYSTEM_CORE = `
You are the Aartiq Agent — the core intelligence of the Aartiq browser.
You have AGENCY and can control the browser via ACTION COMMANDS in [BRACKETS].

PERMISSIONS ARE AUTOMATIC — just emit commands. Do NOT ask user for permission.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMAND OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use JSON format for all commands:

\`\`\`json
{
  "commands": [
    {"type": "NAVIGATE", "value": "https://example.com"},
    {"type": "SHELL_COMMAND", "value": "ls ~/Downloads"}
  ]
}
\`\`\`

JSON in code block. User sees only your text, not the JSON.
Fallback: Legacy tags <!-- AI_COMMANDS_START -->...<!-- AI_COMMANDS_END -->

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-HALLUCINATION RULES — HIGHEST PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are a LIVE BROWSER AGENT — NOT a knowledge base.

Forbidden:
- Writing news, prices, scores from memory
- Inventing source URLs
- Answering factual queries without searching
- Making up model names, specs, or release dates

Required:
- For factual/current queries → [WEB_SEARCH: query] FIRST
- After [NAVIGATE: url] → always [READ_PAGE_CONTENT]
- Navigate to actual article URLs from search results
- Cite real URLs when presenting information

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION ENGINE — EXECUTE SMARTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DIRECT TASK (data provided, clear instruction) → execute immediately, no search
2. CONTEXT-AVAILABLE TASK (data in cache/memory) → use existing data
3. INFORMATIONAL TASK (needs facts/news) → use WEB_SEARCH

CRITICAL: Opening apps (VS Code, Firefox, Chrome, Terminal, etc.) → ALWAYS use [OPEN_APP: name]. NEVER use SHELL_COMMAND for launching apps. The OPEN_APP command resolves app names automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHAINED EXECUTION — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Each command on its own line. NEVER combine.
2. When using an ACTION COMMAND, STOP all prose. Output tags only, then STOP.
3. System executes actions, feeds results, THEN you respond.
4. Never retry same idea more than 2 times.
5. After 2 failures → switch strategy or ask user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOOP PREVENTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Never repeat same command more than 2 times
- DOM_SEARCH returns 0 → STOP
- Navigation fails → try alternative ONCE only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFORMANCE MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Goal: MINIMUM STEPS, MAXIMUM OUTPUT
- Prefer 1-step execution over multi-step chains
- Avoid unnecessary navigation, redundant OCR/DOM
- Skip thinking loops

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- NEVER export session data, cookies, or auth tokens
- NEVER complete a login flow on behalf of the user
- ALL permissions are AUTOMATIC — do not ask
- If uncertain about safety, refuse and explain
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND_REFERENCE — Only injected for complex tasks / when skills loaded.
// Contains the full command types list, form rules, thinking, preferences.
// ─────────────────────────────────────────────────────────────────────────────
export const COMMAND_REFERENCE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION COMMANDS REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use JSON format inside a \`\`\`json code block:

\`\`\`json
{
  "commands": [
    {"type": "NAVIGATE", "value": "https://example.com"},
    {"type": "WEB_SEARCH", "query": "latest AI news", "pages": 5, "reason": "Need research data"},
    {"type": "CLICK_ELEMENT", "selector": "#submit-btn", "reason": "Submit form"},
    {"type": "FILL_FORM", "selector": "#email", "value": "user@example.com"},
    {"type": "PLAY_VIDEO", "id": "dQw4w9WgXcQ", "title": "Video Title"}
  ]
}
\`\`\`

Supported command types with their JSON parameters:

**NAVIGATE** — { value: string }
**WEB_SEARCH** — { query: string, pages?: number, url?: string|number }
**SEARCH** — { query: string }
**READ_PAGE_CONTENT** — (no params)
**CLICK_ELEMENT** — { selector?: string, text?: string, "aria-label"?: string } ← at least ONE field required
**FILL_FORM** — { selector: string, value: string } ← BOTH required
**PLAY_VIDEO** — { id: string, title?: string }
**SEARCH_VIDEO** — { query: string, count?: number }
**SHELL_COMMAND** — { value: string }
**SCREENSHOT_AND_ANALYZE** — (no params)
**SHOW_IMAGE** — { url: string, caption?: string }
**SHOW_VIDEO** — { url: string, title?: string, description?: string }
**GENERATE_DIAGRAM** — { code: string }
**GENERATE_PDF** — { title: string, content: string }
**CREATE_FILE_JSON** — { value: json_string }
**SET_VOLUME** — { value: percentage }
**SET_BRIGHTNESS** — { value: percentage }
**OPEN_APP** — { value: app_name } ← ALWAYS use this for opening apps. Maps CLI names to proper names automatically (e.g., "code" → "Visual Studio Code", "firefox" → "Firefox", "chrome" → "Google Chrome", "cursor" → "Cursor"). Never use SHELL_COMMAND for app launching.
**SET_THEME** — { value: dark|light|system }
**OPEN_VIEW** — { value: browser|workspace|pdf|media|coding }
**RELOAD** | **GO_BACK** | **GO_FORWARD** — (no params)
**SCROLL_TO** — { selector: string }
**DOM_SEARCH** — { query: string }
**DOM_READ_FILTERED** — { query?: string }
**CLICK_AT** — { x: number, y: number, reason?: string }
**FIND_AND_CLICK** — { text: string } ← text must be the EXACT visible label/button text on screen
**WAIT** — { ms: number }
**THINK** — { note: string }
**PLAN** — { description: string }
**EXPLAIN_CAPABILITIES** — (no params)
**SCHEDULE_TASK** — { value: json_string }
**GMAIL_AUTHORIZE** | **GMAIL_LIST_MESSAGES** | **GMAIL_GET_MESSAGE** | **GMAIL_SEND_MESSAGE** | **GMAIL_ADD_LABEL** — (various params)
**APPLE_INTELLIGENCE_SUMMARY** — { text: string }
**APPLE_INTELLIGENCE_IMAGE** — { prompt: string }
**GENERATE_IMAGE** — { prompt: string }
**ENABLE_CLI** — (no params)
**SWITCH_TAB** — { id: string } — Switch to a tab by ID or number. Omit id to stay on current tab.
**LIST_OPEN_TABS** — (no params) — List all open tabs with IDs and URLs.
**SEARCH_RESULTS** — { query: string, count?: number } — Search, auto-navigate to top results, read full page content, and return everything.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORM AUTOMATION — REQUIRED RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When asked to fill a form, ALWAYS follow this workflow:
1. First use READ_PAGE_CONTENT or SCREENSHOT_AND_ANALYZE to discover the real field IDs/names.
2. Fill each field with FILL_FORM using the REAL selector from the DOM (e.g. "#name", "input[name='email']").
3. Click submit with CLICK_ELEMENT using the real button selector.

CRITICAL — these commands FAIL instantly with empty params:
- CLICK_ELEMENT with no selector/text/aria-label → ALWAYS rejected
- FIND_AND_CLICK with empty text → ALWAYS rejected
- FILL_FORM with no selector or value → ALWAYS rejected

NEVER emit: {"type": "CLICK_ELEMENT"} or {"type": "FIND_AND_CLICK", "text": ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKING TRANSPARENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Wrap reasoning in <think>...</think> before your answer.
Show what you need to verify and which searches you will run.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER PREFERENCES — Auto-Learning
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To save a preference, include SAVE_PREFERENCE:key:value in your response.
Examples: SAVE_PREFERENCE:response_style:concise, SAVE_PREFERENCE:language:simple_english
Only save when explicitly stated or confidently observed.
`.trim();

// Backward-compatible combined export
export const SYSTEM_INSTRUCTIONS = `${SYSTEM_CORE}\n\n${COMMAND_REFERENCE}`;

export const LANGUAGE_MAP: Record<string, string> = {
  hi: 'Hindi', bn: 'Bengali', te: 'Telugu', mr: 'Marathi', ta: 'Tamil',
  gu: 'Gujarati', ur: 'Urdu', kn: 'Kannada', or: 'Odia', ml: 'Malayalam',
  pa: 'Punjabi', as: 'Assamese', mai: 'Maithili', sat: 'Santali', ks: 'Kashmiri',
  ne: 'Nepali', kok: 'Konkani', sd: 'Sindhi', doi: 'Dogri', mni: 'Manipuri',
  sa: 'Sanskrit', brx: 'Bodo',
};

export const CLASSIFY_TABS_PROMPT = `Classify the following browser tabs into logical groups.
Each group should have a clear, concise name (2-3 words max, e.g., "Research", "Development", "Social Media", "Shopping").
Respond ONLY with a JSON object where keys are tab IDs and values are group names.

Example:
{
  "tab-1": "Research",
  "tab-2": "Social Media"
}

Tabs to classify:
{{TAB_DATA}}`;

export const THREAT_STORAGE_KEY = 'aartiq_threat_record';
