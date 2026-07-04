const { screen, dialog, BrowserWindow } = require('electron');
const { automationLayer, PLATFORM } = require('../automation');

const ACTION_TYPES = ['click', 'type', 'key', 'scroll', 'move'];
const BUTTONS = ['left', 'right', 'middle'];
const MODIFIERS = ['command', 'control', 'alt', 'shift'];
const SCROLL_DIRS = ['up', 'down', 'left', 'right'];
const ALWAYS_CONFIRM_ACTIONS = ['click', 'type', 'key'];

class RobotService {
  constructor(permissionStore) {
    this.perms = permissionStore;
    this.lastAction = 0;
    this.MIN_DELAY_MS = 300;
    this.killFlag = false;
    this.automation = automationLayer;
    this._initPromise = null;
    this._init();
  }

  _init() {
    this._initPromise = this.automation.initialize();
  }

  async _ensureInitialized() {
    if (this._initPromise) {
      await this._initPromise;
      this._initPromise = null;
    }
  }

  async initialize() {
    await this._ensureInitialized();
    return this.automation.isAvailable;
  }

  get isAvailable() {
    return this.automation.isAvailable;
  }

  get backend() {
    return this.automation.backend;
  }

  get platform() {
    return PLATFORM;
  }

  kill() {
    this.killFlag = true;
    this.perms.revoke('robot');
    this.perms.logAudit('robot.kill: Emergency kill switch activated');
    console.log('[RobotService] KILL SWITCH activated — all robot permissions revoked');
  }

  resetKill() {
    this.killFlag = false;
  }

  _validateAction(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Action must be an object');
    }
    if (!ACTION_TYPES.includes(raw.type)) {
      throw new Error(`Invalid action type: ${raw.type}`);
    }

    const action = { type: raw.type, reason: String(raw.reason || 'No reason provided') };

    switch (raw.type) {
      case 'click':
      case 'move': {
        action.x = Math.round(Number(raw.x));
        action.y = Math.round(Number(raw.y));
        if (!Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.y < 0) {
          throw new Error(`Invalid coordinates: (${raw.x}, ${raw.y})`);
        }
        if (raw.type === 'click') {
          action.button = BUTTONS.includes(raw.button) ? raw.button : 'left';
          action.double = Boolean(raw.double);
        }
        break;
      }
      case 'type': {
        action.text = String(raw.text || '');
        if (action.text.length === 0) throw new Error('Type action requires non-empty text');
        if (action.text.length > 2000) throw new Error('Type text exceeds 2000 char limit');
        break;
      }
      case 'key': {
        action.key = String(raw.key || '');
        if (!action.key) throw new Error('Key action requires a key');
        action.modifiers = (raw.modifiers || []).filter(m => MODIFIERS.includes(m));
        break;
      }
      case 'scroll': {
        action.x = Math.round(Number(raw.x || 0));
        action.y = Math.round(Number(raw.y || 0));
        if (!SCROLL_DIRS.includes(raw.direction)) {
          throw new Error(`Invalid scroll direction: ${raw.direction}`);
        }
        action.direction = raw.direction;
        action.amount = Math.min(20, Math.max(1, Number(raw.amount) || 3));
        break;
      }
    }
    return action;
  }

  _validateCoords(x, y) {
    const displays = screen.getAllDisplays();
    const valid = displays.some(d =>
      x >= d.bounds.x && x < d.bounds.x + d.bounds.width &&
      y >= d.bounds.y && y < d.bounds.y + d.bounds.height
    );
    if (!valid) {
      throw new Error(`Coordinates (${x}, ${y}) are outside all display bounds`);
    }
  }

  async _showConfirmDialog(action) {
    let message;
    switch (action.type) {
      case 'click':
        message = `Click "${action.button}" at (${action.x}, ${action.y})${action.double ? ' (double-click)' : ''}`;
        break;
      case 'type':
        message = `Type text: "${action.text.slice(0, 100)}${action.text.length > 100 ? '...' : ''}"`;
        break;
      case 'key':
        message = `Press key: ${action.modifiers?.length ? action.modifiers.join('+') + '+' : ''}${action.key}`;
        break;
      case 'scroll':
        message = `Scroll ${action.direction} (${action.amount}x) at (${action.x}, ${action.y})`;
        break;
      case 'move':
        message = `Move mouse to (${action.x}, ${action.y})`;
        break;
    }

    const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!focusedWindow) return true;

    const result = await dialog.showMessageBox(focusedWindow, {
      type: 'question',
      buttons: ['Allow', 'Deny'],
      defaultId: 1,
      cancelId: 1,
      title: 'Aartiq Robot Action',
      message: `AI wants to perform a desktop action:`,
      detail: `${message}\n\nReason: ${action.reason}`,
    });

    return result.response === 0;
  }

  async _robustClick(x, y, button = 'left', double = false, maxRetries = 3) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const currentPos = this.automation.getMousePos();
        if (currentPos.x !== x || currentPos.y !== y) {
          this.automation.moveMouse(x, y);
          await sleep(50);
        }
        
        await sleep(30);
        this.automation.click(x, y, button, double);
        await sleep(20);
        
        const posAfter = this.automation.getMousePos();
        if (posAfter.x === x && posAfter.y === y) {
          return { success: true, verified: true };
        }
        
        if (attempt < maxRetries) {
          await sleep(100 * attempt);
        }
      } catch (err) {
        console.warn(`[RobotService] Click attempt ${attempt} failed:`, err.message);
        if (attempt < maxRetries) {
          await sleep(100 * attempt);
        } else {
          throw err;
        }
      }
    }
    
    return { success: true, verified: false };
  }

  async execute(raw, opts = {}) {
    await this._ensureInitialized();

    if (!this.automation.isAvailable) {
      throw new Error(`Automation not available. Backend: ${this.automation.backend}`);
    }

    if (this.killFlag) {
      throw new Error('Robot actions are disabled (kill switch active)');
    }

    const action = this._validateAction(raw);

    if (!this.perms.isGranted('robot')) {
      throw new Error('Robot permission not granted. Enable in Settings > Permissions.');
    }

    if (action.type === 'click' || action.type === 'scroll' || action.type === 'move') {
      this._validateCoords(action.x, action.y);
    }

    if (ALWAYS_CONFIRM_ACTIONS.includes(action.type) && !opts.skipConfirm) {
      const allowed = await this._showConfirmDialog(action);
      if (!allowed) {
        this.perms.logAudit(`robot.denied: ${action.type} — ${action.reason}`);
        throw new Error('User denied the robot action');
      }
    }

    this.perms.logAudit(`robot.execute: ${action.type} — ${action.reason}`);

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const now = Date.now();
    if (now - this.lastAction < this.MIN_DELAY_MS) {
      await sleep(this.MIN_DELAY_MS);
    }

    if (this.killFlag) {
      throw new Error('Robot actions aborted (kill switch activated during delay)');
    }

    let result = { success: true, action: action.type, reason: action.reason };

    switch (action.type) {
      case 'click':
        const clickResult = await this._robustClick(
          action.x, 
          action.y, 
          action.button, 
          action.double,
          opts.maxRetries || 3
        );
        result.verified = clickResult.verified;
        break;
      case 'type':
        this.automation.typeText(action.text);
        break;
      case 'key':
        this.automation.keyTap(action.key, action.modifiers || []);
        break;
      case 'scroll':
        this.automation.scroll(action.x, action.y, action.direction, action.amount);
        break;
      case 'move':
        this.automation.moveMouse(action.x, action.y);
        break;
    }

    this.lastAction = Date.now();
    return result;
  }

  async executeSequence(actions, opts = {}) {
    const results = [];
    for (const raw of actions) {
      if (this.killFlag) {
        results.push({ success: false, error: 'Aborted by kill switch' });
        break;
      }
      try {
        const result = await this.execute(raw, opts);
        results.push(result);
      } catch (e) {
        results.push({ success: false, error: e.message });
        if (opts.stopOnError !== false) break;
      }
    }
    return results;
  }

  moveMouse(x, y) {
    this.automation.moveMouse(x, y);
  }

  getMousePos() {
    return this.automation.getMousePos();
  }
}

module.exports = { RobotService };
