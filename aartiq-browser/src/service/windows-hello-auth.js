/**
 * Windows Hello Authentication Module
 *
 * Implements proper Windows Hello verification using the native WebAuthn API
 * (webauthn.dll) for cryptographic challenge-response with TPM-backed keys.
 *
 * Replaces the previous PowerShell-based CredentialPicker approach with:
 * - W3C WebAuthn / FIDO2 standard challenge-response
 * - TPM-backed key storage (private keys never leave hardware)
 * - Biometric/PIN verification through Windows Security dialogs
 * - Attestation support for verifying key genuineness
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const webauthnService = require('../lib/webauthn-service');

class WindowsHelloAuth {
    constructor() {
        this.platform = os.platform();
        this.isAvailable = false;
        this.authType = null;
    }

    /**
     * Check if Windows Hello WebAuthn is available on this system.
     * Uses the native webauthn.dll API check — no PowerShell required.
     */
    async checkAvailability() {
        if (this.platform !== 'win32') {
            return { available: false, type: 'none', message: 'Windows only' };
        }

        const platformInfo = webauthnService.getPlatformInfo();
        this.isAvailable = platformInfo.supported;
        this.authType = platformInfo.supported ? 'webauthn' : 'none';

        return {
            available: platformInfo.supported,
            type: platformInfo.supported ? 'webauthn' : 'none',
            apiVersion: platformInfo.apiVersion,
            supportsCable: platformInfo.supportsCable,
            hasCredential: webauthnService.hasCredential(),
            message: platformInfo.supported
                ? `Windows Hello WebAuthn available (API v${platformInfo.apiVersion})`
                : 'WebAuthn not supported on this system',
        };
    }

    /**
     * Authenticate using Windows Hello via WebAuthn.
     *
     * Triggers the Windows Security dialog (biometric / PIN) and performs
     * a cryptographic challenge-response. The private key never leaves the TPM.
     */
    async authenticate(reason = 'Authenticate to proceed') {
        if (this.platform !== 'win32') {
            return { success: false, error: 'Windows only' };
        }

        if (!webauthnService.isSupported()) {
            return { success: false, error: 'WebAuthn not supported on this system', code: 'NOT_AVAILABLE' };
        }

        try {
            if (!webauthnService.hasCredential()) {
                const reg = await webauthnService.registerCredential({
                    userId: undefined,
                    userName: 'aartiq-user',
                    displayName: 'Aartiq User',
                });
                if (!reg.success) {
                    return { success: false, error: `Failed to register credential: ${reg.error}`, code: 'REGISTRATION_FAILED' };
                }
            }

            const result = await webauthnService.authenticate(reason);

            return {
                success: result.success,
                method: 'windows-hello-webauthn',
                verified: result.success,
                credentialId: result.credentialId || null,
                message: result.success ? 'Windows Hello verified' : (result.error || 'Authentication failed'),
                code: result.success ? 'SUCCESS' : (result.error || 'AUTH_FAILED'),
            };
        } catch (error) {
            return { success: false, error: error.message, code: 'EXCEPTION' };
        }
    }

    /**
     * Create a Windows Hello credential (TPM-backed key pair).
     * Delegates to webauthn-service for the actual WebAuthn registration.
     */
    async createCredential() {
        if (this.platform !== 'win32') {
            return { success: false, error: 'Windows only' };
        }

        try {
            const result = await webauthnService.registerCredential({
                userId: undefined,
                userName: 'aartiq-user',
                displayName: 'Aartiq User',
            });

            return {
                success: result.success,
                credentialId: result.credentialId || null,
                message: result.success ? 'Windows Hello credential created' : result.error,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify a Windows Hello credential by performing a fresh assertion.
     */
    async verifyCredential() {
        if (this.platform !== 'win32') {
            return { success: false, error: 'Windows only' };
        }

        try {
            const authResult = await this.authenticate('Verify your identity');
            return {
                success: authResult.success,
                verified: authResult.verified || false,
                method: authResult.method || 'windows-hello-webauthn',
                message: authResult.message,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Quick availability check (cached).
     */
    async quickCheck() {
        if (this.isAvailable !== false && this.authType !== null) {
            return {
                available: this.isAvailable,
                type: this.authType,
                platform: this.platform,
            };
        }
        return await this.checkAvailability();
    }
}

/**
 * Cross-platform biometric authentication manager.
 * Handles Windows Hello (WebAuthn), macOS Touch ID, and Linux fingerprint.
 */
class CrossPlatformBiometricAuth {
    constructor() {
        this.windowsHello = new WindowsHelloAuth();
        this.platform = os.platform();
    }

    /**
     * Check biometric availability for the current platform.
     */
    async checkAvailability() {
        if (this.platform === 'win32') {
            return await this.windowsHello.checkAvailability();
        } else if (this.platform === 'darwin') {
            return await this.checkMacAvailability();
        } else if (this.platform === 'linux') {
            return await this.checkLinuxAvailability();
        }
        return { available: false, type: 'none', message: 'Unsupported platform' };
    }

    /**
     * Authenticate with the platform-appropriate method.
     */
    async authenticate(reason = 'Authenticate to proceed') {
        if (this.platform === 'win32') {
            return await this.windowsHello.authenticate(reason);
        } else if (this.platform === 'darwin') {
            return await this.authenticateMac(reason);
        } else if (this.platform === 'linux') {
            return await this.authenticateLinux(reason);
        }
        return { success: false, error: 'Unsupported platform' };
    }

    /**
     * Require authentication for an action. Throws on failure.
     */
    async requireAuth(action, reason) {
        const check = await this.checkAvailability();

        console.log(`[CrossPlatformAuth] ${action} requested - Checking biometric auth (${check.type})`);

        const result = await this.authenticate(reason);
        if (!result.success) {
            throw new Error(`Authentication failed: ${result.error}`);
        }
        return result;
    }

    /**
     * Execute a chain of actions with authentication.
     */
    async executeWithAuth(actions, reason = 'Execute critical action') {
        const results = [];

        const criticalActions = ['restart', 'shutdown', 'lock', 'delete', 'execute'];
        const isCriticalChain = actions.every(a => criticalActions.includes(a.type));

        if (isCriticalChain) {
            await this.requireAuth('critical-chain', reason);
        }

        const { execSync } = require('child_process');

        for (const action of actions) {
            let result;

            try {
                switch (action.type) {
                    case 'restart':
                        if (this.platform === 'darwin') {
                            await execAsync('osascript -e \'tell app "System Events" to restart\'');
                        } else if (this.platform === 'win32') {
                            await execAsync('shutdown /r /t 0');
                        } else {
                            await execAsync('sudo reboot');
                        }
                        result = { success: true, action: 'restart' };
                        break;

                    case 'shutdown':
                        if (this.platform === 'darwin') {
                            await execAsync('osascript -e \'tell app "System Events" to shut down\'');
                        } else if (this.platform === 'win32') {
                            await execAsync('shutdown /s /t 0');
                        } else {
                            await execAsync('sudo shutdown -h now');
                        }
                        result = { success: true, action: 'shutdown' };
                        break;

                    case 'lock':
                        if (this.platform === 'darwin') {
                            await execAsync('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
                        } else if (this.platform === 'win32') {
                            await execAsync('rundll32.exe user32.dll,LockWorkStation');
                        } else {
                            await execAsync('xdg-screensaver lock');
                        }
                        result = { success: true, action: 'lock' };
                        break;

                    case 'open-url':
                        if (this.platform === 'darwin') {
                            await execAsync(`open "${action.url}"`);
                        } else if (this.platform === 'win32') {
                            await execAsync(`start "" "${action.url}"`);
                        } else {
                            await execAsync(`xdg-open "${action.url}"`);
                        }
                        result = { success: true, action: 'open-url', url: action.url };
                        break;

                    case 'shell':
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
            } catch (e) {
                result = { success: false, action: action.type, error: e.message };
            }

            results.push(result);

            if (!result.success && result.error) {
                console.error('[CrossPlatformAuth] Action failed:', result.error);
            }
        }

        return results;
    }

    // ── macOS methods ────────────────────────────────────────────────────────

    async checkMacAvailability() {
        try {
            if (webauthnService.isSupported()) {
                return { available: true, type: 'webauthn', message: 'WebAuthn caBLE available' };
            }
        } catch (_) {}

        try {
            const { systemPreferences } = require('electron');
            if (systemPreferences && systemPreferences.canPromptTouchID()) {
                return { available: true, type: 'touchid', message: 'Touch ID available' };
            }
            return { available: false, type: 'none', message: 'Touch ID not configured' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async authenticateMac(reason) {
        if (webauthnService.isSupported()) {
            try {
                if (!webauthnService.hasCredential()) {
                    await webauthnService.registerCredential({
                        userName: 'aartiq-user',
                        displayName: 'Aartiq User',
                    });
                }
                const result = await webauthnService.authenticate(reason);
                if (result.success) {
                    return { success: true, method: 'webauthn-cable', message: 'WebAuthn verified' };
                }
            } catch (e) {
                console.warn('[CrossPlatformAuth] WebAuthn caBLE failed, trying Touch ID:', e.message);
            }
        }

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

    // ── Linux methods ────────────────────────────────────────────────────────

    async checkLinuxAvailability() {
        try {
            const whichResult = await execAsync('which fprintd 2>/dev/null || echo "not found"');
            if (whichResult.stdout.includes('not found')) {
                return { available: false, type: 'none', message: 'fprintd not installed' };
            }

            const listResult = await execAsync('fprintd-list 2>&1 || echo "No devices"');
            if (!listResult.stdout.includes('No devices') && !listResult.stdout.includes('error')) {
                return { available: true, type: 'fingerprint', message: 'Fingerprint reader detected' };
            }

            return { available: false, type: 'password', message: 'No fingerprint reader' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async authenticateLinux(reason) {
        try {
            const result = await execAsync('echo "" | fprintd-verify 2>&1');
            if (result.stderr && (result.stderr.includes('successfully') || result.stderr.includes('verify-success'))) {
                return { success: true, method: 'fingerprint', message: 'Fingerprint verified' };
            }
        } catch (error) {
            // Fall through to password
        }

        return await this.authenticateLinuxPassword(reason);
    }

    async authenticateLinuxPassword(reason) {
        try {
            const safeReason = (reason || 'Authenticate to proceed').replace(/'/g, "'\\''");
            const result = await execAsync(
                `zenity --entry --title="Aartiq Authentication" --text="${safeReason}" --entry-text="" --width=400 2>&1`,
                { timeout: 60000 }
            );

            if (result.stdout && result.stdout.trim().length > 0) {
                const verifyResult = await execAsync(
                    `echo '${result.stdout.trim()}' | sudo -S echo "verified" 2>&1`,
                    { timeout: 10000 }
                );

                if (verifyResult.stdout.includes('verified')) {
                    return { success: true, method: 'password', message: 'Password verified' };
                } else {
                    return { success: false, error: 'Incorrect password' };
                }
            }

            return { success: false, error: 'Authentication cancelled' };
        } catch (error) {
            if (error.message?.includes('cancelled') || error.message?.includes('No password')) {
                return { success: false, error: 'Authentication cancelled' };
            }
            return { success: false, error: `Authentication failed: ${error.message}` };
        }
    }
}

module.exports = { WindowsHelloAuth, CrossPlatformBiometricAuth };
