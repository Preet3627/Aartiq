const iconMimeType = 'image/png';

const resolveCometIcon = (app, path, fs) => {
  const iconName = 'icon.png';
  const isDev = !app.isPackaged;
  const resourcesPath = app.isPackaged
    ? (process.resourcesPath || path.join(app.getAppPath(), '..', '..', 'Resources'))
    : path.join(__dirname, '..', '..', 'assets');
  const appPath = app.getAppPath();

  const candidates = isDev ? [
    path.join(__dirname, '..', '..', 'assets', iconName),
    path.join(__dirname, '..', '..', iconName),
    path.join(appPath, 'assets', iconName),
    path.join(appPath, iconName),
    path.join(appPath, 'public', iconName),
    path.join(process.cwd(), 'public', iconName),
  ] : [
    path.join(resourcesPath, 'app.asar.unpacked', 'assets', iconName),
    path.join(resourcesPath, 'app.asar.unpacked', iconName),
    path.join(resourcesPath, 'assets', iconName),
    path.join(resourcesPath, iconName),
    path.join(resourcesPath, 'app', 'assets', iconName),
    path.join(resourcesPath, 'app', iconName),
    path.join(__dirname, '..', '..', 'assets', iconName),
    path.join(__dirname, '..', '..', iconName),
  ];

  const emergencyPaths = [
    path.join(os.homedir(), 'Documents', 'Comet-AI', 'icon.png'),
    path.join(os.homedir(), '.comet', 'icon.png'),
    '/Applications/Comet-AI.app/Contents/Resources/assets/icon.png',
  ];

  const allCandidates = [...candidates, ...emergencyPaths];

  for (const p of allCandidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const stat = fs.statSync(p);
        if (stat.size > 100 && stat.size < 10 * 1024 * 1024) {
          return p;
        }
      }
    } catch {
      // continue to next
    }
  }
  return null;
};

const loadBrandIcon = (app, path, fs) => {
  let iconBase64 = '';
  let iconMime = iconMimeType;
  try {
    const iconPath = resolveCometIcon(app, path, fs);
    if (iconPath && fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString('base64');
      iconMime = 'image/png';
    } else {
      const fallbacks = [
        path.join(__dirname, '..', '..', 'assets', 'icon.png'),
        path.join(app.getAppPath(), 'assets', 'icon.png'),
      ];
      for (const fb of fallbacks) {
        try {
          if (fs.existsSync(fb)) {
            iconBase64 = fs.readFileSync(fb).toString('base64');
            iconMime = 'image/png';
            break;
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('[BrandIcon] Load failed', e);
  }
  return { iconBase64, iconMime };
};

const dataUrlToBuffer = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] };
};

const normalizePages = (payload) => {
  if (payload?.pages && Array.isArray(payload.pages) && payload.pages.length) return payload.pages;
  if (payload?.content) {
    return [{
      title: payload.title || 'Document',
      sections: [{ title: payload.subtitle || 'Content', content: payload.content }]
    }];
  }
  return [{
    title: payload?.title || 'Document',
    sections: [{ title: 'Content', content: ' ' }]
  }];
};

const toStyledRuns = (text, opts = {}) => {
  if (!text || typeof text !== 'string') return [];
  if (text.trim() === '') return [];
  const runs = [];
  const regex = /(\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*|__([^_]+)__)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) runs.push({ text: text.slice(lastIndex, match.index), ...opts });
    if (match[2]) runs.push({ text: match[2], bold: true, ...opts });
    else if (match[3]) runs.push({ text: match[3], strike: true, ...opts });
    else if (match[4]) runs.push({ text: match[4], italic: true, ...opts });
    else if (match[5]) runs.push({ text: match[5], bold: true, ...opts });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex), ...opts });
  return runs.length > 0 ? runs : [{ text, ...opts }];
};

const templatePalette = (name = 'professional') => {
  const map = {
    professional: { bg: '#0b1224', text: '#0f172a', accent: '#38bdf8' },
    dark: { bg: '#0d1117', text: '#e5e7eb', accent: '#22d3ee' },
    executive: { bg: '#f8fafc', text: '#0f172a', accent: '#1e3a8a' },
    minimalist: { bg: '#ffffff', text: '#111827', accent: '#0ea5e9' }
  };
  return map[name] || map.professional;
};

module.exports = {
  iconMimeType,
  resolveCometIcon,
  loadBrandIcon,
  dataUrlToBuffer,
  normalizePages,
  toStyledRuns,
  templatePalette
};