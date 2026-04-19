const { exec } = require('child_process');
const { validateCommand, checkShellPermission, permissionStore, analyzeCommandRisk, explainCommand } = require('./command-validator');

async function executeShellCommand({ rawCommand, preApproved, reason, riskLevel }) {
  let command;
  try {
    command = validateCommand(rawCommand);
  } catch (e) {
    return { success: false, error: e.message };
  }

  if (!preApproved) {
    const authorized = await checkShellPermission(command, reason, riskLevel);
    if (!authorized) {
      return { success: false, error: 'User blocked the command.' };
    }
  }

  return new Promise((resolve) => {
    const execOptions = { timeout: 30000 };
    exec(command, execOptions, (error, stdout, stderr) => {
      if (process.platform === 'darwin' && !error) {
        const macosPermKey = 'MACOS_TERMINAL_PERMISSION';
        if (!permissionStore.isGranted(macosPermKey)) {
          permissionStore.grant(macosPermKey, 'execute', 'macOS Shell access', false);
        }
      }

      if (error) {
        if (error.message.includes('Operation not permitted')) {
          resolve({ success: false, error: 'Permission denied! Please go to Settings > Permissions in Comet-AI to configure macOS system permissions.', output: stderr });
        } else {
          resolve({ success: false, error: error.message, output: stderr });
        }
      } else {
        resolve({ success: true, output: stdout.trim(), error: stderr });
      }
    });
  });
}

module.exports = {
  executeShellCommand,
  validateCommand,
  analyzeCommandRisk,
  explainCommand
};