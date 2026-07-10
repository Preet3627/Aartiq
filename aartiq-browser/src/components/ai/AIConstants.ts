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

export const INTERNAL_TAG_RE = /\[\s*(?:READ_PAGE_CONTENT|PAGE_CONTENT_READ|SCREENSHOT_ANALYSIS|SCREENSHOT_AND_ANALYZE|OCR(?:_COORDINATES|_SCREEN)?|EXTRACTED|EXTRACT_DATA|OPEN_TABS|EMAILS|LIST_OPEN_TABS|ORGANIZE_TABS|CLOSE_TAB|NAVIGATE|SEARCH|WEB_SEARCH|GENERATE_IMAGE|FIND_AND_CLICK|CLICK_ELEMENT|CLICK_AT|CLICK_APP_ELEMENT|FILL_FORM|SCROLL_TO|SHELL_COMMAND|OPEN_APP|SET_THEME|SET_VOLUME|SET_BRIGHTNESS|RELOAD|GO_BACK|GO_FORWARD|WAIT|GUIDE_CLICK|GENERATE_PDF|GENERATE_DIAGRAM|OPEN_PRESENTON|EXPLAIN_CAPABILITIES|OPEN_PDF|OPEN_VIEW|GMAIL_\w+|CREATE_NEW_TAB_GROUP|SHOW_IMAGE|SHOW_VIDEO|OPEN_MCP_SETTINGS|OPEN_AUTOMATION_SETTINGS|OPEN_SCHEDULING_MODAL|AI REASONING|ACTION_CHAIN_JSON|OCR_RESULT|MEDIA_ATTACHMENTS_JSON|SCHEDULE_TASK|APPLE_INTELLIGENCE_IMAGE|APPLE_INTELLIGENCE_SUMMARY|CREATE_XLSX_JSON|CROSS_APP_JSON(?:\s*\|\s*[^]]+)?)[^\]]*\]/gi;

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

export const SYSTEM_INSTRUCTIONS = `
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACTION COMMANDS REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use JSON format for all commands. Bracket format is fallback only.

- [NAVIGATE: url]
- [WEB_SEARCH: query]
- [SEARCH: query]
- [READ_PAGE_CONTENT]
- [SCREENSHOT_AND_ANALYZE]
- [LIST_OPEN_TABS]
- [CREATE_FILE_JSON: <JSON>] — ALL document generation (pdf/docx/pptx)
- [CREATE_PDF_JSON: <JSON>] — PDF reports
- [GENERATE_PDF: Title | author:Name | content...] — FALLBACK ONLY
- [SHOW_IMAGE: url | caption]
- [SHOW_VIDEO: url | title | description]
- [GENERATE_DIAGRAM: mermaid_code]
- [SHELL_COMMAND: command]
- [SET_BRIGHTNESS: percentage]
- [SET_VOLUME: percentage]
- [OPEN_APP: app_name]
- [SET_THEME: dark|light|system]
- [OPEN_VIEW: browser|workspace|pdf|media|coding]
- [RELOAD] [GO_BACK] [GO_FORWARD]
- [FILL_FORM: selector | value]
- [SCROLL_TO: selector | position]
- [EXTRACT_DATA: selector]
- [CREATE_NEW_TAB_GROUP: name | urls]
- [OCR_COORDINATES: x,y,w,h]
- [OCR_SCREEN: x,y,w,h]
- [CROSS_APP_JSON: {"actions":[...]}]
- [DOM_SEARCH: query]
- [DOM_READ_FILTERED: query]
- [CLICK_ELEMENT: selector | reason]
- [CLICK_AT: x,y | reason]
- [CLICK_APP_ELEMENT: app | text | reason]
- [FIND_AND_CLICK: text | reason]
- [IMAGE_URL: url | caption:caption]
- [CAPTURE_SCREEN | caption:caption]
- [GMAIL_AUTHORIZE] [GMAIL_LIST_MESSAGES: query | max] [GMAIL_GET_MESSAGE: id] [GMAIL_SEND_MESSAGE: to | sub | body | thread] [GMAIL_ADD_LABEL: id | label]
- [WAIT: ms]
- [GUIDE_CLICK: desc | x,y,w,h]
- [OPEN_PRESENTON: prompt]
- [EXPLAIN_CAPABILITIES]
- [OPEN_MCP_SETTINGS]
- [OPEN_AUTOMATION_SETTINGS]
- [ENABLE_CLI]
- [ORGANIZE_TABS]
- [CLOSE_TAB: tabId]
- [THINK: note] [PLAN: description]
- [SCHEDULE_TASK: <JSON>]  Schedule recurring tasks. Supported types: open-url (opens a URL), ai-prompt, web-scrape, pdf-generate, workflow, daily-brief, shell. Examples:
  {"schedule": "41 11 * * *", "type": "open-url", "url": "https://web.whatsapp.com", "name": "Open WhatsApp"}
  {"schedule": "0 8 * * *", "type": "shell", "command": "open https://news.ycombinator.com", "name": "Open HN"}
  {"schedule": "0 9 * * 1", "type": "pdf-generate", "name": "Weekly Report", "description": "Generate weekly PDF report"}
  Always use SCHEDULE_TASK for scheduling — do NOT create shell scripts or manual cron instructions.
- [APPLE_INTELLIGENCE_SUMMARY: text]
- [APPLE_INTELLIGENCE_IMAGE: prompt]
- [GENERATE_IMAGE: prompt]

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
