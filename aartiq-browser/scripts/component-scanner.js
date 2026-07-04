#!/usr/bin/env node
/**
 * Component Scanner Script
 * 
 * Automatically scans aartiq-browser/src and flutter_browser_app/lib
 * and generates line counts and metadata for documentation.
 * 
 * Usage:
 *   node scripts/component-scanner.js           # Scan and output JSON
 *   node scripts/component-scanner.js --update  # Update component-data.json
 *   node scripts/component-scanner.js --flutter # Scan Flutter components
 *   node scripts/component-scanner.js --missing  # Find undocumented components
 *   node scripts/component-scanner.js --all      # Scan both desktop and flutter
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'components', 'component-data.json');

// Only TypeScript files (no .js duplicates)
const EXTENSIONS = ['.ts', '.tsx'];

// Tags for auto-detection
const TAG_PATTERNS = {
  'React': /\b(react|useState|useEffect|useCallback|useMemo)\b/,
  'Node.js': /\b(fs|path|child_process|crypto)\b/,
  'Swift': /\bswift\b|import\s+\w+UI|@objc\s/,
  'SwiftUI': /SwiftUI|@State|@Binding|struct\s\w+View/,
  'Core': /\bIPC|ipcMain|ipcRenderer\b/,
  'Security': /\bsecurity|validate|sanitize|XSS\b/i,
  'AI': /\bAI|chat|model|completion\b/i,
  'Sync': /\bSync|WebSocket|QR\b/,
  'Automation': /\bautomation|robot|schedule\b/i,
  'PDF': /\bpdf|document|template\b/i,
  'OCR': /\bocr|tesseract|recognize\b/i,
  'Plugin': /\bplugin|hook|extension\b/i,
  'macOS': /\bmacos|apple|ns\w+|NS\w+/i,
  'Windows': /\bwindows|powershell|win32\b/i,
  'Linux': /\blinux|xdotool|xte\b/i,
  'Flutter': /\bFlutter|Dart|Widget|StatefulWidget\b/,
};

function detectTags(content, filename) {
  const tags = [];
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.tsx') tags.push('React');
  if (ext === '.dart') tags.push('Flutter');
  
  for (const [tag, pattern] of Object.entries(TAG_PATTERNS)) {
    if (pattern.test(content) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

function countLines(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return content.split('\n').length;
  } catch (err) {
    return 0;
  }
}

function getDescription(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (jsdocMatch) {
      const descMatch = jsdocMatch[0].match(/@description\s+(.+)/);
      if (descMatch) return descMatch[1].trim().slice(0, 100);
    }
    return '';
  } catch (err) {
    return '';
  }
}

function scanDirectory(dir, baseDir = dir) {
  const results = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' ||
          entry.name === '__pycache__') {
        continue;
      }
      results.push(...scanDirectory(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Support TypeScript for desktop, Dart for Flutter
      const isDesktop = dir.includes('/src/') || dir.includes('\\src\\');
      const validExts = isDesktop ? ['.ts', '.tsx'] : ['.dart'];
      
      if (validExts.includes(ext)) {
        const filename = path.basename(fullPath);
        const relativePath = path.relative(baseDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = countLines(fullPath);
        const tags = detectTags(content, filename);
        const description = getDescription(fullPath) || guessDescription(filename);
        
        results.push({
          name: filename,
          path: relativePath.replace(/\\/g, '/'),
          lines,
          description,
          tags,
          lastModified: fs.statSync(fullPath).mtime.toISOString().split('T')[0]
        });
      }
    }
  }
  
  return results;
}

function guessDescription(filepath) {
  const filename = path.basename(filepath, path.extname(filepath));
  
  const patterns = [
    { pattern: /([A-Z][a-z]+(?:[A-Z][a-z]+)+)/, transform: (m) => m.replace(/([A-Z])/g, ' $1').trim() },
    { pattern: /^(\w+)Page$/, transform: (m) => `${m.replace('Page', '')} page component` },
    { pattern: /^(\w+)Panel$/, transform: (m) => `${m.replace('Panel', '')} panel` },
    { pattern: /^(\w+)Modal$/, transform: (m) => `${m.replace('Modal', '')} modal dialog` },
    { pattern: /^(\w+)Settings$/, transform: (m) => `${m.replace('Settings', '')} settings` },
    { pattern: /^(\w+)Overlay$/, transform: (m) => `${m.replace('Overlay', '')} overlay` },
    { pattern: /^(\w+)Service$/, transform: (m) => `${m.replace('Service', '')} service` },
    { pattern: /^(\w+)Manager$/, transform: (m) => `${m.replace('Manager', '')} manager` },
  ];
  
  for (const { pattern, transform } of patterns) {
    const match = filename.match(pattern);
    if (match) return transform(match[0]);
  }
  
  return filename.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function scanDesktop() {
  console.log('🔍 Scanning desktop components...\n');
  
  const dirs = {
    components: path.join(ROOT_DIR, 'src', 'components'),
    core: path.join(ROOT_DIR, 'src', 'core'),
    automation: path.join(ROOT_DIR, 'src', 'automation'),
    service: path.join(ROOT_DIR, 'src', 'service'),
    lib: path.join(ROOT_DIR, 'src', 'lib'),
  };
  
  const results = {};
  for (const [name, dir] of Object.entries(dirs)) {
    results[name] = scanDirectory(dir);
    console.log(`   - ${name}: ${results[name].length} files`);
  }
  
  const all = Object.values(results).flat();
  console.log(`\n✅ Total desktop: ${all.length} components`);
  console.log(`   Total lines: ${all.reduce((s, c) => s + c.lines, 0).toLocaleString()}`);
  
  return { results, all };
}

function scanFlutter() {
  const flutterDir = path.join(ROOT_DIR, '..', 'flutter_browser_app', 'lib');
  
  if (!fs.existsSync(flutterDir)) {
    console.log('⚠️ Flutter app not found at:', flutterDir);
    return { results: {}, all: [] };
  }
  
  console.log('\n🔍 Scanning Flutter components...\n');
  
  const results = {
    pages: scanDirectory(path.join(flutterDir, 'pages')),
    appBar: scanDirectory(path.join(flutterDir, 'app_bar')),
    models: scanDirectory(path.join(flutterDir, 'models')),
    root: scanDirectory(path.join(flutterDir)),
  };
  
  // Get total by excluding root files that are also in subdirs
  const subdirFiles = [
    ...(results.pages || []),
    ...(results.appBar || []),
    ...(results.models || []),
  ].map(f => f.name);
  
  results.root = results.root.filter(f => !subdirFiles.includes(f.name));
  
  for (const [name, files] of Object.entries(results)) {
    console.log(`   - ${name}: ${files.length} files`);
  }
  
  const all = Object.values(results).flat();
  console.log(`\n✅ Total Flutter: ${all.length} components`);
  console.log(`   Total lines: ${all.reduce((s, c) => s + c.lines, 0).toLocaleString()}`);
  
  return { results, all };
}

function getDocumentedComponents() {
  const landingPagePath = path.join(__dirname, '..', '..', 'Landing_Page', 'src', 'app', 'docs', 'components', 'page.tsx');
  
  if (!fs.existsSync(landingPagePath)) {
    return new Set();
  }
  
  const content = fs.readFileSync(landingPagePath, 'utf8');
  const documented = new Set();
  
  const matches = content.matchAll(/name:\s*["']([^"']+)["']/g);
  for (const match of matches) {
    documented.add(match[1].toLowerCase());
  }
  
  return documented;
}

function findMissing(allComponents, documented) {
  return allComponents.filter(comp => {
    const nameLower = comp.name.toLowerCase().replace(/\.(ts|tsx|dart)$/, '');
    const pathLower = comp.path.toLowerCase().replace(/\.(ts|tsx|dart)$/, '');
    return !documented.has(nameLower) && !documented.has(pathLower);
  });
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--update') ? 'update' 
    : args.includes('--flutter') ? 'flutter'
    : args.includes('--missing') ? 'missing'
    : args.includes('--all') ? 'all'
    : 'desktop';
  
  let desktopData = { all: [] };
  let flutterData = { all: [] };
  
  if (mode === 'all' || mode === 'flutter') {
    flutterData = scanFlutter();
  }
  
  if (mode === 'all' || mode !== 'flutter') {
    desktopData = scanDesktop();
  }
  
  const allComponents = [...desktopData.all, ...flutterData.all];
  
  const data = {
    generated: new Date().toISOString(),
    version: require(path.join(ROOT_DIR, 'package.json')).version,
    desktop: {
      total: desktopData.all.length,
      totalLines: desktopData.all.reduce((s, c) => s + c.lines, 0),
      byCategory: {
        components: desktopData.results.components?.length || 0,
        core: desktopData.results.core?.length || 0,
        automation: desktopData.results.automation?.length || 0,
        service: desktopData.results.service?.length || 0,
        lib: desktopData.results.lib?.length || 0,
      },
      components: desktopData.all
    },
    flutter: {
      total: flutterData.all?.length || 0,
      totalLines: flutterData.all?.reduce((s, c) => s + c.lines, 0) || 0,
      byCategory: {
        pages: flutterData.results?.pages?.length || 0,
        services: flutterData.results?.services?.length || 0,
        models: flutterData.results?.models?.length || 0,
        components: flutterData.results?.components?.length || 0,
        main: flutterData.results?.main?.length || 0,
      },
      components: flutterData.all || []
    },
    summary: {
      total: allComponents.length,
      totalLines: allComponents.reduce((s, c) => s + c.lines, 0),
    }
  };
  
  if (mode === 'missing') {
    const documented = getDocumentedComponents();
    const missing = findMissing(allComponents, documented);
    
    console.log(`\n📖 Documented: ${documented.size}`);
    console.log(`❌ Undocumented: ${missing.length}`);
    
    if (missing.length > 0 && missing.length <= 50) {
      console.log('\nMissing components:');
      const byCategory = {};
      for (const comp of missing) {
        const cat = comp.path.split('/')[0];
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(comp);
      }
      for (const [cat, comps] of Object.entries(byCategory)) {
        console.log(`  ${cat}/: ${comps.map(c => c.name).join(', ')}`);
      }
    }
    
    return data;
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
  
  // Also sync to Landing_Page project for Vercel/Production
  const LANDING_PAGE_DATA_DIR = path.join(ROOT_DIR, '..', 'Landing_Page', 'src', 'data');
  const LANDING_PAGE_OUTPUT = path.join(LANDING_PAGE_DATA_DIR, 'component-data.json');
  
  if (fs.existsSync(LANDING_PAGE_DATA_DIR)) {
    fs.writeFileSync(LANDING_PAGE_OUTPUT, JSON.stringify(data, null, 2));
    console.log(`🚀 Also synced to Landing_Page: ${LANDING_PAGE_OUTPUT}`);
  } else {
    console.log(`\nℹ️  Skipped Landing_Page sync: ${LANDING_PAGE_DATA_DIR} not found.`);
  }
  
  console.log('\n📈 Top 10 Largest:');
  const sorted = [...allComponents].sort((a, b) => b.lines - a.lines);
  sorted.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} - ${c.lines.toLocaleString()} lines`);
  });
  
  return data;
}

main();
