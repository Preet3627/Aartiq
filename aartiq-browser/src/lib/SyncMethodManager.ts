import { EventEmitter } from 'events';
import { WiFiSyncService } from './WiFiSyncService';
import { CloudSyncService } from './CloudSyncService';

export type SyncMode = 'local' | 'cloud' | 'local_cloud';

export interface SyncOptions {
    clipboard: boolean;
    history: boolean;
    files: boolean;
    desktopControl: boolean;
}

export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile';
    platform: string;
    lastSeen: number;
    isOnline: boolean;
    connectionType: 'local' | 'cloud' | 'none';
    ip?: string;
    port?: number;
}

export interface CloudConfig {
    provider: 'firebase' | 'mysql' | 'custom';
    firebaseConfig?: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    };
    mysqlConfig?: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    encryptedCredentials?: string;
}

export class SyncMethodManager extends EventEmitter {
    private static instance: SyncMethodManager;
    private currentMode: SyncMode = 'local';
    private wifiSync: WiFiSyncService | null = null;
    private cloudSync: CloudSyncService | null = null;
    private syncOptions: SyncOptions = {
        clipboard: true,
        history: true,
        files: true,
        desktopControl: true
    };
    private devices: Map<string, DeviceInfo> = new Map();
    private localDeviceId: string = '';
    private deviceName: string = '';

    private constructor() {
        super();
    }

    public static getInstance(): SyncMethodManager {
        if (!SyncMethodManager.instance) {
            SyncMethodManager.instance = new SyncMethodManager();
        }
        return SyncMethodManager.instance;
    }

    public initialize(deviceId: string, deviceName: string, deviceType: 'desktop' | 'mobile') {
        this.localDeviceId = deviceId;
        this.deviceName = deviceName;
        console.log(`[SyncMethodManager] Initialized for ${deviceType}: ${deviceName} (${deviceId})`);
    }

    public async setMode(mode: SyncMode): Promise<boolean> {
        console.log(`[SyncMethodManager] Switching to mode: ${mode}`);
        this.currentMode = mode;

        try {
            switch (mode) {
                case 'local':
                    await this._initLocalSync();
                    break;
                case 'cloud':
                    await this._initCloudSync();
                    break;
                case 'local_cloud':
                    await this._initLocalSync();
                    await this._initCloudSync();
                    break;
            }
            this.emit('mode-changed', mode);
            return true;
        } catch (error) {
            console.error('[SyncMethodManager] Failed to set mode:', error);
            return false;
        }
    }

    public getMode(): SyncMode {
        return this.currentMode;
    }

    public getWifiSync(): WiFiSyncService | null {
        return this.wifiSync;
    }

    public getCloudSync(): CloudSyncService | null {
        return this.cloudSync;
    }

    public setSyncOptions(options: Partial<SyncOptions>) {
        this.syncOptions = { ...this.syncOptions, ...options };
        this.emit('options-changed', this.syncOptions);
    }

    public getSyncOptions(): SyncOptions {
        return { ...this.syncOptions };
    }

    public setCloudConfig(config: CloudConfig): Promise<boolean> {
        return this.cloudSync?.configure(config) ?? Promise.resolve(false);
    }

    public async loginToCloud(email: string, password: string): Promise<boolean> {
        return this.cloudSync?.login(email, password) ?? Promise.resolve(false);
    }

    public async logoutFromCloud(): Promise<void> {
        return this.cloudSync?.logout() ?? Promise.resolve();
    }

    public isCloudConnected(): boolean {
        return this.cloudSync?.isConnected() ?? false;
    }

    public async connectToDevice(targetDeviceId: string, connectionType: 'local' | 'cloud' = 'cloud'): Promise<boolean> {
        console.log(`[SyncMethodManager] Connecting to device: ${targetDeviceId} via ${connectionType}`);

        if (connectionType === 'local' && this.wifiSync) {
            return this.wifiSync.connectToDevice(targetDeviceId);
        } else if (connectionType === 'cloud' && this.cloudSync) {
            return this.cloudSync.connectToDevice(targetDeviceId);
        }
        return false;
    }

    public async disconnectFromDevice(targetDeviceId: string): Promise<void> {
        const device = this.devices.get(targetDeviceId);
        if (!device) return;

        if (device.connectionType === 'local' && this.wifiSync) {
            this.wifiSync.disconnectFromDevice(targetDeviceId);
        } else if (device.connectionType === 'cloud' && this.cloudSync) {
            this.cloudSync.disconnectFromDevice(targetDeviceId);
        }

        device.isOnline = false;
        this.devices.set(targetDeviceId, device);
        this.emit('device-disconnected', targetDeviceId);
    }

    public getDevices(): DeviceInfo[] {
        return Array.from(this.devices.values());
    }

    public getLocalDevices(): DeviceInfo[] {
        return Array.from(this.devices.values()).filter(d => d.connectionType === 'local');
    }

    public getCloudDevices(): DeviceInfo[] {
        return Array.from(this.devices.values()).filter(d => d.connectionType === 'cloud');
    }

    public getOnlineDevices(): DeviceInfo[] {
        return Array.from(this.devices.values()).filter(d => d.isOnline);
    }

    private async _initLocalSync(): Promise<void> {
        if (!this.wifiSync) {
            this.wifiSync = new WiFiSyncService(3004);
            this.wifiSync.start();
            console.log('[SyncMethodManager] Local WiFi sync started');
        }
    }

    private async _initCloudSync(): Promise<void> {
        if (!this.cloudSync) {
            this.cloudSync = CloudSyncService.getInstance();
            await this.cloudSync.initialize();
            console.log('[SyncMethodManager] Cloud sync initialized');
        }
    }

    public stop(): void {
        if (this.wifiSync) {
            this.wifiSync.stop();
            this.wifiSync = null;
        }
        if (this.cloudSync) {
            this.cloudSync.disconnect();
            this.cloudSync = null;
        }
        console.log('[SyncMethodManager] All sync services stopped');
    }

    public syncClipboard(text: string): void {
        if (this.syncOptions.clipboard) {
            if (this.currentMode === 'local' || this.currentMode === 'local_cloud') {
                this.wifiSync?.broadcastClipboard(text);
            }
            if (this.currentMode === 'cloud' || this.currentMode === 'local_cloud') {
                this.cloudSync?.syncClipboard(text);
            }
        }
    }

    public syncHistory(history: string[]): void {
        if (this.syncOptions.history) {
            if (this.currentMode === 'cloud' || this.currentMode === 'local_cloud') {
                this.cloudSync?.syncHistory(history);
            }
        }
    }

    public async sendDesktopControl(action: string, args?: Record<string, any>): Promise<any> {
        const targetDevices = this.getOnlineDevices().filter(d => d.deviceType === 'desktop');
        
        for (const device of targetDevices) {
            if (device.connectionType === 'local' && this.wifiSync) {
                return this.wifiSync.sendDesktopControl(action, args);
            } else if (device.connectionType === 'cloud' && this.cloudSync) {
                return this.cloudSync.sendDesktopControl(device.deviceId, action, args);
            }
        }
        
        throw new Error('No desktop device available');
    }

    public forwardPromptToDesktop(prompt: string, promptId?: string): void {
        if (this.syncOptions.desktopControl) {
            const desktopDevices = this.getOnlineDevices().filter(d => d.deviceType === 'desktop');
            
            for (const device of desktopDevices) {
                if (device.connectionType === 'local' && this.wifiSync) {
                    this.wifiSync.sendAIResponse(promptId || Date.now().toString(), prompt, false);
                } else if (device.connectionType === 'cloud' && this.cloudSync) {
                    this.cloudSync.forwardPrompt(device.deviceId, prompt, promptId);
                }
            }
        }
    }
}

export const syncMethodManager = SyncMethodManager.getInstance();
