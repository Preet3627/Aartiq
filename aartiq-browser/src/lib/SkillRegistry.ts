/**
 * SkillRegistry — on-demand skill discovery and loading.
 * The AI can list available skills and load specific ones, instead of
 * injecting ALL skill content into the system prompt every time.
 */

export interface SkillMeta {
  id: string;
  label: string;
  description: string;
  patterns: RegExp;
  icon: string;
}

export const AVAILABLE_SKILLS: SkillMeta[] = [
  { id: 'research', label: 'Research & Web Search', description: 'Deep research, news gathering, fact-checking, web search workflows', patterns: /\b(news|research|search|find|what is|who is|latest|today|price|score|weather|forecast|current|update|announce)\b/i, icon: '🔍' },
  { id: 'documents', label: 'Document Processing', description: 'PDF, DOCX, PPTX, XLSX generation and processing', patterns: /\b(pdf|docx?|pptx?|xlsx?|document|report|export)\b/i, icon: '📄' },
  { id: 'browsing', label: 'Web Browsing', description: 'Navigate websites, read pages, interact with web content', patterns: /\b(navigate|visit|go to|open website|read page|browse|url)\b/i, icon: '🌐' },
  { id: 'automation', label: 'System Automation', description: 'Shell commands, app launching, cross-app control, OCR', patterns: /\b(ocr|click|automation|cross.app|shell|terminal|open app|organize|desktop|robot)\b/i, icon: '⚙️' },
  { id: 'mcp', label: 'MCP Integration', description: 'Model Context Protocol servers and external tool connections', patterns: /\b(github|google drive|dropbox|slack|mcp|connect|integration)\b/i, icon: '🔗' },
  { id: 'apple-intelligence', label: 'Apple Intelligence', description: 'On-device AI, summarization, Image Playground, Genmoji', patterns: /\b(apple.intelligence|summarize|image playground|genmoji|on.device)\b/i, icon: '🍎' },
  { id: 'image-generation', label: 'Image Generation', description: 'AI image creation with DALL-E, Stable Diffusion, and more', patterns: /\b(generat.(image|picture)|dall.e|stable diffusion|create (image|illustration|art))\b/i, icon: '🎨' },
  { id: 'scheduling', label: 'Task Scheduling', description: 'Cron-like scheduling, reminders, recurring automation', patterns: /\b(schedule|remind|cron|recurring|every (day|hour|week|minute)|at \d|alarm)\b/i, icon: '📅' },
  { id: 'security', label: 'Security & Permissions', description: 'Permission management, risk assessment, biometric auth', patterns: /\b(security|permission|auth|safe|risk|dangerous|unlock)\b/i, icon: '🛡️' },
  { id: 'settings', label: 'Settings Management', description: 'Configure Aartiq preferences, search behavior, AI settings', patterns: /\b(setting|configure|config|preference|customize|update setting|change setting|max.?page|budget|search.?engine|depth|extraction)\b/i, icon: '⚙️' },
];

/**
 * Match user message against skill patterns, return matching skill IDs.
 */
export function matchSkills(message: string): string[] {
  const matched: string[] = [];
  for (const skill of AVAILABLE_SKILLS) {
    if (skill.patterns.test(message)) {
      matched.push(skill.id);
    }
  }
  // Always include security for sensitive terms
  if (/\b(password|token|credential|login|auth|cookie|session|key)\b/i.test(message)) {
    if (!matched.includes('security')) matched.push('security');
  }
  // Always include automation for shell/organize
  if (/\b(shell|terminal|command|rm |mkdir|mv |organize)\b/i.test(message)) {
    if (!matched.includes('automation')) matched.push('automation');
  }
  return matched;
}

/**
 * Get short summary of a skill for the AI to decide whether to load it.
 */
export function getSkillSummary(skillId: string): SkillMeta | undefined {
  return AVAILABLE_SKILLS.find(s => s.id === skillId);
}

/**
 * List all available skills with their descriptions (for AI to read).
 */
export function listAllSkills(): string {
  return AVAILABLE_SKILLS.map(s => `${s.icon} **${s.label}** (\`${s.id}\`)\n  ${s.description}`).join('\n\n');
}
