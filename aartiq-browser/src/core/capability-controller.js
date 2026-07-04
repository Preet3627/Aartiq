class CapabilityController {
  constructor(options = {}) {
    this.actions = new Map();
    this.firstTimeApprovals = new Set();
    this.permissionStore = options.permissionStore || null;
  }

  registerAction(action) {
    if (this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" is already registered.`);
    }
    this.actions.set(action.name, {
      name: action.name,
      handler: action.handler,
      requiresApproval: action.requiresApproval || 'never',
      riskLevel: action.riskLevel || 'low',
      description: action.description || '',
    });
  }

  getAction(name) {
    return this.actions.get(name);
  }

  async executeAction(name, params = {}) {
    const action = this.actions.get(name);
    if (!action) {
      return { approved: false, reason: `Action "${name}" is not registered.` };
    }

    let needsApproval = false;
    if (action.requiresApproval === 'always') {
      needsApproval = true;
    } else if (action.requiresApproval === 'first-time-per-session') {
      if (!this.firstTimeApprovals.has(name)) {
        needsApproval = true;
      }
    }

    if (needsApproval) {
      if (this.permissionStore) {
        const permKey = `CAPABILITY:${name}`;
        if (this.permissionStore.isGranted(permKey)) {
          needsApproval = false;
        }
      }
    }

    if (needsApproval) {
      return {
        approved: false,
        reason: `Action "${name}" requires user approval.`,
      };
    }

    if (action.requiresApproval === 'first-time-per-session') {
      this.firstTimeApprovals.add(name);
    }

    try {
      const result = await action.handler(params);
      return { approved: true, result };
    } catch (e) {
      return { approved: false, reason: `Action "${name}" failed: ${e.message}` };
    }
  }

  getRegisteredActions() {
    return Array.from(this.actions.values()).map(a => ({
      name: a.name,
      riskLevel: a.riskLevel,
      requiresApproval: a.requiresApproval,
      description: a.description,
    }));
  }
}

module.exports = { CapabilityController };
