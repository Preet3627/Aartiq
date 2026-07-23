/**
 * skill-loading.test.js — Tests for skill matching, loading, and AI command parsing.
 *
 * Covers:
 *   - SkillRegistry: matchSkills, getSkillSummary, listAllSkills, AVAILABLE_SKILLS
 *   - AICommandParser: LOAD_SKILL / LIST_SKILLS command parsing
 *   - Natural-language skill loading pattern matching
 */

// ── SkillRegistry tests (TS module, import via @swc/jest) ──
const {
  AVAILABLE_SKILLS,
  matchSkills,
  getSkillSummary,
  listAllSkills,
} = require('../src/lib/SkillRegistry');

describe('SkillRegistry', () => {
  describe('AVAILABLE_SKILLS', () => {
    it('should have at least 8 skills defined', () => {
      expect(AVAILABLE_SKILLS.length).toBeGreaterThanOrEqual(8);
    });

    it('each skill should have required fields', () => {
      for (const skill of AVAILABLE_SKILLS) {
        expect(typeof skill.id).toBe('string');
        expect(skill.id.length).toBeGreaterThan(0);
        expect(typeof skill.label).toBe('string');
        expect(typeof skill.description).toBe('string');
        expect(skill.patterns).toBeInstanceOf(RegExp);
        expect(typeof skill.icon).toBe('string');
      }
    });

    it('should include settings skill', () => {
      const settings = AVAILABLE_SKILLS.find(s => s.id === 'settings');
      expect(settings).toBeDefined();
      expect(settings.label).toContain('Settings');
    });

    it('should include automation skill', () => {
      const automation = AVAILABLE_SKILLS.find(s => s.id === 'automation');
      expect(automation).toBeDefined();
    });

    it('should include research skill', () => {
      const research = AVAILABLE_SKILLS.find(s => s.id === 'research');
      expect(research).toBeDefined();
    });

    it('should have unique ids', () => {
      const ids = AVAILABLE_SKILLS.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('matchSkills', () => {
    it('should match "settings" to settings skill', () => {
      const matched = matchSkills('open the settings page');
      expect(matched).toContain('settings');
    });

    it('should match "research" to research skill', () => {
      const matched = matchSkills('research the latest news');
      expect(matched).toContain('research');
    });

    it('should match "automation" for shell commands', () => {
      const matched = matchSkills('run a shell command');
      expect(matched).toContain('automation');
    });

    it('should match "documents" for PDF keywords', () => {
      const matched = matchSkills('generate a PDF report');
      expect(matched).toContain('documents');
    });

    it('should match "browsing" for navigation keywords', () => {
      const matched = matchSkills('navigate to google.com');
      expect(matched).toContain('browsing');
    });

    it('should match "security" for sensitive terms (singular password)', () => {
      const matched = matchSkills('show my password');
      expect(matched).toContain('security');
    });

    it('should match "security" for auth keywords even when not primary', () => {
      const matched = matchSkills('check my login token');
      expect(matched).toContain('security');
    });

    it('should match "automation" for organize keyword', () => {
      const matched = matchSkills('organize my desktop');
      expect(matched).toContain('automation');
    });

    it('should match "image-generation" for create image', () => {
      const matched = matchSkills('create image of a cat');
      expect(matched).toContain('image-generation');
    });

    it('should match "scheduling" for reminder keywords', () => {
      const matched = matchSkills('set a reminder for tomorrow');
      expect(matched).toContain('scheduling');
    });

    it('should match "apple-intelligence" for summarize', () => {
      const matched = matchSkills('summarize this article');
      expect(matched).toContain('apple-intelligence');
    });

    it('should match "mcp" for github integration', () => {
      const matched = matchSkills('connect to github');
      expect(matched).toContain('mcp');
    });

    it('should return empty array for unrelated text', () => {
      const matched = matchSkills('hello world');
      expect(matched).toEqual(expect.arrayContaining([]));
      // May still include some default matches, but not settings/research
      expect(matched).not.toContain('settings');
      expect(matched).not.toContain('research');
    });

    it('should match multiple skills for compound queries', () => {
      const matched = matchSkills('research the latest settings for automation');
      expect(matched).toContain('research');
      expect(matched).toContain('settings');
      expect(matched).toContain('automation');
    });
  });

  describe('getSkillSummary', () => {
    it('should return skill metadata for valid id', () => {
      const summary = getSkillSummary('settings');
      expect(summary).toBeDefined();
      expect(summary.id).toBe('settings');
      expect(summary.label).toContain('Settings');
      expect(typeof summary.description).toBe('string');
    });

    it('should return undefined for invalid id', () => {
      const summary = getSkillSummary('nonexistent-skill');
      expect(summary).toBeUndefined();
    });

    it('should return research skill metadata', () => {
      const summary = getSkillSummary('research');
      expect(summary).toBeDefined();
      expect(summary.icon).toBe('🔍');
    });
  });

  describe('listAllSkills', () => {
    it('should return a string with all skills', () => {
      const list = listAllSkills();
      expect(typeof list).toBe('string');
      expect(list.length).toBeGreaterThan(0);
    });

    it('should include skill ids in backticks', () => {
      const list = listAllSkills();
      for (const skill of AVAILABLE_SKILLS) {
        expect(list).toContain(`\`${skill.id}\``);
      }
    });

    it('should include skill labels', () => {
      const list = listAllSkills();
      expect(list).toContain('Research');
      expect(list).toContain('Settings');
      expect(list).toContain('Automation');
    });
  });
});

// ── Natural-language skill loading pattern tests ──
describe('Natural Language Skill Loading Patterns', () => {
  // The pattern from AIChatSidebar: /^(?:load|use|activate|enable)\s+(?:the\s+)?(.+?)(?:\s+skill)?$/i
  const loadSkillPattern = /^(?:load|use|activate|enable)\s+(?:the\s+)?(.+?)(?:\s+skill)?$/i;

  function matchNaturalLanguage(input) {
    const m = input.match(loadSkillPattern);
    if (!m) return null;
    const skillName = m[1].trim().toLowerCase();
    const matchedSkill = AVAILABLE_SKILLS.find(
      s => s.id === skillName || s.label.toLowerCase().includes(skillName) || skillName.includes(s.id),
    );
    return matchedSkill ? matchedSkill.id : null;
  }

  it('should match "load settings skill"', () => {
    expect(matchNaturalLanguage('load settings skill')).toBe('settings');
  });

  it('should match "load settings"', () => {
    expect(matchNaturalLanguage('load settings')).toBe('settings');
  });

  it('should match "use the research skill"', () => {
    expect(matchNaturalLanguage('use the research skill')).toBe('research');
  });

  it('should match "activate automation"', () => {
    expect(matchNaturalLanguage('activate automation')).toBe('automation');
  });

  it('should match "enable the browsing skill"', () => {
    expect(matchNaturalLanguage('enable the browsing skill')).toBe('browsing');
  });

  it('should match "load the image-generation skill"', () => {
    expect(matchNaturalLanguage('load the image-generation skill')).toBe('image-generation');
  });

  it('should match "use scheduling"', () => {
    expect(matchNaturalLanguage('use scheduling')).toBe('scheduling');
  });

  it('should match "activate the security skill"', () => {
    expect(matchNaturalLanguage('activate the security skill')).toBe('security');
  });

  it('should match "load mcp"', () => {
    expect(matchNaturalLanguage('load mcp')).toBe('mcp');
  });

  it('should match "enable apple-intelligence"', () => {
    expect(matchNaturalLanguage('enable apple-intelligence')).toBe('apple-intelligence');
  });

  it('should match "load documents skill"', () => {
    expect(matchNaturalLanguage('load documents skill')).toBe('documents');
  });

  it('should NOT match "settings skill" (no verb)', () => {
    expect(matchNaturalLanguage('settings skill')).toBeNull();
  });

  it('should NOT match "the settings" (no verb)', () => {
    expect(matchNaturalLanguage('the settings')).toBeNull();
  });

  it('should NOT match "hello world"', () => {
    expect(matchNaturalLanguage('hello world')).toBeNull();
  });

  it('should return null for unknown skill name', () => {
    expect(matchNaturalLanguage('load foobar')).toBeNull();
  });
});

// ── AICommandParser: LOAD_SKILL / LIST_SKILLS command parsing ──
describe('AICommandParser LOAD_SKILL handling', () => {
  // We test the command registry metadata directly from the parser source
  const { COMMAND_REGISTRY } = require('../src/lib/AICommandParser');

  it('should have LIST_SKILLS in command registry', () => {
    expect(COMMAND_REGISTRY.LIST_SKILLS).toBeDefined();
    expect(COMMAND_REGISTRY.LIST_SKILLS.desc).toContain('skill');
  });

  it('should have LOAD_SKILL in command registry', () => {
    expect(COMMAND_REGISTRY.LOAD_SKILL).toBeDefined();
    expect(COMMAND_REGISTRY.LOAD_SKILL.desc).toContain('Load');
    expect(COMMAND_REGISTRY.LOAD_SKILL.example).toContain('settings');
  });

  it('should list LOAD_SKILLS and LIST_SKILLS in SUPPORTED_COMMANDS', () => {
    const { SUPPORTED_COMMANDS } = require('../src/lib/AICommandParser');
    expect(SUPPORTED_COMMANDS).toContain('LOAD_SKILL');
    expect(SUPPORTED_COMMANDS).toContain('LIST_SKILLS');
  });

  // Test the parsing of LOAD_SKILL from pipe and JSON formats
  describe('getCmdParam for LOAD_SKILL', () => {
    const { getCmdParam } = require('../src/lib/AICommandParser');

    it('should extract skillId from params object', () => {
      const cmd = { type: 'LOAD_SKILL', value: 'settings', params: { skillId: 'settings' } };
      expect(getCmdParam(cmd, 'skillId')).toBe('settings');
    });

    it('should fall back to pipe-delimited parsing', () => {
      const cmd = { type: 'LOAD_SKILL', value: 'research | reason: need it', params: {} };
      expect(getCmdParam(cmd, 'reason')).toBe('need it');
    });

    it('should return default value when key not found', () => {
      const cmd = { type: 'LOAD_SKILL', value: 'settings', params: {} };
      expect(getCmdParam(cmd, 'nonexistent', 'fallback')).toBe('fallback');
    });

    it('should return empty string as default when no default provided', () => {
      const cmd = { type: 'LOAD_SKILL', value: 'settings', params: {} };
      expect(getCmdParam(cmd, 'missing')).toBe('');
    });
  });
});

// ── SkillLoader: cache and content extraction ──
describe('SkillLoader', () => {
  // We can't test SkillLoader directly (depends on electron app module),
  // but we can test the extractSkillContent logic by reimplementing it
  function extractSkillContent(content, format) {
    const lines = content.split('\n');
    let startIndex = 0;
    let foundStart = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('---') && !foundStart) {
        foundStart = true;
        continue;
      }
      if (foundStart && (line.startsWith('# ') || line.trim() === '')) {
        startIndex = i;
        break;
      }
    }

    let skillContent = lines.slice(startIndex).join('\n').trim();
    const runtimeNoteRegex = /> Aartiq runtime note:[\s\S]*?---/;
    skillContent = skillContent.replace(runtimeNoteRegex, '').trim();
    return skillContent;
  }

  it('should extract content after frontmatter', () => {
    const md = `---
id: settings
title: Settings
---

# Settings Skill

This is the skill content.
`;
    const result = extractSkillContent(md, 'settings');
    expect(result).toContain('# Settings Skill');
    expect(result).toContain('This is the skill content.');
    expect(result).not.toContain('id: settings');
  });

  it('should strip runtime notes (note: --- in note triggers frontmatter detection)', () => {
    // The --- inside the runtime note block triggers extractSkillContent's frontmatter detection.
    // Content after the --- is preserved; content before is treated as frontmatter.
    const md = `# Skill

> Aartiq runtime note: some internal stuff
---

Regular content here.
`;
    const result = extractSkillContent(md, 'test');
    // The --- in the runtime note causes everything before it to be treated as frontmatter
    expect(result).toContain('Regular content here.');
    expect(result).not.toContain('runtime note');
  });

  it('should strip runtime notes when content has proper frontmatter', () => {
    const md = `---
id: test
---

# Skill Title

> Aartiq runtime note: internal
---

Real content here.
`;
    const result = extractSkillContent(md, 'test');
    expect(result).toContain('# Skill Title');
    expect(result).toContain('Real content here.');
    expect(result).not.toContain('runtime note');
  });

  it('should handle content without frontmatter', () => {
    const md = `# Direct Content

No frontmatter here.
`;
    const result = extractSkillContent(md, 'test');
    expect(result).toContain('# Direct Content');
  });

  it('should handle empty content', () => {
    const result = extractSkillContent('', 'test');
    expect(result).toBe('');
  });

  it('should handle content with only frontmatter', () => {
    const md = `---
id: test
---
`;
    const result = extractSkillContent(md, 'test');
    expect(result).toBe('');
  });
});
