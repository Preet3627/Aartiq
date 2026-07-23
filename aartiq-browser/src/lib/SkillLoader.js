/**
 * SkillLoader — pure JS implementation for Electron main process.
 * Loads skill guide markdown files from public/skills/ directory.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SkillLoader {
  constructor() {
    this.cache = {};
  }

  static getInstance() {
    if (!SkillLoader._instance) {
      SkillLoader._instance = new SkillLoader();
    }
    return SkillLoader._instance;
  }

  getSkillPaths(format) {
    const skillFile = `${format}.md`;
    return [
      path.join(app.getAppPath(), 'public/skills', skillFile),
      path.join(__dirname, '../../public/skills', skillFile),
      path.join(process.cwd(), 'public/skills', skillFile),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'public/skills', skillFile),
      path.join(app.getPath('userData'), 'skills', skillFile),
    ];
  }

  findExistingPath(paths) {
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          return p;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  getFallbackInstructions(format) {
    const fallbacks = {
      pdf: 'PDF Generation: Use Electron printToPDF or pdf-lib/pdfkit JS libraries.',
      docx: 'DOCX Generation: Use docx-js library. Use DXA units for sizing.',
      pptx: 'PPTX Generation: Use pptxgenjs library. Use bold, content-informed colors.',
    };
    return fallbacks[format] || 'No skill instructions available.';
  }

  extractSkillContent(content, format) {
    const lines = content.split('\n');
    let startIndex = 0;
    let foundFrontmatterStart = false;
    let foundFrontmatterEnd = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('---') && !foundFrontmatterStart) {
        foundFrontmatterStart = true;
        continue;
      }
      if (foundFrontmatterStart && !foundFrontmatterEnd && line.startsWith('---')) {
        foundFrontmatterEnd = true;
        startIndex = i + 1;
        continue;
      }
    }

    // If we found frontmatter, slice after it; otherwise return full content
    let skillContent = lines.slice(startIndex).join('\n').trim();

    // Remove runtime notes
    const runtimeNoteRegex = /> Aartiq runtime note:[\s\S]*?---/;
    skillContent = skillContent.replace(runtimeNoteRegex, '').trim();

    return skillContent;
  }

  async load(format) {
    const normalizedFormat = format.toLowerCase();

    // Always re-read from disk to pick up edits (cache invalidated after 60s)
    const cached = this.cache[normalizedFormat];
    if (cached && cached._loadedAt && (Date.now() - cached._loadedAt < 60000)) {
      return cached.content;
    }

    const paths = this.getSkillPaths(normalizedFormat);
    const existingPath = this.findExistingPath(paths);

    if (existingPath) {
      try {
        const content = fs.readFileSync(existingPath, 'utf-8');
        const skillContent = this.extractSkillContent(content, normalizedFormat);
        this.cache[normalizedFormat] = { content: skillContent, _loadedAt: Date.now() };
        console.log(`[SkillLoader] Loaded skill for ${normalizedFormat} from: ${existingPath}`);
        return skillContent;
      } catch (e) {
        console.error(`[SkillLoader] Error reading skill file: ${existingPath}`, e);
      }
    }

    console.log(`[SkillLoader] Skill file not found for ${normalizedFormat}, searched:`, paths);
    const fallback = this.getFallbackInstructions(normalizedFormat);
    this.cache[normalizedFormat] = { content: fallback, _loadedAt: Date.now() };
    return fallback;
  }

  clearCache() {
    this.cache = {};
  }

  isCached(format) {
    return !!this.cache[format.toLowerCase()];
  }
}

const skillLoader = SkillLoader.getInstance();
module.exports = { skillLoader, SkillLoader };
