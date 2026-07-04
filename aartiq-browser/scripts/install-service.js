/**
 * Windows Service Installer
 * 
 * Installs the Aartiq background service using Windows Task Scheduler.
 * Run as administrator for system-level installation.
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SERVICE_NAME = 'Aartiq-Service';
const SERVICE_DISPLAY_NAME = 'Aartiq Background Service';
const APP_NAME = 'Aartiq';

class WindowsServiceInstaller {
    constructor(options = {}) {
        this.servicePath = options.servicePath || process.execPath;
        this.runAsSystem = options.runAsSystem !== false; // Default to SYSTEM user
        this.autoStart = options.autoStart !== false;
    }

    async install() {
        console.log('='.repeat(50));
        console.log('Aartiq Service Installer - Windows');
        console.log('='.repeat(50));
        
        try {
            // Check for admin privileges
            const isAdmin = await this.checkAdminPrivileges();
            if (!isAdmin && this.runAsSystem) {
                console.warn('Warning: Not running as administrator.');
                console.warn('SYSTEM user installation requires admin privileges.');
                console.warn('Falling back to user-level installation.');
                this.runAsSystem = false;
            }

            // Check if service already exists
            const exists = await this.serviceExists();
            if (exists) {
                console.log('Service already exists. Uninstalling first...');
                await this.uninstall();
            }

            // Create service task
            await this.createTask();

            console.log('');
            console.log('✅ Service installed successfully!');
            console.log('');
            console.log('Service Details:');
            console.log(`  Name: ${SERVICE_NAME}`);
            console.log(`  Display Name: ${SERVICE_DISPLAY_NAME}`);
            console.log(`  Run as: ${this.runAsSystem ? 'SYSTEM (no login required)' : 'Current user'}`);
            console.log(`  Start: ${this.autoStart ? 'Automatic (on startup)' : 'Manual'}`);
            console.log(`  Executable: ${this.servicePath}`);
            console.log('');

            // Start the service
            await this.start();

            console.log('✅ Service started successfully!');
            console.log('');
            console.log('You can manage the service using:');
            console.log('  Task Scheduler (taskschd.msc)');
            console.log('  Or: schtasks /run /tn "' + SERVICE_NAME + '"');
            console.log('');

            return { success: true };

        } catch (error) {
            console.error('');
            console.error('❌ Installation failed:', error.message);
            console.error('');
            return { success: false, error: error.message };
        }
    }

    async uninstall() {
        console.log('Uninstalling service...');

        try {
            // Stop the service first
            await this.stop();

            // Delete the scheduled task
            await this.execCommand(`schtasks /delete /tn "${SERVICE_NAME}" /f`);

            console.log('✅ Service uninstalled successfully!');
            return { success: true };

        } catch (error) {
            console.error('Uninstall failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async start() {
        try {
            await this.execCommand(`schtasks /run /tn "${SERVICE_NAME}"`);
        } catch (error) {
            // Ignore if already running
            if (!error.message.includes('already running')) {
                throw error;
            }
        }
    }

    async stop() {
        try {
            await this.execCommand(`schtasks /end /tn "${SERVICE_NAME}"`);
        } catch (error) {
            // Ignore if not running
        }
    }

    async restart() {
        await this.stop();
        await this.start();
    }

    async status() {
        try {
            const result = await this.execCommand(`schtasks /query /tn "${SERVICE_NAME}" /fo CSV /v`);
            console.log('Service Status:');
            console.log(result.stdout);
            return { running: true, output: result.stdout };
        } catch (error) {
            if (error.message.includes('does not exist')) {
                return { running: false, exists: false };
            }
            throw error;
        }
    }

    async serviceExists() {
        try {
            await this.execCommand(`schtasks /query /tn "${SERVICE_NAME}"`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async createTask() {
        const scheduleType = this.autoStart ? 'ONSTART' : 'ONLOGON';
        
        // Base command
        let command = `schtasks /create /tn "${SERVICE_NAME}" /tr "${this.servicePath}" /sc ${scheduleType}`;

        // Add system user if requested
        if (this.runAsSystem) {
            command += ' /ru SYSTEM /rl HIGHEST';
        }

        // Allow running on demand
        command += ' /f'; // Force create (overwrite if exists)

        await this.execCommand(command);

        // Additional settings for robustness
        const additionalSettings = [
            // Set restart on failure
            `schtasks /change /tn "${SERVICE_NAME}" /ri 60000 /rl HIGHEST`,
            // Start immediately
            `schtasks /change /tn "${SERVICE_NAME}" /st 00:00`,
            // Delete task if not rescheduled
            `schtasks /change /tn "${SERVICE_NAME}" /z`
        ];

        for (const setting of additionalSettings) {
            try {
                await this.execCommand(setting);
            } catch (error) {
                // Ignore individual setting errors
                console.warn('Warning: Could not apply setting:', setting.substring(0, 50) + '...');
            }
        }
    }

    async checkAdminPrivileges() {
        try {
            await this.execCommand('net session');
            return true;
        } catch (error) {
            return false;
        }
    }

    execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const action = args[0] || 'install';
    
    const installer = new WindowsServiceInstaller({
        servicePath: args[1] || process.execPath,
        runAsSystem: !args.includes('--user'),
        autoStart: !args.includes('--manual')
    });

    (async () => {
        switch (action) {
            case 'install':
                await installer.install();
                break;
            case 'uninstall':
                await installer.uninstall();
                break;
            case 'start':
                await installer.start();
                console.log('Service started.');
                break;
            case 'stop':
                await installer.stop();
                console.log('Service stopped.');
                break;
            case 'restart':
                await installer.restart();
                console.log('Service restarted.');
                break;
            case 'status':
                await installer.status();
                break;
            default:
                console.log('Usage: node install-service.js [install|uninstall|start|stop|restart|status]');
                console.log('');
                console.log('Options:');
                console.log('  --user     Install for current user only (not SYSTEM)');
                console.log('  --manual   Do not auto-start on boot');
                break;
        }
    })();
}

module.exports = { WindowsServiceInstaller };
