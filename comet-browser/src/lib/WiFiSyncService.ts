import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import * as os from 'os';
import * as dgram from 'dgram';
import { clipboard } from 'electron';
import Store from 'electron-store';

type TrustLevel = 'trusted' | 'ask_once' | 'blocked';

export interface KnownSyncDevice {
    deviceId: string;
    deviceName: string;
    deviceType: 'mobile' | 'desktop';
    ip: string;
    port: number;
    platform?: string;
    trustLevel: TrustLevel;
    autoConnect: boolean;
    online: boolean;
    lastConnected?: number;
    lastSeen?: number;
}

export class WiFiSyncService extends EventEmitter {
    private port: number;
    private wss: WebSocketServer | null = null;
    private discoverySocket: dgram.Socket | null = null;
    private discoveryInterval: any = null;
    private clients: Set<WebSocket> = new Set();
    private deviceId: string;
    private deviceName: string;
    private pairingCode: string;
    private _lastReceivedClipboard = '';
    private clientSockets: Map<string, WebSocket> = new Map();
    private socketDeviceIds: WeakMap<WebSocket, string> = new WeakMap();
    private store = new Store({ name: 'comet-wifi-sync' });
    private knownDevices = new Map<string, KnownSyncDevice>();
    private readonly knownDevicesKey = 'knownWifiSyncDevices';

    constructor(port: number = 3004) {
        super();
        this.port = port;
        this.deviceId = `desktop-${os.hostname().substring(0, 8)}`;
        this.deviceName = os.hostname();
        this.pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
        this._loadKnownDevices();
    }

    public setDeviceId(deviceId: string, deviceName: string): void {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
    }

    public getDeviceId(): string {
        return this.deviceId;
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public start(): boolean {
        try {
            this.wss = new WebSocketServer({ port: this.port });
            console.log(`[WiFi-Sync] Server started on port ${this.port}`);

            this.wss.on('connection', (ws: WebSocket) => {
                console.log('[WiFi-Sync] Mobile client connected');
                this.clients.add(ws);

                ws.on('message', (message: any) => {
                    this._handleMessage(ws, message);
                });

                ws.on('close', () => {
                    console.log('[WiFi-Sync] Mobile client disconnected');
                    this.clients.delete(ws);
                    this._handleSocketClose(ws);
                });

                ws.on('error', (err) => {
                    console.error('[WiFi-Sync] WebSocket error:', err);
                });
            });

            this._startDiscovery();
            return true;
        } catch (e) {
            console.error('[WiFi-Sync] Failed to start server:', e);
            return false;
        }
    }

    private _loadKnownDevices(): void {
        const saved = this.store.get(this.knownDevicesKey);
        if (!Array.isArray(saved)) return;

        for (const entry of saved) {
            if (!entry || typeof entry !== 'object' || !entry.deviceId) continue;
            const normalized = this._normalizeKnownDevice(entry as Partial<KnownSyncDevice> & { deviceId: string });
            normalized.online = false;
            this.knownDevices.set(normalized.deviceId, normalized);
        }
    }

    private _persistKnownDevices(): void {
        this.store.set(this.knownDevicesKey, Array.from(this.knownDevices.values()));
        this.emit('devices-updated', this.getKnownDevices());
    }

    private _normalizeKnownDevice(device: Partial<KnownSyncDevice> & { deviceId: string }): KnownSyncDevice {
        return {
            deviceId: device.deviceId,
            deviceName: device.deviceName || 'Unknown Mobile',
            deviceType: device.deviceType || 'mobile',
            ip: device.ip || '',
            port: device.port || this.port,
            platform: device.platform || 'unknown',
            trustLevel: device.trustLevel || 'ask_once',
            autoConnect: device.autoConnect ?? device.trustLevel === 'trusted',
            online: device.online ?? false,
            lastConnected: device.lastConnected,
            lastSeen: device.lastSeen,
        };
    }

    private _upsertKnownDevice(device: Partial<KnownSyncDevice> & { deviceId: string }): KnownSyncDevice {
        const existing = this.knownDevices.get(device.deviceId);
        const merged = this._normalizeKnownDevice({
            ...(existing || {}),
            ...device,
        } as Partial<KnownSyncDevice> & { deviceId: string });

        this.knownDevices.set(merged.deviceId, merged);
        this._persistKnownDevices();
        return merged;
    }

    private _getSocketIp(ws: WebSocket): string {
        const remoteAddress = (ws as any)?._socket?.remoteAddress as string | undefined;
        return remoteAddress?.replace(/^::ffff:/, '') || '';
    }

    private _handleSocketClose(ws: WebSocket): void {
        const deviceId = this.socketDeviceIds.get(ws);
        if (!deviceId) return;

        this.clientSockets.delete(deviceId);
        this.socketDeviceIds.delete(ws);

        const device = this.knownDevices.get(deviceId);
        if (device) {
            this._upsertKnownDevice({
                ...device,
                online: false,
                lastSeen: Date.now(),
            });
        }

        this.emit('client-disconnected', {
            deviceId,
            connected: this.clientSockets.size > 0,
            devices: this.getKnownDevices(),
        });
    }

    private _startDiscovery() {
        try {
            this.discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            const discoveryPort = 3005;
            const beacon = () => JSON.stringify({
                type: 'comet-ai-beacon',
                deviceId: this.deviceId,
                deviceName: os.hostname(),
                ip: this.getLocalIp(),
                port: this.port,
            });

            this.discoveryInterval = setInterval(() => {
                if (!this.discoverySocket) return;
                const message = Buffer.from(beacon());
                this.discoverySocket.send(message, discoveryPort, '255.255.255.255', (err) => {
                    if (err) console.error('[WiFi-Sync] Discovery send failed:', err);
                });
            }, 3000);

            this.discoverySocket.bind(0, () => {
                if (this.discoverySocket) {
                    this.discoverySocket.setBroadcast(true);
                    console.log('[WiFi-Sync] Discovery beacon started');
                }
            });
        } catch (e) {
            console.error('[WiFi-Sync] Failed to start discovery:', e);
        }
    }

    private _handleMessage(ws: WebSocket, data: any) {
        try {
            const msg = JSON.parse(data.toString());
            console.log(`[WiFi-Sync] Received: ${msg.type}`);

            switch (msg.type) {
                case 'handshake': {
                    const deviceId = `${msg.deviceId || `mobile-${Date.now()}`}`;
                    const knownDevice = this.knownDevices.get(deviceId);
                    const isTrusted = knownDevice?.trustLevel === 'trusted';
                    const pairingAccepted = typeof msg.pairingCode === 'string' && msg.pairingCode === this.pairingCode;

                    console.log('[WiFi-Sync] Handshake received from:', deviceId, 'trusted=', isTrusted);

                    if (isTrusted || pairingAccepted) {
                        const device = this._upsertKnownDevice({
                            deviceId,
                            deviceName: msg.deviceName || knownDevice?.deviceName || 'Comet Mobile',
                            deviceType: 'mobile',
                            ip: this._getSocketIp(ws),
                            port: Number(msg.port) || knownDevice?.port || this.port,
                            platform: msg.platform || knownDevice?.platform || 'mobile',
                            trustLevel: isTrusted ? 'trusted' : (knownDevice?.trustLevel || 'ask_once'),
                            autoConnect: knownDevice?.autoConnect ?? isTrusted,
                            online: true,
                            lastConnected: Date.now(),
                            lastSeen: Date.now(),
                        });

                        this.clientSockets.set(deviceId, ws);
                        this.socketDeviceIds.set(ws, deviceId);

                        ws.send(JSON.stringify({
                            type: 'handshake-ack',
                            deviceId: this.deviceId,
                            deviceName: this.deviceName,
                            hostname: os.hostname(),
                            platform: os.platform(),
                            authenticated: true,
                            trusted: device.trustLevel === 'trusted',
                            autoConnect: device.autoConnect,
                        }));

                        console.log('[WiFi-Sync] Client authenticated successfully');
                        this.emit('client-connected', {
                            deviceId,
                            connected: this.clientSockets.size > 0,
                            devices: this.getKnownDevices(),
                        });
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            code: 'AUTH_FAILED',
                            message: 'Invalid pairing code',
                        }));
                        console.log('[WiFi-Sync] Client authentication failed');
                    }
                    break;
                }

                case 'execute-command':
                    this._handleCommand(ws, msg);
                    break;

                case 'desktop-control':
                    this._handleDesktopControl(ws, msg);
                    break;

                case 'clipboard-sync':
                    if (msg.text && msg.text !== this._lastReceivedClipboard) {
                        this._lastReceivedClipboard = msg.text;
                        clipboard.writeText(msg.text);
                        this.emit('clipboard-received', msg.text);
                    }
                    break;

                case 'clipboard-sync-request': {
                    const currentClipboard = clipboard.readText();
                    ws.send(JSON.stringify({
                        type: 'clipboard-sync',
                        text: currentClipboard,
                    }));
                    break;
                }

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (e) {
            console.error('[WiFi-Sync] Error parsing message:', e);
        }
    }

    private async _handleCommand(ws: WebSocket, msg: any) {
        const { commandId, command, args } = msg;

        this.emit('command', {
            commandId,
            command,
            args,
            sendResponse: (responseBody: any) => {
                ws.send(JSON.stringify({
                    type: 'command-response',
                    commandId,
                    ...responseBody,
                }));
            },
        });
    }

    public sendToMobile(message: any) {
        this.broadcast({
            type: 'desktop-to-mobile',
            ...message,
            timestamp: Date.now(),
        });
    }

    public sendAIResponse(promptId: string, response: string, isStreaming?: boolean) {
        this.broadcast({
            type: 'ai-stream-response',
            promptId,
            response,
            isStreaming: isStreaming ?? false,
            timestamp: Date.now(),
        });
    }

    public sendDesktopStatus(status: { screenOn?: boolean; activeApp?: string; tabs?: number }) {
        this.broadcast({
            type: 'desktop-status',
            ...status,
            timestamp: Date.now(),
        });
    }

    public sendDesktopControl(action: string, args?: Record<string, any>) {
        this.broadcast({
            type: 'desktop-control',
            action,
            args: args || {},
            timestamp: Date.now(),
        });
    }

    private async _handleDesktopControl(ws: WebSocket, msg: any) {
        const { commandId, action, prompt, promptId, args } = msg;
        console.log(`[WiFi-Sync] Desktop Control: action=${action}`);

        this.emit('command', {
            commandId,
            command: 'desktop-control',
            args: { action, prompt, promptId, ...args },
            sendResponse: (responseBody: any) => {
                ws.send(JSON.stringify({
                    type: 'desktop-control-response',
                    commandId,
                    action,
                    ...responseBody,
                }));
            },
        });
    }

    public getLocalIp(): string {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const ifaceEntry = interfaces[name];
            if (!ifaceEntry) continue;
            for (const iface of ifaceEntry) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    public getConnectUri(): string {
        return `comet-ai://connect?ip=${this.getLocalIp()}&port=${this.port}&device=${this.deviceId}`;
    }

    public getCloudConnectUri(cloudDeviceId: string): string {
        return `comet-ai://cloud-connect?cloudId=${cloudDeviceId}&device=${this.deviceId}&name=${encodeURIComponent(this.deviceName)}`;
    }

    public stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
        if (this.discoverySocket) {
            this.discoverySocket.close();
            this.discoverySocket = null;
        }
    }

    public getPairingCode(): string {
        return this.pairingCode;
    }

    public broadcast(message: any) {
        const data = JSON.stringify(message);
        const recipients = this.clientSockets.size > 0
            ? Array.from(this.clientSockets.values())
            : Array.from(this.clients.values());

        recipients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    public broadcastClipboard(text: string): void {
        this.broadcast({
            type: 'clipboard-sync',
            text,
            timestamp: Date.now(),
        });
    }

    public async connectToDevice(deviceId: string): Promise<boolean> {
        console.log('[WiFi-Sync] Attempting to connect to device via cloud relay:', deviceId);
        return false;
    }

    public disconnectFromDevice(deviceId: string): void {
        const socket = this.clientSockets.get(deviceId);
        if (socket) {
            socket.close();
            this.clientSockets.delete(deviceId);
        }
    }

    public getConnectedClients(): string[] {
        return Array.from(this.clientSockets.keys());
    }

    public getKnownDevices(): KnownSyncDevice[] {
        return Array.from(this.knownDevices.values()).sort(
            (a, b) => (b.lastSeen || b.lastConnected || 0) - (a.lastSeen || a.lastConnected || 0),
        );
    }

    public setDeviceTrust(deviceId: string, trustLevel: TrustLevel, autoConnect?: boolean): KnownSyncDevice | null {
        const existing = this.knownDevices.get(deviceId);
        if (!existing) return null;

        const updated = this._upsertKnownDevice({
            ...existing,
            trustLevel,
            autoConnect: autoConnect ?? trustLevel === 'trusted',
            lastSeen: Date.now(),
        });

        const socket = this.clientSockets.get(deviceId);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'device-trust-updated',
                deviceId,
                deviceName: updated.deviceName,
                trustLevel: updated.trustLevel,
                autoConnect: updated.autoConnect,
                timestamp: Date.now(),
            }));
        }

        return updated;
    }

    public removeKnownDevice(deviceId: string): boolean {
        const socket = this.clientSockets.get(deviceId);
        if (socket) {
            socket.close();
        }
        this.clientSockets.delete(deviceId);
        const deleted = this.knownDevices.delete(deviceId);
        if (deleted) {
            this._persistKnownDevices();
        }
        return deleted;
    }
}

let wifiSyncInstance: WiFiSyncService | null = null;
export function getWiFiSync(port?: number): WiFiSyncService {
    if (!wifiSyncInstance) {
        wifiSyncInstance = new WiFiSyncService(port);
    }
    return wifiSyncInstance;
}
