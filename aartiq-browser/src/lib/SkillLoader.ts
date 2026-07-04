import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface SkillCache {
  [format: string]: string;
}

class SkillLoader {
  private static instance: SkillLoader;
  private cache: SkillCache = {};
  private initialized = false;

  private constructor() {}

  public static getInstance(): SkillLoader {
    if (!SkillLoader.instance) {
      SkillLoader.instance = new SkillLoader();
    }
    return SkillLoader.instance;
  }

  private isDev(): boolean {
    return !app.isPackaged;
  }

  private getSkillPaths(format: string): string[] {
    const skillFile = `${format}.md`;
    const isDevMode = this.isDev();

    if (isDevMode) {
      return [
        path.join(__dirname, '../../public/skills', skillFile),
        path.join(process.cwd(), 'public/skills', skillFile),
      ];
    }

    return [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'public/skills', skillFile),
      path.join(app.getPath('userData'), 'skills', skillFile),
      path.join(__dirname, 'public/skills', skillFile),
    ];
  }

  private findExistingPath(paths: string[]): string | null {
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

  private getFallbackInstructions(format: string): string {
    const fallbacks: { [key: string]: string } = {
      pdf: `PDF Generation (Fallback - .dmg):
- Use Electron's printToPDF for PDF creation
- Prefer JavaScript libraries (pdf-lib, pdfkit) when possible
- If Python/pypdf is unavailable (common in .dmg builds), skip Python-based operations
- Use reportlab only if available, otherwise use JS-only approach
- For watermarks: use CSS absolute positioning with @media print
- Key JSON fields: title, template, content, pages, images, watermark, bgColor`,

      docx: `DOCX Generation (Fallback - .dmg):
- Use docx-js library (npm install docx)
- Prefer JavaScript-only pipeline
- If Python/soffice unavailable (common in .dmg builds), skip LibreOffice QA
- For page size: use DXA units (1440 DXA = 1 inch)
- US Letter: 12240 x 15840 DXA
- NEVER use unicode bullets - use LevelFormat.BULLET with numbering config
- Tables: set BOTH table width AND columnWidths with DXA
- Use WidthType.DXA (not PERCENTAGE - breaks in Google Docs)
- ImageRun: REQUIRED type parameter (png/jpg/etc)
- Headers/Footers: use Table-based for professional look`,

      pptx: `PPTX Generation (Fallback - .dmg):
- Use pptxgenjs library (npm install pptxgenjs)
- Prefer JavaScript-only pipeline
- If Python/soffice unavailable (common in .dmg builds), skip PDF conversion QA
- For templates: use the God-tier slide structures in skill
- Color palettes: choose bold, content-informed colors (not generic blue)
- Slides need visual elements - no text-only slides
- Use DXA units for positioning
- Cover slide: dark background with accent bars
- Content slides: header bar with accent color
- ALWAYS do visual QA - convert to images and inspect`,
    };

    return fallbacks[format] || 'No skill instructions available.';
  }

  public async load(format: string): Promise<string> {
    const normalizedFormat = format.toLowerCase();

    if (this.cache[normalizedFormat]) {
      return this.cache[normalizedFormat];
    }

    const paths = this.getSkillPaths(normalizedFormat);
    const existingPath = this.findExistingPath(paths);

    if (existingPath) {
      try {
        const content = fs.readFileSync(existingPath, 'utf-8');
        const skillContent = this.extractSkillContent(content, normalizedFormat);
        this.cache[normalizedFormat] = skillContent;
        console.log(`[SkillLoader] Loaded skill for ${normalizedFormat} from: ${existingPath}`);
        return skillContent;
      } catch (e) {
        console.error(`[SkillLoader] Error reading skill file: ${existingPath}`, e);
      }
    }

    console.log(`[SkillLoader] Skill file not found for ${normalizedFormat}, using fallback`);
    const fallback = this.getFallbackInstructions(normalizedFormat);
    this.cache[normalizedFormat] = fallback;
    return fallback;
  }

  private extractSkillContent(content: string, format: string): string {
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

    const runtimeNoteRegex = /> Comet runtime note:[\s\S]*?---/;
    skillContent = skillContent.replace(runtimeNoteRegex, '').trim();

    return skillContent;
  }

  public clearCache(): void {
    this.cache = {};
  }

  public isCached(format: string): boolean {
    return !!this.cache[format.toLowerCase()];
  }
}

export const skillLoader = SkillLoader.getInstance();
export default skillLoader;
