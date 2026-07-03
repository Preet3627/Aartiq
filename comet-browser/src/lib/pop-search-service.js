const { BrowserWindow, screen, ipcMain, dialog, clipboard, shell, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const log = require('electron-log');

const IPC_CHANNELS = {
    SHOW_POPUP: 'pop-search:show-popup',
    RESIZE_POPUP: 'pop-search:resize-popup',
    SEARCH: 'pop-search:search',
    COPY_AND_SEARCH: 'pop-search:copy-and-search',
    SAVE_CONFIG: 'pop-search:save-config',
    LOAD_CONFIG: 'pop-search:load-config',
    OPEN_EXTERNAL: 'pop-search:open-external',
    READ_LOCAL_ICON: 'pop-search:read-local-icon',
    MINIMIZE: 'pop-search:minimize',
    CLOSE: 'pop-search:close',
    RELOAD: 'pop-search:reload',
    CONTEXT_MENU: 'pop-search:context-menu'
};

let popupWindow = null;
let mainWindow = null;
let configStore = null;

const DEFAULT_CONFIG = {
    providers: [
        { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: '🔍', category: 'Search' },
        { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/search?q={query}', icon: '▶️', category: 'Video' },
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com/?q={query}', icon: '🤖', category: 'AI' },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/search?q={query}', icon: '✨', category: 'AI' },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai/search?q={query}', icon: '🧠', category: 'AI' },
        { id: 'brave', name: 'Brave', url: 'https://search.brave.com/search?q={query}', icon: '🦁', category: 'Search' },
        { id: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}', icon: '🦆', category: 'Search' },
        { id: 'wikipedia', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/{query}', icon: '📚', category: 'Reference' },
        { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: '🐙', category: 'Code' },
        { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={query}', icon: '📤', category: 'Code' }
    ],
    categories: ['Search', 'Video', 'AI', 'Reference', 'Code', 'Shopping', 'News', 'Social'],
    appearance: {
        accentColor: '#6366f1',
        iconSize: 32,
        gridColumns: 5,
        popupWidth: 400,
        backgroundColor: '#1e1e2e',
        textColor: '#ffffff'
    },
    behavior: {
        copyToClipboard: true,
        closeOnLaunch: true,
        showCategories: true
    }
};

class PopSearchService {
    constructor() {
        this.config = null;
        this.configPath = null;
    }

    initialize(parentWindow) {
        mainWindow = parentWindow;
        this.loadConfig();
        this.registerIpcHandlers();
        log.info('[PopSearch] Service initialized');
    }

    getConfigPath() {
        if (!this.configPath) {
            const userDataPath = app.getPath('userData');
            this.configPath = path.join(userDataPath, 'pop-search-config.json');
        }
        return this.configPath;
    }

    loadConfig() {
        try {
            const configPath = this.getConfigPath();
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf-8');
                this.config = JSON.parse(data);
            } else {
                this.config = { ...DEFAULT_CONFIG };
                this.saveConfig();
            }
        } catch (err) {
            log.error('[PopSearch] Config load error:', err.message);
            this.config = { ...DEFAULT_CONFIG };
        }
    }

    saveConfig() {
        try {
            const configPath = this.getConfigPath();
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            log.info('[PopSearch] Config saved');
        } catch (err) {
            log.error('[PopSearch] Config save error:', err.message);
        }
    }

    getConfig() {
        return this.config;
    }

    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    registerIpcHandlers() {
        ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, async (event, data) => {
            const window = BrowserWindow.fromWebContents(event.sender);
            const { filePath } = await dialog.showSaveDialog(window, {
                title: 'Export Configuration',
                defaultPath: 'pop_search_config.json',
                filters: [{ name: 'JSON', extensions: ['json'] }]
            });
            if (filePath) {
                try {
                    fs.writeFileSync(filePath, data, 'utf-8');
                    return { success: true };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }
            return { success: false, canceled: true };
        });

        ipcMain.handle(IPC_CHANNELS.LOAD_CONFIG, async (event) => {
            const window = BrowserWindow.fromWebContents(event.sender);
            const { canceled, filePaths } = await dialog.showOpenDialog(window, {
                title: 'Import Configuration',
                filters: [{ name: 'JSON', extensions: ['json'] }],
                properties: ['openFile']
            });
            if (!canceled && filePaths.length > 0) {
                return fs.readFileSync(filePaths[0], 'utf-8');
            }
            return null;
        });

        ipcMain.handle(IPC_CHANNELS.READ_LOCAL_ICON, async (event, filePath) => {
            try {
                const ext = path.extname(filePath).toLowerCase();
                const mimeMap = {
                    '.ico': 'image/x-icon',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp'
                };
                const mime = mimeMap[ext] || 'image/png';
                const data = fs.readFileSync(filePath);
                return `data:${mime};base64,${data.toString('base64')}`;
            } catch (err) {
                log.error('[PopSearch] read-local-icon error:', err.message);
                return null;
            }
        });

        ipcMain.on(IPC_CHANNELS.SHOW_POPUP, (event, data) => {
            const { text, x, y } = data;
            this.createPopup(text, x, y);
        });

        ipcMain.on(IPC_CHANNELS.RESIZE_POPUP, (event, { width, height }) => {
            if (popupWindow && !popupWindow.isDestroyed()) {
                const w = Math.ceil(width);
                const h = Math.ceil(height);
                popupWindow.setSize(w, h);
            }
        });

        ipcMain.on(IPC_CHANNELS.SEARCH, (event, { provider, query, type }) => {
            this.handleAction(provider, query, type || 'url', false);
        });

        ipcMain.on(IPC_CHANNELS.COPY_AND_SEARCH, (event, { provider, query, type }) => {
            this.handleAction(provider, query, type || 'url', true);
        });

        ipcMain.on(IPC_CHANNELS.MINIMIZE, () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.minimize();
            }
        });

        ipcMain.on(IPC_CHANNELS.CLOSE, () => {
            this.closePopup();
        });

        ipcMain.on(IPC_CHANNELS.RELOAD, () => {
            if (popupWindow && !popupWindow.isDestroyed()) {
                popupWindow.reload();
            }
        });

        ipcMain.on(IPC_CHANNELS.OPEN_EXTERNAL, (event, url) => {
            shell.openExternal(url).catch(err => {
                log.error('[PopSearch] openExternal error:', err.message);
            });
        });
    }

    createPopup(selectedText, x, y) {
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.close();
        }

        const display = screen.getDisplayNearestPoint({ x, y });
        const bounds = display.workArea;

        const popupWidth = 400;
        const popupHeight = 280; // Increased height to show providers and hint

        let popupX = Math.max(bounds.x, Math.min(x - 200, bounds.x + bounds.width - popupWidth));
        let popupY = Math.max(bounds.y, Math.min(y + 10, bounds.y + bounds.height - popupHeight));

        popupWindow = new BrowserWindow({
            width: popupWidth,
            height: popupHeight,
            x: popupX,
            y: popupY,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            hasShadow: false,
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            focusable: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            }
        });

        const htmlContent = this.generatePopupHtml(selectedText);
        popupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        popupWindow.webContents.on('did-finish-load', () => {
            popupWindow.focus();
        });

        popupWindow.on('blur', () => {
            this.closePopup();
        });

        log.info('[PopSearch] Popup created');
    }

    generatePopupHtml(selectedText) {
        const providers = this.config?.providers || DEFAULT_CONFIG.providers;
        const accentColor = this.config?.appearance?.accentColor || '#6366f1';

        const providerCards = providers.slice(0, 10).map((p, i) => {
            return `
            <div class="provider-card" data-url="${p.url}" data-name="${p.name}" data-type="url" tabindex="0">
                <div class="provider-icon">${p.icon}</div>
                <div class="provider-name">${p.name}</div>
            </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: rgba(30,30,46,0.95);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 12px;
            color: #fff;
            user-select: none;
            overflow: hidden;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .query {
            flex: 1;
            background: rgba(255,255,255,0.1);
            border: none;
            border-radius: 8px;
            padding: 6px 12px;
            color: #fff;
            font-size: 13px;
            outline: none;
        }
        .providers {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-height: 150px;
            overflow-y: auto;
        }
        .provider-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            min-width: 60px;
        }
        .provider-card:hover, .provider-card:focus {
            background: ` + accentColor + `30;
            transform: scale(1.05);
        }
        .provider-card.selected {
            background: ` + accentColor + `50;
            outline: 2px solid ` + accentColor + `;
        }
        .provider-icon {
            font-size: 20px;
        }
        .provider-name {
            font-size: 9px;
            opacity: 0.7;
            text-align: center;
        }
        .hint {
            font-size: 10px;
            opacity: 0.4;
            text-align: center;
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="header">
        <input type="text" class="query" id="queryInput" value="${selectedText || ''}" placeholder="Search..." autofocus>
    </div>
    <div class="providers" id="providers">
        ` + providerCards + `
    </div>
    <div class="hint">↑↓ Navigate • Enter Search • Esc Close</div>
    <script>
        const { ipcRenderer } = require('electron');
        let selectedIndex = 0;
        const cards = document.querySelectorAll('.provider-card');
        
        function updateSelection() {
            cards.forEach(function(c, i) {
                c.classList.toggle('selected', i === selectedIndex);
            });
            if (cards[selectedIndex]) {
                cards[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
        
        document.getElementById('queryInput').addEventListener('keydown', function(e) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, cards.length - 1);
                updateSelection();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                launchProvider(cards[selectedIndex]);
            } else if (e.key === 'Escape') {
                ipcRenderer.send('pop-search:close');
            }
        });
        
        cards.forEach(function(card, i) {
            card.addEventListener('click', function() {
                selectedIndex = i;
                launchProvider(card);
            });
            card.addEventListener('mouseenter', function() {
                selectedIndex = i;
                updateSelection();
            });
        });
        
        function launchProvider(card) {
            var url = card.dataset.url;
            var query = document.getElementById('queryInput').value;
            var searchUrl = url.replace(/%s|{query}/g, encodeURIComponent(query));
            ipcRenderer.send('pop-search:search', { provider: searchUrl, query: '', type: 'url' });
        }
        
        updateSelection();
    </script>
</body>
</html>`;
        return html;
    }

    handleAction(target, query, type, shouldCopy) {
        if (shouldCopy) {
            clipboard.writeText(query);
        }

        if (type === 'url') {
            const searchUrl = target.replace(/%s|{query}/g, encodeURIComponent(query));
            shell.openExternal(searchUrl).catch(err => {
                log.error('[PopSearch] openExternal error:', err.message);
            });
        } else if (type === 'file') {
            shell.openPath(target).catch(err => {
                log.error('[PopSearch] openPath error:', err.message);
            });
        } else if (type === 'cmd') {
            let command = target;
            const lowerTarget = target.toLowerCase();
            if (lowerTarget.endsWith('.py')) {
                command = 'python "' + target + '"';
            } else if (lowerTarget.endsWith('.ahk')) {
                command = '"C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe" "' + target + '"';
            }
            if (command.includes('{query}')) {
                command = command.replace(/{query}/g, query);
            }
            exec(command, (error) => {
                if (error) {
                    log.error('[PopSearch] exec error:', error.message);
                }
            });
        }

        this.closePopup();
    }

    closePopup() {
        if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.close();
            popupWindow = null;
        }
    }

    showPopupWithText(text) {
        const cursorPos = screen.getCursorScreenPoint();
        this.createPopup(text, cursorPos.x, cursorPos.y);
    }

    showPopupAtPosition(x, y, text) {
        this.createPopup(text, x, y);
    }
}

const popSearchService = new PopSearchService();

module.exports = { PopSearchService, popSearchService, IPC_CHANNELS };
