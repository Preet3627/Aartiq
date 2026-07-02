/**
 * Tray Manager
 * 
 * Manages the system tray icon and menu for the background service.
 * Provides quick access to common actions and status display.
 */

const { Tray, Menu, nativeImage, app } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');

class TrayManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.tray = null;
        this.options = {
            iconPath: options.iconPath || this.getDefaultIconPath(),
            tooltip: options.tooltip || 'Comet-AI Service',
            onShowWindow: options.onShowWindow || (() => {}),
            onQuit: options.onQuit || (() => {}),
            onToggleTask: options.onToggleTask || (() => {}),
            onOpenDashboard: options.onOpenDashboard || (() => {}),
            onViewLogs: options.onViewLogs || (() => {})
        };
        this.isVisible = true;
        this.taskCount = 0;
        this.activeTasks = 0;
    }

    async initialize() {
        try {
            // Create tray icon
            const icon = this.createTrayIcon();
            this.tray = new Tray(icon);
            
            // Set tooltip
            this.tray.setToolTip(this.options.tooltip);
            
            // Build context menu
            this.updateContextMenu();
            
            // Handle click events
            this.tray.on('click', () => this.handleClick());
            this.tray.on('double-click', () => this.handleDoubleClick());
            
            console.log('[Tray] System tray initialized');
            return true;
        } catch (error) {
            console.error('[Tray] Failed to initialize:', error);
            return false;
        }
    }

    getDefaultIconPath() {
        // In production, this would be the app icon
        const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
        return path.join(__dirname, '..', '..', '..', iconName);
    }

    createTrayIcon() {
        // Create a simple icon programmatically if file doesn't exist
        const size = process.platform === 'win32' ? 16 : 22;
        
        // Create a simple colored icon
        const canvas = Buffer.alloc(size * size * 4);
        const color = { r: 0, g: 229, b: 255, a: 255 }; // Cyan color
        
        for (let i = 0; i < size * size; i++) {
            const offset = i * 4;
            // Create a circular icon
            const x = i % size;
            const y = Math.floor(i / size);
            const centerX = size / 2;
            const centerY = size / 2;
            const radius = size / 2 - 1;
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            
            if (distance <= radius) {
                canvas[offset] = color.r;
                canvas[offset + 1] = color.g;
                canvas[offset + 2] = color.b;
                canvas[offset + 3] = color.a;
            } else {
                canvas[offset] = 0;
                canvas[offset + 1] = 0;
                canvas[offset + 2] = 0;
                canvas[offset + 3] = 0;
            }
        }
        
        return nativeImage.createFromBuffer(canvas, {
            width: size,
            height: size
        });
    }

    updateContextMenu(tasks = [], activeTask = null) {
        const taskItems = tasks.length > 0
            ? tasks.slice(0, 5).map(task => ({
                label: `${task.enabled ? '●' : '○'} ${task.name}`,
                sublabel: task.nextRun ? `Next: ${this.formatTime(task.nextRun)}` : 'Disabled',
                click: () => this.options.onToggleTask(task.id)
            }))
            : [{ label: 'No scheduled tasks', enabled: false }];

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Comet-AI Service',
                enabled: false
            },
            {
                label: `Status: ${activeTask ? 'Running task...' : 'Idle'}`,
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Scheduled Tasks',
                submenu: taskItems
            },
            { type: 'separator' },
            {
                label: 'Open Dashboard',
                click: () => this.options.onOpenDashboard()
            },
            {
                label: 'View Logs',
                click: () => this.options.onViewLogs()
            },
            { type: 'separator' },
            {
                label: 'Pause All Tasks',
                click: () => this.pauseAllTasks(),
                enabled: tasks.some(t => t.enabled)
            },
            {
                label: 'Resume All Tasks',
                click: () => this.resumeAllTasks(),
                enabled: tasks.some(t => !t.enabled)
            },
            { type: 'separator' },
            {
                label: 'Show Window',
                click: () => this.show()
            },
            {
                label: 'Hide',
                click: () => this.hide()
            },
            { type: 'separator' },
            {
                label: 'Quit Comet-AI',
                click: () => this.options.onQuit()
            }
        ]);

        if (this.tray) {
            this.tray.setContextMenu(contextMenu);
        }
    }

    formatTime(date) {
        if (!date) return 'Never';
        const d = new Date(date);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    handleClick() {
        // Single click - show context menu
        this.tray.popUpContextMenu();
    }

    handleDoubleClick() {
        // Double click - open dashboard
        this.options.onOpenDashboard();
    }

    show() {
        this.isVisible = true;
        if (this.tray) {
            this.tray.setImage(this.createTrayIcon());
        }
        console.log('[Tray] Shown');
    }

    hide() {
        this.isVisible = false;
        console.log('[Tray] Hidden');
    }

    async pauseAllTasks() {
        console.log('[Tray] Pausing all tasks');
        // This would be handled by the task scheduler
        const { EventEmitter } = require('events');
        this.emit('pause-all');
    }

    async resumeAllTasks() {
        console.log('[Tray] Resuming all tasks');
        this.emit('resume-all');
    }

    setBadgeCount(count) {
        this.taskCount = count;
        this.updateTitle();
    }

    setActiveTask(taskName) {
        this.activeTasks = taskName ? 1 : 0;
        this.updateTitle();
    }

    updateTitle() {
        if (this.tray) {
            const status = this.activeTasks > 0 
                ? `Comet-AI - Running: ${this.activeTasks}`
                : `Comet-AI - ${this.taskCount} tasks`;
            this.tray.setToolTip(status);
        }
    }

    showBalloon(title, content, icon) {
        if (this.tray && process.platform === 'win32') {
            this.tray.displayBalloon({
                title: title,
                content: content,
                iconType: icon || 'info'
            });
        }
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = { TrayManager };
