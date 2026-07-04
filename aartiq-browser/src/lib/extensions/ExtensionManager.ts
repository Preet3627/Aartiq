// src/lib/extensions/ExtensionManager.ts

export interface Extension {
    id: string;
    name: string;
    description: string;
    version: string;
    icon: string;
    enabled: boolean;
    onUrlNavigate?: (url: string) => string | void;
    onPageModified?: (html: string) => string;
}

class ExtensionManager {
    private extensions: Extension[] = [];

    constructor() {
        this.loadDefaultExtensions();
    }

    private loadDefaultExtensions() {
        this.extensions = [
            {
                id: 'adblock-elite',
                name: 'AdBlock Elite',
                description: 'Advanced ad blocking for a cleaner web.',
                version: '1.0.0',
                icon: '🛡️',
                enabled: true,
            },
            {
                id: 'dark-reader',
                name: 'Dark Reader',
                description: 'Force dark mode on every website.',
                version: '1.2.0',
                icon: '🌙',
                enabled: false,
            },
            {
                id: 'grammarly-lite',
                name: 'Grammarly Lite',
                description: 'Check your spelling in the notes area.',
                version: '0.9.0',
                icon: '✍️',
                enabled: true,
            }
        ];
    }

    getExtensions() {
        return this.extensions;
    }

    toggleExtension(id: string) {
        const ext = this.extensions.find(e => e.id === id);
        if (ext) ext.enabled = !ext.enabled;
    }

    installExtension(ext: Extension) {
        this.extensions.push(ext);
    }
}

const extensionManager = new ExtensionManager();
export default extensionManager;
