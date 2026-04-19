const { dialog, shell, clipboard, nativeTheme, session } = require('electron');
const path = require('path');
const os = require('os');

class PermissionStore {
  constructor() {
    this.permissions = new Map();
    this.auditLog = [];
    this.autoApprovedCommands = new Set();
    this.autoApprovedActions = new Set();
  }

  grant(key, level = 'session', description = '', sessionOnly = true) {
    this.permissions.set(key, {
      level,
      description,
      grantedAt: Date.now(),
      sessionOnly
    });
    this.auditLog.push({ action: 'grant', key, level, timestamp: Date.now() });
  }

  revoke(key) {
    this.permissions.delete(key);
    this.auditLog.push({ action: 'revoke', key, timestamp: Date.now() });
  }

  revokeAll() {
    this.permissions.clear();
    this.auditLog.push({ action: 'revoke-all', timestamp: Date.now() });
  }

  isGranted(key) {
    return this.permissions.has(key);
  }

  getLevel(key) {
    return this.permissions.get(key)?.level || null;
  }

  getAll() {
    return Object.fromEntries(this.permissions);
  }

  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  setAutoCommand(command, enabled) {
    if (enabled) {
      this.autoApprovedCommands.add(command);
    } else {
      this.autoApprovedCommands.delete(command);
    }
  }

  setAutoAction(actionType, enabled) {
    if (enabled) {
      this.autoApprovedActions.add(actionType);
    } else {
      this.autoApprovedActions.delete(actionType);
    }
  }

  getAutoApprovedCommands() {
    return Array.from(this.autoApprovedCommands);
  }

  getAutoApprovedActions() {
    return Array.from(this.autoApprovedActions);
  }
}

module.exports = { PermissionStore };