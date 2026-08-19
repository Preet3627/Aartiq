/**
 * Chrome importer — copy extensions installed in a real Chrome/Chromium profile
 * into Aartiq's extension directory.
 *
 * Chrome stores unpacked extension files at `<profile>/Extensions/<id>/<version>/`
 * with a `manifest.json`. We scan those directories, copy each into Aartiq's
 * extensions folder, and derive a stable id. Nothing is executed here; loading is
 * delegated to ChromeExtensionManager so the same validation path applies.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ImportedExtension {
  id: string;
  name: string;
  version: string;
  sourcePath: string;
  destPath: string;
}

function deriveId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 32);
  return `chrome-${base}-${Date.now().toString(36)}`;
}

function readManifest(dir: string): any | null {
  try {
    const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Locate a Chrome profile dir (supports the common macOS/Win/Linux layouts). */
export function findChromeProfile(hint?: string): string | null {
  const candidates: string[] = [];
  if (hint) candidates.push(hint);
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) {
    candidates.push(path.join(home, 'Library/Application Support/Google/Chrome/Default'));
    candidates.push(path.join(home, 'Library/Application Support/Google/Chrome'));
    candidates.push(path.join(home, '.config/google-chrome/Default'));
    candidates.push(path.join(home, 'AppData/Local/Google/Chrome/User Data/Default'));
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'Extensions'))) return c;
  }
  return null;
}

/**
 * Import all extensions from a Chrome profile into `destDir`.
 * Returns the list successfully copied. Failures are reported, not thrown.
 */
export function importFromChrome(profileDir: string, destDir: string, filterIds?: string[]): ImportedExtension[] {
  const extRoot = path.join(profileDir, 'Extensions');
  if (!fs.existsSync(extRoot)) return [];
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const imported: ImportedExtension[] = [];
  for (const id of fs.readdirSync(extRoot)) {
    if (filterIds && !filterIds.includes(id)) continue;
    const idDir = path.join(extRoot, id);
    if (!fs.statSync(idDir).isDirectory()) continue;
    const versions = fs.readdirSync(idDir).filter((v) => /^\d+(\.\d+)*$/.test(v));
    if (versions.length === 0) continue;
    const version = versions.sort().pop()!;
    const src = path.join(idDir, version);
    const manifest = readManifest(src);
    if (!manifest) continue;
    const destId = deriveId(manifest.name || id);
    const dest = path.join(destDir, destId);
    copyDir(src, dest);
    imported.push({ id: destId, name: manifest.name || id, version: manifest.version || version, sourcePath: src, destPath: dest });
  }
  return imported;
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
