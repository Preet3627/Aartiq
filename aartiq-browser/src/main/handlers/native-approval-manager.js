const { exec } = require('child_process');
const path = require('path');
const os = require('os');

class NativeApprovalManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  async requestNativeApproval(toolName, args, risk, requestId) {
    const platform = os.platform();

    if (platform === 'darwin') {
      return this._macOSApproval(toolName, args, risk, requestId);
    } else if (platform === 'win32') {
      return this._windowsApproval(toolName, args, risk, requestId);
    } else {
      return this._linuxApproval(toolName, args, risk, requestId);
    }
  }

  _macOSApproval(toolName, args, risk, requestId) {
    return new Promise((resolve) => {
      const { dialog } = require('electron');

      const isHighRisk = risk === 'high';
      const buttons = isHighRisk
        ? ['Deny', 'Approve with Touch ID']
        : ['Deny', 'Approve'];

      const type = isHighRisk ? 'warning' : 'question';
      const detail = typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args || '');

      const message = isHighRisk
        ? 'Destructive command detected. This can permanently modify or destroy data.'
        : `Claude Desktop wants to use: ${toolName}`;

      dialog.showMessageBox(this.mainWindow, {
        type,
        title: 'Aartiq - MCP Tool Approval',
        message,
        detail: `Tool: ${toolName}\n\nArguments:\n${detail.substring(0, 1000)}\n\nSource: Claude Desktop via MCP`,
        buttons,
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      }).then(({ response }) => {
        resolve({ approved: response === 1 });
      }).catch(() => {
        resolve({ approved: false });
      });
    });
  }

  _windowsApproval(toolName, args, risk, requestId) {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'native-approval-dialog.ps1');
      const argsStr = typeof args === 'object' ? JSON.stringify(args) : String(args || '');

      const psCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -ToolName "${toolName.replace(/"/g, '""')}" -Risk "${risk}" -Args "${argsStr.replace(/"/g, '""').replace(/\n/g, ' ')}" -RequestId "${requestId}"`;

      exec(psCommand, { timeout: 120000 }, (error, stdout) => {
        if (error) {
          resolve({ approved: false });
          return;
        }
        try {
          const result = JSON.parse(stdout.trim());
          resolve({ approved: !!result.approved });
        } catch {
          resolve({ approved: false });
        }
      });
    });
  }

  _linuxApproval(toolName, args, risk, requestId) {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'native-approval-dialog.sh');
      const argsStr = typeof args === 'object' ? JSON.stringify(args) : String(args || '');

      const cmd = `bash "${scriptPath}" --tool "${toolName.replace(/"/g, '\\"')}" --risk "${risk}" --args "${argsStr.replace(/"/g, '\\"').replace(/\n/g, ' ')}" --request-id "${requestId}"`;

      exec(cmd, { timeout: 120000 }, (error, stdout) => {
        if (error) {
          resolve({ approved: false });
          return;
        }
        try {
          const lastLine = stdout.trim().split('\n').pop();
          const result = JSON.parse(lastLine);
          resolve({ approved: result.approved === true });
        } catch {
          resolve({ approved: false });
        }
      });
    });
  }
}

module.exports = { NativeApprovalManager };
