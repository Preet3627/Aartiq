export const shortcutDefinitions = [
    { action: 'new-tab', label: 'New Tab', category: 'Browser', accelerator: 'CommandOrControl+T' },
    { action: 'new-incognito-tab', label: 'New Incognito Tab', category: 'Browser', accelerator: 'CommandOrControl+Shift+N' },
    { action: 'close-tab', label: 'Close Tab', category: 'Browser', accelerator: 'CommandOrControl+W' },
    { action: 'next-tab', label: 'Next Tab', category: 'Browser', accelerator: 'CommandOrControl+]' },
    { action: 'prev-tab', label: 'Previous Tab', category: 'Browser', accelerator: 'CommandOrControl+[' },
    { action: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'Browser', accelerator: 'CommandOrControl+Shift+S' },
    { action: 'open-settings', label: 'Open Settings', category: 'Browser', accelerator: 'CommandOrControl+,' },
    { action: 'open-history', label: 'Open History', category: 'Browser', accelerator: 'CommandOrControl+Y' },
    { action: 'cycle-theme', label: 'Cycle Theme', category: 'Browser', accelerator: 'CommandOrControl+Shift+T' },
    { action: 'zoom-in', label: 'Zoom In', category: 'Browser', accelerator: 'CommandOrControl+=' },
    { action: 'zoom-in-plus', label: 'Zoom In (+)', category: 'Browser', accelerator: 'CommandOrControl+Plus' },
    { action: 'zoom-out', label: 'Zoom Out', category: 'Browser', accelerator: 'CommandOrControl+-' },
    { action: 'zoom-reset', label: 'Reset Zoom', category: 'Browser', accelerator: 'CommandOrControl+0' },
    { action: 'open-ai-chat', label: 'Open AI Chat', category: 'AI', accelerator: 'CommandOrControl+Alt+C' },
    { action: 'toggle-ai-assist', label: 'Toggle AI Assist', category: 'AI', accelerator: 'CommandOrControl+Alt+A' },
    { action: 'toggle-ai-overview', label: 'Toggle AI Overview', category: 'AI', accelerator: 'CommandOrControl+Alt+O' },
    { action: 'toggle-spotlight', label: 'Toggle Spotlight Search', category: 'AI', accelerator: 'CommandOrControl+Shift+Space' },
    { action: 'spotlight-search', label: 'Global Spotlight Search', category: 'AI', accelerator: 'Alt+Space' },
    { action: 'pop-search', label: 'Pop Search', category: 'AI', accelerator: 'CommandOrControl+Shift+S' },
    { action: 'global-search', label: 'Global Search', category: 'AI', accelerator: 'CommandOrControl+Alt+G' },
    { action: 'open-workspace', label: 'Open Workspace Dashboard', category: 'Panels', accelerator: 'CommandOrControl+Alt+W' },
    { action: 'open-media-studio', label: 'Open Media Studio', category: 'Panels', accelerator: 'CommandOrControl+Alt+M' },
    { action: 'open-pdf-workspace', label: 'Open PDF Workspace', category: 'Panels', accelerator: 'CommandOrControl+Alt+P' },
    { action: 'open-presenton', label: 'Open Presenton', category: 'Panels', accelerator: 'CommandOrControl+Alt+L' },
    { action: 'open-password-manager', label: 'Open Password Manager', category: 'Panels', accelerator: 'CommandOrControl+Alt+K' },
    { action: 'open-clipboard', label: 'Open Clipboard Manager', category: 'Panels', accelerator: 'CommandOrControl+Alt+V' },
    { action: 'open-downloads', label: 'Open Downloads', category: 'Panels', accelerator: 'CommandOrControl+Shift+J' },
    { action: 'open-documentation', label: 'Open Documentation', category: 'Panels', accelerator: 'CommandOrControl+Shift+/' },
    { action: 'open-cart', label: 'Open Unified Cart', category: 'Panels', accelerator: 'CommandOrControl+Alt+U' },
    { action: 'open-camera', label: 'Open Camera Studio', category: 'Panels', accelerator: 'CommandOrControl+Alt+I' },
    { action: 'open-extensions', label: 'Open Extensions', category: 'Panels', accelerator: 'CommandOrControl+Alt+E' },
    { action: 'open-bookmarks', label: 'Open Vault & Autofill', category: 'Panels', accelerator: 'CommandOrControl+Alt+B' },
] as const;

export type Action = typeof shortcutDefinitions[number]['action'];

export interface Shortcut {
    accelerator: string;
    action: Action;
}

export const defaultShortcuts: Shortcut[] = shortcutDefinitions.map(({ action, accelerator }) => ({
    action,
    accelerator,
}));
