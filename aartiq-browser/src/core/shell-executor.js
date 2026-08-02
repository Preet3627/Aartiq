const { validateCommand, checkShellPermission, permissionStore, analyzeCommandRisk, explainCommand } = require('./command-validator');

/**
 * Legacy shell-execution entry point. All execution is routed through the
 * fail-closed sandboxed pipeline in utils.execShellCommand — there is no
 * unsandboxed `exec()` path left here. The result shape matches the
 * frontend contract: { success, output, error, code, sandboxed }.
 */
async function executeShellCommand({ rawCommand, preApproved, reason, riskLevel }) {
  const { execShellCommand } = require('../main/handlers/utils');
  return execShellCommand(rawCommand, preApproved, reason, riskLevel);
}

module.exports = {
  executeShellCommand,
  validateCommand,
  checkShellPermission,
  permissionStore,
  analyzeCommandRisk,
  explainCommand,
};
