const EventEmitter = require('events');
const path = require('path');

class AutomationManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = [];
    this.store = null;
    this._initialized = false;
  }

  /**
   * Initialize with electron-store (must be called after app is ready).
   */
  init() {
    if (this._initialized) return;
    try {
      const Store = require('electron-store');
      this.store = new Store({ name: 'automation-manager' });
      this.tasks = this.store.get('tasks', []);
      this._initialized = true;
      console.log(`[AutomationManager] Loaded ${this.tasks.length} tasks`);
    } catch (e) {
      console.error('[AutomationManager] Store init failed:', e.message);
      this._initialized = true; // proceed without persistence
    }
  }

  _save() {
    if (this.store) {
      try {
        this.store.set('tasks', this.tasks);
      } catch (e) {
        console.error('[AutomationManager] Save failed:', e.message);
      }
    }
  }

  _genId() {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  getAllTasks() {
    return [...this.tasks];
  }

  getTask(taskId) {
    return this.tasks.find(t => t.id === taskId) || null;
  }

  addTask(task) {
    const newTask = {
      id: task.id || this._genId(),
      name: task.name || 'Unnamed Task',
      type: task.type || 'custom',
      enabled: task.enabled !== false,
      schedule: task.schedule || null,
      url: task.url || null,
      steps: task.steps || [],
      command: task.command || null,
      params: task.params || {},
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3,
      createdAt: task.createdAt || Date.now(),
      updatedAt: Date.now(),
      lastRun: null,
      lastResult: null,
      runCount: 0,
      ...task,
      id: task.id || this._genId(),
    };
    this.tasks.push(newTask);
    this._save();
    this.emit('task-added', newTask);
    return newTask;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;
    Object.assign(task, updates, { updatedAt: Date.now() });
    this._save();
    this.emit('task-updated', task);
    return task;
  }

  deleteTask(taskId) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;
    const [removed] = this.tasks.splice(index, 1);
    this._save();
    this.emit('task-deleted', taskId);
    return true;
  }

  toggleTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;
    task.enabled = !task.enabled;
    task.updatedAt = Date.now();
    this._save();
    this.emit('task-toggled', task);
    return task;
  }

  runTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;
    task.lastRun = Date.now();
    task.runCount++;
    this._save();
    this.emit('task-run', task);
    return task;
  }

  recordTaskResult(taskId, result) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return null;
    task.lastResult = {
      success: result.success,
      message: result.message || '',
      timestamp: Date.now(),
    };
    this._save();
    this.emit('task-result', task, result);
    return task;
  }

  getTasksByType(type) {
    return this.tasks.filter(t => t.type === type);
  }

  getEnabledTasks() {
    return this.tasks.filter(t => t.enabled);
  }

  getScheduledTasks() {
    return this.tasks.filter(t => t.enabled && t.schedule);
  }

  clearAll() {
    this.tasks = [];
    this._save();
    this.emit('tasks-cleared');
  }

  getStats() {
    return {
      total: this.tasks.length,
      enabled: this.tasks.filter(t => t.enabled).length,
      scheduled: this.tasks.filter(t => t.schedule).length,
      totalRuns: this.tasks.reduce((sum, t) => sum + (t.runCount || 0), 0),
    };
  }
}

const automationManager = new AutomationManager();

module.exports = { automationManager, AutomationManager };
