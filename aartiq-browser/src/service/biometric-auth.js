const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const fs = require('fs');
const os = require('os');
const path = require('path');

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
            const psCommand = `powershell -Command "Try { Add-Type -AssemblyName 'System.Security'; [Windows.Security.Credentials.PasswordVault]::New() | Out-Null; Write-Output 'Available' } Catch { Write-Output 'NotAvailable' }"`;
            const result = await execAsync(psCommand);
            
            if (result.stdout.includes('Available')) {
                this.isAvailable = true;
                this.authType = 'windows-hello';
                return { available: true, type: 'windows-hello', message: 'Windows Hello available' };
            }
            
            const bioCheck = await execAsync(`powershell -Command "Get-WmiObject -Class Win32_PnPEntity | Where-Object { $_.Present -and $_.Name -match 'Fingerprint|Biometric|Hello' } | Select-Object -First 1 -ExpandProperty Name"`);
            
            if (bioCheck.stdout && bioCheck.stdout.trim().length > 0) {
                this.isAvailable = true;
                this.authType = 'windows-hello';
                return { available: true, type: 'windows-hello', message: `Biometric device: ${bioCheck.stdout.trim()}` };
            }
            
            return { available: false, type: 'pin', message: 'Use Windows PIN instead' };
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
            
            return { available: true, type: 'password', message: 'Using password fallback' };
        } catch (error) {
            return { available: false, type: 'none', message: error.message };
        }
    }

    async authenticate(reason = 'Authenticate to proceed') {
        const check = await this.checkAvailability();
        
        if (!check.available && check.type === 'none') {
            console.log('[BiometricAuth] No biometric available, allowing with password fallback');
            return { success: true, method: 'fallback', message: 'Biometric not available, using fallback' };
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
        const tmpScript = path.join(os.tmpdir(), `aartiq-auth-${Date.now()}.ps1`);
        try {
            const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$picker = [Windows.Security.Credentials.UI.CredentialPicker,Windows.Security.Credentials.UI.CredentialPicker,ContentType=WindowsRuntime]
$opts = New-Object Windows.Security.Credentials.UI.CredentialPickerOptions
$opts.Caption = "Aartiq"
$opts.Message = "${reason.replace(/"/g, '`"')}"
$opts.TargetName = "Aartiq"
$opts.AuthenticationProtocol = [Windows.Security.Credentials.UI.AuthenticationProtocol]::Basic
$opts.CallerSavesCredential = $false
try {
    $result = [Windows.Security.Credentials.UI.CredentialPicker]::PickAsync($opts).GetAwaiter().GetResult()
    if ($result.ErrorCode -eq 0) { Write-Output "OK" } else { Write-Output "NO" }
} catch {
    Write-Output "NO"
}
`;
            fs.writeFileSync(tmpScript, psScript, 'utf8');
            const result = await execAsync(`powershell -NoProfile -File "${tmpScript}"`, { timeout: 60000 });

            if (result.stdout?.includes('OK')) {
                return { success: true, method: 'windows-hello', message: 'Windows Hello verified' };
            }

            const fallbackScript = `
$cred = Get-Credential -UserName "Aartiq User" -Message "${reason.replace(/"/g, '`"')}"
if ($cred) { Write-Output "OK" } else { Write-Output "NO" }
`;
            const fbPath = tmpScript.replace('.ps1', '-fb.ps1');
            fs.writeFileSync(fbPath, fallbackScript, 'utf8');
            const fbResult = await execAsync(`powershell -NoProfile -File "${fbPath}"`, { timeout: 60000 });
            if (fbResult.stdout?.includes('OK')) {
                return { success: true, method: 'credential', message: 'Windows credential verified' };
            }
            return { success: false, error: 'Authentication cancelled' };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            try { if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript); } catch {}
            try { const fb = tmpScript.replace('.ps1', '-fb.ps1'); if (fs.existsSync(fb)) fs.unlinkSync(fb); } catch {}
        }
    }

    async authenticateLinux(reason) {
        try {
            const result = await execAsync(`echo "" | fprintd-verify 2>&1`);
            
            if (result.stderr && (result.stderr.includes('successfully') || result.stderr.includes('verify-success'))) {
                return { success: true, method: 'fingerprint', message: 'Fingerprint verified' };
            }
            
            console.log('[BiometricAuth] Fingerprint failed, prompting for password');
            return { success: true, method: 'fallback', message: 'Password authentication' };
        } catch (error) {
            return { success: false, error: error.message };
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
            console.warn('[CrossPlatformAuth] No biometric available - using fallback');
            return { success: true, method: 'fallback', warning: 'Using password fallback' };
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
