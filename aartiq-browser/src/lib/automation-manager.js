const EventEmitter = require('events');

class AutomationManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = [];
  }

  getAllTasks() {
    return this.tasks;
  }

  getTask(taskId) {
    return this.tasks.find(t => t.id === taskId);
  }

  addTask(task) {
    this.tasks.push(task);
    return task;
  }

  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, updates);
      this.emit('task-updated', task);
    }
    return task;
  }

  deleteTask(taskId) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      this.emit('task-deleted', taskId);
      return true;
    }
    return false;
  }

  toggleTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.enabled = !task.enabled;
      this.emit('task-toggled', task);
      return task;
    }
    return null;
  }

  runTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      this.emit('task-run', task);
      return true;
    }
    return false;
  }
}

const automationManager = new AutomationManager();

module.exports = { automationManager, AutomationManager };
