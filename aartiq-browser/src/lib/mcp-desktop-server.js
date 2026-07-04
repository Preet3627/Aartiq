const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const APPROVED_DIRS = [
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Desktop'),
];

function assertApprovedPath(filePath) {
  const resolved = path.resolve(filePath);
  const ok = APPROVED_DIRS.some(d => resolved.startsWith(d));
  if (!ok) throw new Error(`Path not in approved directories: ${resolved}`);
  if (resolved.includes('..')) throw new Error('Path traversal not allowed');
}

class FileSystemMcpServer {
  constructor(permissionStore) {
    this.perms = permissionStore;
  }

  async readFile(filePath) {
    assertApprovedPath(filePath);
    if (!this.perms.isGranted('filesystem')) {
      throw new Error('FileSystem permission not granted');
    }
    const content = await fsPromises.readFile(filePath, 'utf-8');
    this.perms.logAudit(`mcp.filesystem.read: ${filePath}`);
    return content.slice(0, 32000);
  }

  async writeFile(filePath, content) {
    assertApprovedPath(filePath);
    if (!this.perms.isGranted('filesystem')) {
      throw new Error('FileSystem permission not granted');
    }
    if (!this.perms.isGranted('filesystem-write')) {
      throw new Error('FileSystem write permission not granted');
    }
    await fsPromises.writeFile(filePath, content, 'utf-8');
    this.perms.logAudit(`mcp.filesystem.write: ${filePath}`);
    return `Written: ${filePath}`;
  }

  async listDir(dirPath) {
    assertApprovedPath(dirPath);
    if (!this.perms.isGranted('filesystem')) {
      throw new Error('FileSystem permission not granted');
    }
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    this.perms.logAudit(`mcp.filesystem.list: ${dirPath}`);
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
  }

  getApprovedDirs() {
    return APPROVED_DIRS.filter(d => fs.existsSync(d));
  }
}

const ALLOWED_APPS = ['Safari', 'Notes', 'Calendar', 'Mail', 'Finder', 'Terminal', 'Calculator', 'Notepad', 'Explorer'];

class NativeAppMcpServer {
  constructor(permissionStore) {
    this.perms = permissionStore;
  }

  async runAppleScript(script) {
    if (process.platform !== 'darwin') {
      throw new Error('AppleScript only available on macOS');
    }
    if (!this.perms.isGranted('native-app')) {
      throw new Error('NativeApp permission not granted');
    }

    const hasAllowed = ALLOWED_APPS.some(app =>
      script.toLowerCase().includes(app.toLowerCase())
    );
    if (!hasAllowed) {
      throw new Error(`AppleScript: no allowed app target in script. Allowed: ${ALLOWED_APPS.join(', ')}`);
    }

    this.perms.logAudit(`mcp.nativeapp.applescript: ${script.slice(0, 100)}`);
    const escaped = script.replace(/'/g, "\\'");
    const { stdout } = await execAsync(`osascript -e '${escaped}'`);
    return stdout.trim();
  }

  async runPowerShell(script) {
    if (process.platform !== 'win32') {
      throw new Error('PowerShell only available on Windows');
    }
    if (!this.perms.isGranted('native-app')) {
      throw new Error('NativeApp permission not granted');
    }
    if (script.length > 2000) {
      throw new Error('PowerShell script too long (max 2000 chars)');
    }

    const dangerous = ['Remove-Item', 'Format-', 'Stop-Process', 'Restart-Computer', 'rm -rf', 'del /'];
    for (const d of dangerous) {
      if (script.toLowerCase().includes(d.toLowerCase())) {
        throw new Error(`PowerShell: blocked dangerous command: ${d}`);
      }
    }

    this.perms.logAudit(`mcp.nativeapp.powershell: ${script.slice(0, 100)}`);
    const escaped = script.replace(/"/g, '\\"');
    const { stdout } = await execAsync(`powershell -Command "${escaped}"`);
    return stdout.trim();
  }

  async getActiveWindow() {
    if (process.platform === 'darwin') {
      try {
        const { stdout } = await execAsync(
          `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
        );
        return { app: stdout.trim(), platform: 'darwin' };
      } catch (e) {
        return { error: e.message, platform: 'darwin' };
      }
    } else if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync(
          `powershell -Command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).MainWindowTitle"`
        );
        return { window: stdout.trim(), platform: 'win32' };
      } catch (e) {
        return { error: e.message, platform: 'win32' };
      }
    }
    return { error: 'Unsupported platform', platform: process.platform };
  }
}

module.exports = { FileSystemMcpServer, NativeAppMcpServer, APPROVED_DIRS };
