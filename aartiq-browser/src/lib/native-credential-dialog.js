const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

const HELPER_NAME = 'AartiqCredentialDialog';

function getMacHelperPaths() {
  return {
    bundledBinary: path.join(process.resourcesPath || '', 'bin', HELPER_NAME),
    localBinary: path.join(__dirname, '..', '..', 'bin', HELPER_NAME),
    swiftScript: path.join(__dirname, 'macos-credential-dialog.swift'),
  };
}

async function ensureLocalBinary(swiftScript, localBinary) {
  if (!fs.existsSync(swiftScript)) return false;
  if (swiftScript.includes('.asar') || localBinary.includes('.asar')) return false;

  const scriptStat = fs.statSync(swiftScript);
  const binaryExists = fs.existsSync(localBinary);
  const binaryIsFresh = binaryExists && fs.statSync(localBinary).mtimeMs >= scriptStat.mtimeMs;

  if (binaryIsFresh) return true;

  fs.mkdirSync(path.dirname(localBinary), { recursive: true });
  await execFileAsync('swiftc', [swiftScript, '-o', localBinary], {
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  fs.chmodSync(localBinary, 0o755);
  return true;
}

async function runProcess(command, args, timeout = 60000) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    timeout,
    maxBuffer: 1024 * 1024,
  });

  const trimmed = `${stdout || ''}`.trim();
  if (!trimmed) return { action: 'cancel', error: 'No output from dialog' };

  const lines = trimmed.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch (e) {}
  }

  return { action: 'cancel', error: 'Could not parse dialog output' };
}

async function showMacOSDialog({ domain, username, password }) {
  const { bundledBinary, localBinary, swiftScript } = getMacHelperPaths();

  let command;
  let commandArgs;

  if (fs.existsSync(bundledBinary)) {
    command = bundledBinary;
    commandArgs = ['--domain', domain, '--username', username || '', '--password', password];
  } else {
    try {
      await ensureLocalBinary(swiftScript, localBinary);
    } catch (e) {}

    if (fs.existsSync(localBinary) && !localBinary.includes('.asar')) {
      command = localBinary;
      commandArgs = ['--domain', domain, '--username', username || '', '--password', password];
    } else if (fs.existsSync(swiftScript)) {
      let scriptToRun = swiftScript;
      let tempScriptPath = null;

      if (swiftScript.includes('.asar')) {
        tempScriptPath = path.join(os.tmpdir(), `macos-credential-dialog-${Date.now()}.swift`);
        fs.writeFileSync(tempScriptPath, fs.readFileSync(swiftScript, 'utf8'));
        scriptToRun = tempScriptPath;
      }

      command = 'swift';
      commandArgs = [scriptToRun, '--domain', domain, '--username', username || '', '--password', password];

      const result = await runProcess(command, commandArgs);
      if (tempScriptPath) {
        try { fs.unlinkSync(tempScriptPath); } catch (e) {}
      }
      return result;
    } else {
      return { action: 'cancel', error: 'No macOS dialog helper available' };
    }
  }

  return runProcess(command, commandArgs);
}

async function showWindowsDialog({ domain, username, password }) {
  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Aartiq - Save Password?"
$form.Size = New-Object System.Drawing.Size(420, 240)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true
$form.FormBorderStyle = "FixedDialog"
$form.ControlBox = $false

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Get-Process -Id $pid).MainModule.FileName)
if ($icon) { $form.Icon = $icon }

$label = New-Object System.Windows.Forms.Label
$label.Text = "Save password for ${domain}?"
$label.Location = New-Object System.Drawing.Point(20, 20)
$label.Size = New-Object System.Drawing.Size(380, 20)
$label.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($label)

$userLabel = New-Object System.Windows.Forms.Label
$userLabel.Text = "Username: ${username}"
$userLabel.Location = New-Object System.Drawing.Point(20, 55)
$userLabel.Size = New-Object System.Drawing.Size(380, 20)
$form.Controls.Add($userLabel)

$passLabel = New-Object System.Windows.Forms.Label
$passLabel.Text = "Password: ${password}"
$passLabel.Location = New-Object System.Drawing.Point(20, 80)
$passLabel.Size = New-Object System.Drawing.Size(380, 20)
$form.Controls.Add($passLabel)

$saveBtn = New-Object System.Windows.Forms.Button
$saveBtn.Text = "Save Password"
$saveBtn.Location = New-Object System.Drawing.Point(30, 130)
$saveBtn.Size = New-Object System.Drawing.Size(110, 30)
$saveBtn.Add_Click({ $form.Tag = "save"; $form.Close() })
$form.Controls.Add($saveBtn)

$neverBtn = New-Object System.Windows.Forms.Button
$neverBtn.Text = "Never"
$neverBtn.Location = New-Object System.Drawing.Point(155, 130)
$neverBtn.Size = New-Object System.Drawing.Size(110, 30)
$neverBtn.Add_Click({ $form.Tag = "never"; $form.Close() })
$form.Controls.Add($neverBtn)

$cancelBtn = New-Object System.Windows.Forms.Button
$cancelBtn.Text = "Cancel"
$cancelBtn.Location = New-Object System.Drawing.Point(280, 130)
$cancelBtn.Size = New-Object System.Drawing.Size(110, 30)
$cancelBtn.Add_Click({ $form.Tag = "cancel"; $form.Close() })
$form.Controls.Add($cancelBtn)

$form.ShowDialog() | Out-Null
$action = $form.Tag
if ($action -eq "save") {
  Write-Host '{"action":"save","domain":"${domain}","username":"${username}","password":"${password}"}'
} elseif ($action -eq "never") {
  Write-Host '{"action":"never","domain":"${domain}"}'
} else {
  Write-Host '{"action":"cancel"}'
}
`;

    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-EncodedCommand', encoded], {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    const trimmed = `${stdout || ''}`.trim();
    const lastLine = trimmed.split('\n').filter(l => l.trim()).pop() || '{"action":"cancel"}';
    try {
      return JSON.parse(lastLine);
    } catch (e) {
      return { action: 'cancel' };
    }
  } catch (e) {
    return { action: 'cancel', error: e.message };
  }
}

async function showLinuxDialog({ domain, username, password }) {
  try {
    const result = execSync(
      `zenity --question --title="Aartiq - Save Password?" --text="Save password for ${domain}?\n\nUsername: ${username}\nPassword: ${password}" --ok-label="Save Password" --cancel-label="Cancel" --width=400 2>/dev/null; echo $?`,
      { timeout: 30000, encoding: 'utf8' }
    );
    const exitCode = parseInt(result.trim(), 10);
    if (exitCode === 0) {
      return { action: 'save', domain, username, password };
    }
    return { action: 'cancel' };
  } catch {
    return { action: 'cancel', error: 'zenity not available' };
  }
}

async function showCredentialDialog({ domain, username, password }) {
  if (process.platform === 'darwin') {
    return showMacOSDialog({ domain, username, password });
  }
  if (process.platform === 'win32') {
    return showWindowsDialog({ domain, username, password });
  }
  if (process.platform === 'linux') {
    return showLinuxDialog({ domain, username, password });
  }
  return { action: 'cancel', error: 'Unsupported platform' };
}

module.exports = { showCredentialDialog };
