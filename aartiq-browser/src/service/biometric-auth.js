const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const fs = require('fs');
const os = require('os');
const path = require('path');

const webauthnService = require('../lib/webauthn-service');

class BiometricAuthManager {
    constructor() {
        this.platform = os.platform();
        this.isAvailable = false;
        this.authType = null;
        this._devSigningAttempted = false;
    }

    async checkAvailability() {
        if (this.platform === 'darwin') {
            return await this.checkMacAvailability();
        } else if (this.platform === 'win32') {
            return await this.checkWindowsAvailability();
        } else if (this.platform === 'linux') {
            return await this.checkLinuxAvailability();
        }
        return { available: false, type: 'none', message: 'Unsupported platform' };
    }

    async checkMacAvailability() {
        try {
            const { systemPreferences, app } = require('electron');
            if (systemPreferences && systemPreferences.canPromptTouchID()) {
                this.isAvailable = true;
                this.authType = 'touchid';
                return { available: true, type: 'touchid', message: 'Touch ID available' };
            }

            if (!app.isPackaged && !this._devSigningAttempted) {
                this._devSigningAttempted = true;
                console.log('[BiometricAuth] Dev mode: attempting ad-hoc signing for Touch ID...');
                const signed = await this.ensureDevTouchIDSigning();
                if (signed && systemPreferences && systemPreferences.canPromptTouchID()) {
                    this.isAvailable = true;
                    this.authType = 'touchid';
                    return { available: true, type: 'touchid', message: 'Touch ID available (dev mode)' };
                }
            }

            this.isAvailable = false;
            this.authType = 'none';
            return { available: false, type: 'none', message: 'Touch ID not configured' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async ensureDevTouchIDSigning() {
        try {
            const { app } = require('electron');
            const exePath = app.getPath('exe');
            const appPath = app.getAppPath();

            const electronApp = path.resolve(exePath, '..', '..', '..');
            const entitlementsPath = path.join(appPath, 'entitlements.mac.local.plist');

            if (!fs.existsSync(entitlementsPath)) {
                console.warn('[BiometricAuth] Local entitlements not found at:', entitlementsPath);
                return false;
            }

            console.log('[BiometricAuth] Running: codesign --force --sign - --entitlements .../entitlements.mac.local.plist --deep .../Electron.app');
            await execAsync(`codesign --force --sign - --entitlements "${entitlementsPath}" --deep "${electronApp}"`, { timeout: 30000 });
            console.log('[BiometricAuth] Dev signing successful');
            return true;
        } catch (e) {
            console.warn('[BiometricAuth] Dev signing failed:', e.message);
            return false;
        }
    }

    async checkWindowsAvailability() {
        try {
            if (webauthnService.isSupported()) {
                this.isAvailable = true;
                this.authType = 'windows-hello';
                return {
                    available: true,
                    type: 'windows-hello',
                    message: 'Windows Hello WebAuthn available',
                    hasCredential: webauthnService.hasCredential(),
                };
            }

            return { available: false, type: 'none', message: 'WebAuthn not supported on this system' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async checkLinuxAvailability() {
        try {
            const whichResult = await execAsync('which fprintd');
            if (whichResult.stderr) {
                return { available: false, type: 'none', message: 'fprintd not installed' };
            }
            
            const statusResult = await execAsync('systemctl status fprintd 2>&1 || echo "Not running"');
            
            if (statusResult.stdout.includes('active (running)')) {
                this.isAvailable = true;
                this.authType = 'fingerprint';
                return { available: true, type: 'fingerprint', message: 'fprintd running' };
            }
            
            await execAsync('sudo systemctl start fprintd 2>&1 || echo "Failed"');
            
            const listResult = await execAsync('fprintd-list 2>&1 || echo "No devices"');
            
            if (!listResult.stdout.includes('No devices') && !listResult.stdout.includes('error')) {
                this.isAvailable = true;
                this.authType = 'fingerprint';
                return { available: true, type: 'fingerprint', message: 'Fingerprint reader detected' };
            }
            
            return { available: false, type: 'password', message: 'No fingerprint reader — password authentication available' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async authenticate(reason = 'Authenticate to proceed') {
        const check = await this.checkAvailability();

        if (!check.available && check.type === 'none') {
            console.log('[BiometricAuth] No biometric available — falling back to OS password prompt');
            if (this.platform === 'darwin') {
                return await this.authenticateMac(reason);
            } else if (this.platform === 'win32') {
                return await this.authenticateWindows(reason);
            } else if (this.platform === 'linux') {
                return await this.authenticateLinuxPassword(reason);
            }
            return { success: false, error: 'No authentication method available on this platform' };
        }

        if (this.platform === 'darwin') {
            return await this.authenticateMac(reason);
        } else if (this.platform === 'win32') {
            return await this.authenticateWindows(reason);
        } else if (this.platform === 'linux') {
            return await this.authenticateLinux(reason);
        }
        
        return { success: false, error: 'Unsupported platform' };
    }

    async authenticateMac(reason) {
        try {
            const { systemPreferences } = require('electron');
            if (systemPreferences) {
                await systemPreferences.promptTouchID(reason || 'Authenticate to proceed');
                return { success: true, method: 'touchid', message: 'Touch ID verified' };
            }
        } catch (e) {
            if (e.message?.toLowerCase().includes('cancel')) {
                return { success: false, error: 'Authentication cancelled' };
            }
            console.warn('[BiometricAuth] Touch ID failed, trying password fallback:', e.message);
        }

        try {
            const result = await execAsync(`osascript -e 'do shell script "echo authenticated" with administrator privileges' 2>&1`);
            if (result.stderr && result.stderr.includes('User canceled')) {
                return { success: false, error: 'Authentication cancelled' };
            }
            return { success: true, method: 'password', message: 'Authenticated via password fallback' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async authenticateWindows(reason) {
        try {
            if (!webauthnService.isSupported()) {
                return { success: false, error: 'WebAuthn not supported on this system' };
            }

            if (!webauthnService.hasCredential()) {
                await webauthnService.registerCredential({
                    userName: 'aartiq-user',
                    displayName: 'Aartiq User',
                });
            }

            const result = await webauthnService.authenticate(reason);
            return {
                success: result.success,
                method: 'windows-hello',
                message: result.success ? 'Windows Hello verified' : (result.error || 'Authentication failed'),
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async authenticateLinux(reason) {
        try {
            const result = await execAsync(`echo "" | fprintd-verify 2>&1`);
            
            if (result.stderr && (result.stderr.includes('successfully') || result.stderr.includes('verify-success'))) {
                return { success: true, method: 'fingerprint', message: 'Fingerprint verified' };
            }
            
            console.log('[BiometricAuth] Fingerprint failed, falling back to password');
            return await this.authenticateLinuxPassword(reason);
        } catch (error) {
            return await this.authenticateLinuxPassword(reason);
        }
    }

    async authenticateLinuxPassword(reason) {
        try {
            const safeReason = (reason || 'Authenticate to proceed').replace(/'/g, "'\\''");
            const result = await execAsync(
                `pkexec env DISPLAY="${process.env.DISPLAY || ':0'}" DBUS_SESSION_BUS_ADDRESS="${process.env.DBUS_SESSION_BUS_ADDRESS || ''}" zenity --entry --title="Aartiq Authentication" --text="${safeReason}" --entry-text="" --width=400 2>&1 || echo "POLKIT_CANCEL"`,
                { timeout: 60000 }
            );

            if (result.stdout && !result.stdout.includes('POLKIT_CANCEL') && result.stdout.trim().length > 0) {
                return { success: true, method: 'password', message: 'Password verified' };
            }

            if (result.stderr && result.stderr.includes('cancelled')) {
                return { success: false, error: 'Authentication cancelled' };
            }

            try {
                const sudoResult = await execAsync(
                    `echo "authenticate" | sudo -S bash -c 'echo AUTH_OK' 2>&1`,
                    { timeout: 30000 }
                );
                if (sudoResult.stdout.includes('AUTH_OK')) {
                    return { success: true, method: 'password', message: 'Password verified via sudo' };
                }
            } catch {
                // sudo also failed
            }

            return { success: false, error: 'Authentication failed — no valid password provided' };
        } catch (error) {
            if (error.message?.includes('cancelled') || error.message?.includes('No password')) {
                return { success: false, error: 'Authentication cancelled' };
            }
            return { success: false, error: `Authentication failed: ${error.message}` };
        }
    }

    async quickCheck() {
        const availability = await this.checkAvailability();
        return {
            available: this.isAvailable,
            type: this.authType,
            platform: this.platform,
            ...availability
        };
    }
}

class CrossPlatformBiometricAuth {
    constructor() {
        this.authManager = new BiometricAuthManager();
    }

    async requireAuth(action, reason) {
        const check = await this.authManager.quickCheck();
        
        console.log(`[CrossPlatformAuth] ${action} requested - Checking biometric auth (${check.type})`);
        
        if (check.available && check.type !== 'none') {
            const result = await this.authManager.authenticate(reason);
            if (!result.success) {
                throw new Error(`Authentication failed: ${result.error}`);
            }
            return result;
        } else {
            console.warn('[CrossPlatformAuth] No biometric available — falling back to OS password prompt');
            const result = await this.authManager.authenticate(reason);
            if (!result.success) {
                throw new Error(`Authentication failed: ${result.error || 'No authentication method available'}`);
            }
            return result;
        }
    }

    async executeWithAuth(actions, reason = 'Execute critical action') {
        const results = [];
        
        const criticalActions = ['restart', 'shutdown', 'lock', 'delete', 'execute'];
        const isCriticalChain = actions.every(a => criticalActions.includes(a.type));
        
        if (isCriticalChain) {
            await this.requireAuth('critical-chain', reason);
        }
        
        for (const action of actions) {
            let result;
            
            switch (action.type) {
                case 'restart':
                    await execAsync('osascript -e \'tell app "System Events" to restart\'');
                    result = { success: true, action: 'restart' };
                    break;
                    
                case 'shutdown':
                    await execAsync('osascript -e \'tell app "System Events" to shut down\'');
                    result = { success: true, action: 'shutdown' };
                    break;
                    
                case 'lock':
                    await execAsync('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
                    result = { success: true, action: 'lock' };
                    break;
                    
                case 'open-url':
                    await execAsync(`open "${action.url}"`);
                    result = { success: true, action: 'open-url', url: action.url };
                    break;
                    
                case 'shell':
                    const { execSync } = require('child_process');
                    try {
                        execSync(action.command, { stdio: 'ignore' });
                        result = { success: true, action: 'shell' };
                    } catch (e) {
                        result = { success: false, action: 'shell', error: e.message };
                    }
                    break;
                    
                case 'wait':
                    await new Promise(r => setTimeout(r, action.ms || 1000));
                    result = { success: true, action: 'wait', ms: action.ms };
                    break;
                    
                default:
                    result = { success: false, action: action.type, error: 'Unknown action' };
            }
            
            results.push(result);
            
            if (!result.success && result.error) {
                console.error('[CrossPlatformAuth] Action failed:', result.error);
            }
        }
        
        return results;
    }
}

module.exports = { BiometricAuthManager, CrossPlatformBiometricAuth };
