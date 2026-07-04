/**
 * LaunchDaemon Manager
 * 
 * Generates and manages macOS launchd plists for scheduled automation.
 * Converts cron expressions to launchd CalendarInterval format.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class LaunchDaemonManager {
    constructor(userHomeDir) {
        this.userHome = userHomeDir || os.homedir();
        this.agentsDir = path.join(this.userHome, 'Library/LaunchAgents');
        this.daemonsDir = '/Library/LaunchDaemons';
        this.agentLabelPrefix = 'com.aartiq';
    }

    ensureAgentsDir() {
        if (!fs.existsSync(this.agentsDir)) {
            fs.mkdirSync(this.agentsDir, { recursive: true });
            console.log('[LaunchDaemon] Created agents directory:', this.agentsDir);
        }
    }

    /**
     * Parse cron expression to CalendarInterval components
     * Cron: minute hour day month weekday
     * Example: "0 8 * * *" = daily at 8am
     */
    parseCronToCalendarInterval(cronExpression) {
        const parts = cronExpression.trim().split(/\s+/);
        if (parts.length < 5) {
            console.warn('[LaunchDaemon] Invalid cron expression, defaulting to hourly');
            return { Hour: 0, Minute: 0 };
        }

        const [, minute, hour, day, weekday] = parts;
        
        const interval = {};
        
        // Parse minute
        if (minute !== '*') {
            interval.Minute = parseInt(minute);
        }
        
        // Parse hour
        if (hour !== '*') {
            interval.Hour = parseInt(hour);
        }
        
        // Parse day of month
        if (day !== '*') {
            interval.Day = parseInt(day);
        }
        
        // Parse day of week (0=Sun, 1=Mon in cron)
        if (weekday !== '*') {
            // Convert cron weekday (0-7 where 0 and 7 are Sunday) to launchd
            const weekdayNum = parseInt(weekday);
            if (!isNaN(weekdayNum)) {
                interval.Weekday = weekdayNum === 7 ? 0 : weekdayNum;
            }
        }

        return interval;
    }

    /**
     * Create a launchd plist for a scheduled task
     */
    createPlist(task) {
        const label = `${this.agentLabelPrefix}.${task.id}`;
        const scriptPath = path.join(this.userHome, 'Library/Application Support/Aartiq/scripts', `${task.id}.sh`);
        
        // Generate CalendarInterval from cron
        const cronExpr = task.schedule || '0 * * * *'; // Default: every hour
        const calendarInterval = this.parseCronToCalendarInterval(cronExpr);

        const plist = {
            Label: label,
            ProgramArguments: ['/bin/zsh', '-l', '-c', scriptPath],
            RunAtLoad: task.runOnCreate || false,
            StartCalendarInterval: calendarInterval,
            StandardOutPath: path.join(this.userHome, 'Library/Logs/Aartiq', `${task.id}.out.log`),
            StandardErrorPath: path.join(this.userHome, 'Library/Logs/Aartiq', `${task.id}.err.log`),
            KeepAlive: {
                SuccessfulExit: false
            },
            ProcessType: 'Interactive'
        };

        // Add weekly schedule if specified
        if (task.trigger === 'weekly') {
            plist.StartCalendarInterval = {
                Hour: task.hour || 8,
                Minute: task.minute || 0,
                Weekday: task.weekday || 1 // Monday
            };
        }

        // Add interval for repeating tasks
        if (task.trigger === 'interval' && task.interval) {
            delete plist.StartCalendarInterval;
            plist.StartInterval = task.interval; // seconds
        }

        return plist;
    }

    /**
     * Generate shell script for task execution
     */
    generateTaskScript(task) {
        const commands = [];
        
        // Set environment
        commands.push(`#!/bin/zsh`);
        commands.push(`export COMET_HOME="${this.userHome}/Library/Application Support/Aartiq"`);
        commands.push(`export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"`);
        commands.push(``);
        
        // Log start
        commands.push(`echo "$(date): Starting task ${task.name}"`);
        commands.push(``);

        // Execute based on task type
        if (task.type === 'pdf-generate') {
            commands.push(`# Generate PDF report`);
            commands.push(`cd "$COMET_HOME"`);
            commands.push(`node scripts/generate-pdf.js --task-id "${task.id}"`);
        } else if (task.type === 'web-scrape') {
            commands.push(`# Web scraping task`);
            commands.push(`cd "$COMET_HOME"`);
            commands.push(`node scripts/scrape-web.js --task-id "${task.id}"`);
        } else if (task.type === 'ai-prompt') {
            commands.push(`# AI prompt task`);
            commands.push(`cd "$COMET_HOME"`);
            commands.push(`node scripts/execute-ai-prompt.js --task-id "${task.id}"`);
        } else if (task.type === 'shell') {
            commands.push(`# Custom shell command`);
            commands.push(task.command || 'echo "No command specified"');
        } else if (task.type === 'workflow') {
            commands.push(`# Execute workflow chain`);
            commands.push(`cd "$COMET_HOME"`);
            commands.push(`node scripts/execute-workflow.js --task-id "${task.id}"`);
        } else if (task.type === 'restart') {
            commands.push(`# Restart Mac`);
            commands.push(`osascript -e 'tell app "System Events" to restart'`);
        } else if (task.type === 'shutdown') {
            commands.push(`# Shutdown Mac`);
            commands.push(`osascript -e 'tell app "System Events" to shut down'`);
        } else if (task.type === 'open-url') {
            commands.push(`# Open URL in browser`);
            commands.push(`open "${task.url || 'https://youtube.com'}"`);
        }

        commands.push(``);
        commands.push(`echo "$(date): Task ${task.name} completed"`);

        return commands.join('\n');
    }

    /**
     * Install a launchd agent for a task
     */
    async installTask(task) {
        this.ensureAgentsDir();

        const label = `${this.agentLabelPrefix}.${task.id}`;
        const plistPath = path.join(this.agentsDir, `${label}.plist`);
        const scriptPath = path.join(this.userHome, 'Library/Application Support/Aartiq/scripts', `${task.id}.sh`);
        
        try {
            // Ensure scripts directory exists
            const scriptsDir = path.dirname(scriptPath);
            if (!fs.existsSync(scriptsDir)) {
                fs.mkdirSync(scriptsDir, { recursive: true });
            }

            // Ensure logs directory exists
            const logsDir = path.join(this.userHome, 'Library/Logs/Aartiq');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }

            // Generate and save script
            const script = this.generateTaskScript(task);
            fs.writeFileSync(scriptPath, script, { mode: 0o755 });
            console.log('[LaunchDaemon] Created script:', scriptPath);

            // Generate and save plist
            const plist = this.createPlist(task);
            const plistXml = this.generatePlistXml(plist);
            fs.writeFileSync(plistPath, plistXml, { mode: 0o644 });
            console.log('[LaunchDaemon] Created plist:', plistPath);

            return { success: true, plistPath, scriptPath };
        } catch (error) {
            console.error('[LaunchDaemon] Install failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load (activate) a launchd agent
     */
    async loadAgent(taskId) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const label = `${this.agentLabelPrefix}.${taskId}`;
        
        try {
            const { stdout, stderr } = await execAsync(`launchctl load -w "${this.agentsDir}/${label}.plist"`);
            console.log('[LaunchDaemon] Loaded:', label);
            return { success: true };
        } catch (error) {
            if (error.message.includes('already loaded')) {
                return { success: true, message: 'Already loaded' };
            }
            console.error('[LaunchDaemon] Load failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Unload (deactivate) a launchd agent
     */
    async unloadAgent(taskId) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const label = `${this.agentLabelPrefix}.${taskId}`;
        
        try {
            await execAsync(`launchctl unload -w "${this.agentsDir}/${label}.plist"`);
            console.log('[LaunchDaemon] Unloaded:', label);
            return { success: true };
        } catch (error) {
            console.error('[LaunchDaemon] Unload failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove a launchd agent
     */
    async removeTask(taskId) {
        // Unload first
        await this.unloadAgent(taskId);

        const label = `${this.agentLabelPrefix}.${taskId}`;
        const plistPath = path.join(this.agentsDir, `${label}.plist`);
        const scriptPath = path.join(this.userHome, 'Library/Application Support/Aartiq/scripts', `${taskId}.sh`);

        try {
            if (fs.existsSync(plistPath)) {
                fs.unlinkSync(plistPath);
                console.log('[LaunchDaemon] Removed plist:', plistPath);
            }
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
                console.log('[LaunchDaemon] Removed script:', scriptPath);
            }
            return { success: true };
        } catch (error) {
            console.error('[LaunchDaemon] Remove failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * List all Aartiq launchd agents
     */
    async listAgents() {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            const { stdout } = await execAsync(`launchctl list | grep "${this.agentLabelPrefix}"`);
            const agents = stdout.trim().split('\n').filter(Boolean).map(line => {
                const parts = line.split(/\s+/);
                return {
                    label: parts[2] || parts[0],
                    pid: parts[0] === '-' ? null : parseInt(parts[0]),
                    status: parts[1] || 'unknown'
                };
            });
            return agents;
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate plist XML from object
     */
    generatePlistXml(obj) {
        const toXml = (value, key = null, indent = '') => {
            if (value === null || value === undefined) {
                return '';
            }
            
            if (Array.isArray(value)) {
                return value.map(item => toXml(item, key, indent)).join('\n');
            }
            
            if (typeof value === 'object') {
                let xml = '<dict>\n';
                for (const k of Object.keys(value)) {
                    xml += `${indent}  <key>${k}</key>\n`;
                    xml += toXml(value[k], k, indent + '  ');
                }
                xml += `${indent}</dict>`;
                return xml;
            }
            
            if (typeof value === 'boolean') {
                return `<${value ? 'true' : 'false'}/>`;
            }
            
            if (typeof value === 'number') {
                return `<integer>${value}</integer>`;
            }
            
            // String
            return `<string>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
        };

        const header = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
`;
        const footer = `</dict>
</plist>`;

        return header + toXml(obj) + '\n' + footer;
    }

    /**
     * Execute immediate task (for chained commands like "restart then open youtube")
     */
    async executeImmediate(command) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        try {
            let result;
            
            switch (command.type) {
                case 'restart':
                    await execAsync('osascript -e \'tell app "System Events" to restart\'');
                    result = 'Restarting...';
                    break;
                    
                case 'shutdown':
                    await execAsync('osascript -e \'tell app "System Events" to shut down\'');
                    result = 'Shutting down...';
                    break;
                    
                case 'sleep':
                    await execAsync('pmset sleepnow');
                    result = 'Sleeping...';
                    break;
                    
                case 'lock':
                    await execAsync('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
                    result = 'Screen locked';
                    break;
                    
                case 'open-url':
                    await execAsync(`open "${command.url || 'https://youtube.com'}"`);
                    result = `Opened: ${command.url}`;
                    break;
                    
                case 'shell':
                    await execAsync(command.command);
                    result = `Executed: ${command.command}`;
                    break;
                    
                case 'run-app':
                    await execAsync(`open -a "${command.app}"`);
                    result = `Opened: ${command.app}`;
                    break;
                    
                default:
                    result = `Unknown command: ${command.type}`;
            }
            
            console.log('[LaunchDaemon] Executed:', result);
            return { success: true, result };
        } catch (error) {
            console.error('[LaunchDaemon] Execute failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { LaunchDaemonManager };