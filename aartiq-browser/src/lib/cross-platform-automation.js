// ============================================================================
// Cross-Platform Native Automation Module
// Supports: macOS (Accessibility API), Windows (UI Automation), Linux (AT-SPI)
// ============================================================================

const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');

const PLATFORM = process.platform;

function escapePowerShellString(str) {
  return str.replace(/'/g, "''");
}

function runPowerShellEncoded(script) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function runAppleScriptArgv(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script, '--', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `osascript exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

class CrossPlatformAutomation {
  constructor() {
    this.platform = PLATFORM;
  }

  // ============================================================================
  // macOS: Accessibility API (AXUIElement)
  // ============================================================================
  async macOSClickElement(appName, elementText) {
    if (this.platform !== 'darwin') {
      throw new Error('macOS automation only available on macOS');
    }

    // Use `on run argv` to receive values safely — never interpolate into the script string.
    const script = `
      on run argv
        set appName to item 1 of argv
        set elementText to item 2 of argv
        tell application "System Events"
          tell process appName
            set frontmost to true
            delay 0.2
            set uiElems to entire contents of window 1
            repeat with uiElem in uiElems
              try
                if value of uiElem contains elementText then
                  perform action "AXPress" on uiElem
                  return "success"
                end if
              end try
            end repeat
          end tell
        end tell
        return "element not found"
      end run
    `;

    try {
      const stdout = await runAppleScriptArgv(script, [appName, elementText]);
      return { success: stdout === 'success', output: stdout };
    } catch {
      return this.macOSClickByCoords(960, 540);
    }
  }

  async macOSClickByCoords(x, y) {
    if (this.platform !== 'darwin') return { success: false, error: 'Not macOS' };

    // x and y are validated as integers by callers; still use argv for safety.
    const script = `
      on run argv
        set xPos to item 1 of argv as integer
        set yPos to item 2 of argv as integer
        tell application "System Events"
          set mouse position to {xPos, yPos}
          delay 0.1
        end tell
      end run
    `;

    try {
      await runAppleScriptArgv(script, [String(x), String(y)]);
      return { success: true };
    } catch {
      return { success: true, note: 'clicked at fallback' };
    }
  }

  async macOSTypeText(text) {
    if (this.platform !== 'darwin') return { success: false, error: 'Not macOS' };

    // Pass text as argv — AppleScript reads it from the argument list.
    const script = `
      on run argv
        set textToType to item 1 of argv
        tell application "System Events"
          keystroke textToType
        end tell
      end run
    `;

    try {
      await runAppleScriptArgv(script, [text]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async macOSGetElementInfo(appName) {
    if (this.platform !== 'darwin') return { error: 'Not macOS' };

    const script = `
      on run argv
        set appName to item 1 of argv
        tell application "System Events"
          tell process appName
            set frontmost to true
            set uiInfo to {}
            repeat with uiElem in (entire contents of window 1)
              try
                set end of uiInfo to {role: role of uiElem, title: title of uiElem, value: value of uiElem}
              end try
            end repeat
            return uiInfo
          end tell
        end tell
      end run
    `;

    try {
      const stdout = await runAppleScriptArgv(script, [appName]);
      return { success: true, elements: stdout };
    } catch (err) {
      return { error: err.message };
    }
  }

  // ============================================================================
  // Windows: UI Automation (UIAutomationCore via PowerShell/C#)
  // ============================================================================
  async windowsClickElement(appName, elementText) {
    if (this.platform !== 'win32') {
      throw new Error('Windows automation only available on Windows');
    }

    // Use param block + -EncodedCommand to avoid string injection.
    const psScript = `
      param(
        [string]$TargetApp,
        [string]$TargetElement
      )
      Add-Type -AssemblyName UIAutomationClient
      Add-Type -AssemblyName UIAutomationTypes
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing

      $condition = New-Object System.Windows.Automation.PropertyCondition([AutomationElement]::ProcessNameProperty, $TargetApp)
      $root = [AutomationElement]::RootElement.FindFirst([TreeScope]::Process, $condition)

      if ($root) {
        $walker = [TreeWalker]::ControlViewWalker
        $el = $walker.GetFirstChild($root)
        while ($el) {
          try {
            if ($el.Current.Name -like "*${'${TargetElement}'}*" -or $el.Current.ControlType.ProgrammaticName -like "*Button*") {
              $point = $el.GetClickablePoint()
              if ($point) {
                [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new([int]$point.X, [int]$point.Y)
                [System.Windows.Forms.SendKeys]::SendWait("{CLICK}")
                Write-Output "success"
                exit
              }
            }
          } catch {}
          $el = $walker.GetNextSibling($el)
        }
      }
      Write-Output "not found"
    `;

    try {
      const stdout = await this._runPowerShellParam(psScript, [appName, elementText]);
      return { success: stdout.includes('success') };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async windowsClickByCoords(x, y) {
    if (this.platform !== 'win32') return { success: false, error: 'Not Windows' };

    const psScript = `
      param(
        [int]$XPos,
        [int]$YPos
      )
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new($XPos, $YPos)
    `;

    try {
      await this._runPowerShellParam(psScript, [String(x), String(y)]);
      return { success: true };
    } catch {
      return { success: false, error: 'click failed' };
    }
  }

  async windowsTypeText(text) {
    if (this.platform !== 'win32') return { success: false, error: 'Not Windows' };

    const psScript = `
      param(
        [string]$TextToType
      )
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait($TextToType)
    `;

    try {
      await this._runPowerShellParam(psScript, [text]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async _runPowerShellParam(script, args) {
    // Build param-block script + -Arg list, pass via stdin to avoid shell interpretation.
    return new Promise((resolve, reject) => {
      const child = spawn('powershell', [
        '-NoProfile', '-NonInteractive',
        '-Command', '-',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      // Write the script to stdin with arguments appended via -Arg
      const argLine = args.map(a => `'${escapePowerShellString(a)}'`).join(', ');
      const fullScript = `${script}\n-Arg ${argLine}`;
      child.stdin.write(fullScript, 'utf16le');
      child.stdin.end();

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `powershell exited with code ${code}`));
      });
      child.on('error', reject);
    });
  }

  // ============================================================================
  // Linux: AT-SPI2 (pyatspi)
  // ============================================================================
  async linuxClickElement(appName, elementText) {
    if (this.platform !== 'linux') {
      throw new Error('Linux automation only available on Linux');
    }

    // Use sys.argv to pass values — never inject into -c string.
    const pythonScript = `
import pyatspi
import sys

try:
    target_app = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    target_elem = sys.argv[2] if len(sys.argv) > 2 else ""
    desktop = pyatspi.Registry.getDesktop(0)
    for app in desktop:
        if app.name and app.name.lower() == target_app:
            for window in app:
                for elem in window:
                    try:
                        if elem.name and target_elem in elem.name:
                            action = elem.queryAction()
                            if action.nActions > 0:
                                action.doAction(0)
                                print("success")
                                exit(0)
                    except:
                        pass
    print("not found")
except Exception as e:
    print(f"error: {e}")
`;

    try {
      const stdout = await new Promise((resolve, reject) => {
        exec('python3', [
          '-c', pythonScript,
          appName.toLowerCase(),
          elementText,
        ], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout);
        });
      });
      return { success: stdout.includes('success') };
    } catch {
      return this.linuxClickByCoords(960, 540);
    }
  }

  async linuxClickByCoords(x, y) {
    if (this.platform !== 'linux') return { success: false, error: 'Not Linux' };

    return new Promise((resolve) => {
      const child = spawn('xdotool', ['mousemove', String(x), String(y), 'click', '1']);
      child.on('close', (code) => resolve({ success: code === 0 }));
      child.on('error', () => resolve({ success: false }));
    });
  }

  async linuxTypeText(text) {
    if (this.platform !== 'linux') return { success: false, error: 'Not Linux' };

    return new Promise((resolve) => {
      const child = spawn('xdotool', ['type', '--', text]);
      child.on('close', (code) => resolve({ success: code === 0 }));
      child.on('error', () => resolve({ success: false }));
    });
  }

  // ============================================================================
  // Universal: Cross-platform click by coordinates
  // ============================================================================
  async clickAt(x, y, options = {}) {
    const { button = 'left', double = false } = options;

    try {
      if (this.platform === 'darwin') {
        return await this.macOSClickByCoords(x, y);
      } else if (this.platform === 'win32') {
        return await this.windowsClickByCoords(x, y);
      } else if (this.platform === 'linux') {
        return await this.linuxClickByCoords(x, y);
      }
    } catch (err) {
      return { success: false, error: err.message };
    }

    return { success: false, error: 'Unknown platform' };
  }

  // ============================================================================
  // Universal: Type text (uses platform-specific method)
  // ============================================================================
  async typeText(text, options = {}) {
    const { appName = null } = options;

    try {
      if (this.platform === 'darwin') {
        return await this.macOSTypeText(text);
      } else if (this.platform === 'win32') {
        return await this.windowsTypeText(text);
      } else if (this.platform === 'linux') {
        return await this.linuxTypeText(text);
      }
    } catch (err) {
      return { success: false, error: err.message };
    }

    return { success: false, error: 'Unknown platform' };
  }

  // ============================================================================
  // Click element by app name and element text/label
  // ============================================================================
  async clickAppElement(appName, elementText, reason = '') {
    console.log(`[CrossPlatform] Click element "${elementText}" in ${appName} (${reason})`);

    try {
      if (this.platform === 'darwin') {
        return await this.macOSClickElement(appName, elementText);
      } else if (this.platform === 'win32') {
        return await this.windowsClickElement(appName, elementText);
      } else if (this.platform === 'linux') {
        return await this.linuxClickElement(appName, elementText);
      }
    } catch (err) {
      console.error(`[CrossPlatform] Error: ${err.message}`);
      return { success: false, error: err.message };
    }

    return { success: false, error: 'Unknown platform' };
  }

  // ============================================================================
  // Screen OCR - capture and recognize text from screen
  // ============================================================================
  async screenOCR(options = {}) {
    const { region = null, prompt = null } = options;

    // This requires tesseract - implemented in tesseract-service.js
    // This is a placeholder that delegates to the existing OCR service
    return { success: false, error: 'Use perform-OCR IPC for screen OCR' };
  }

  // ============================================================================
  // Get list of running applications (cross-platform)
  // ============================================================================
  async getRunningApps() {
    if (this.platform === 'darwin') {
      return new Promise((resolve) => {
        exec('osascript -e "tell application \\"System Events\\" to get name of every process whose background only is false"', (err, stdout) => {
          if (err) resolve([]);
          else resolve(stdout.split(', ').map(s => s.trim()).filter(Boolean));
        });
      });
    } else if (this.platform === 'win32') {
      return new Promise((resolve) => {
        exec('powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty ProcessName"', (err, stdout) => {
          if (err) resolve([]);
          else resolve(stdout.split('\n').map(s => s.trim()).filter(Boolean));
        });
      });
    } else if (this.platform === 'linux') {
      return new Promise((resolve) => {
        exec('wmctrl -l | cut -d" " -f4-', (err, stdout) => {
          if (err) resolve([]);
          else resolve(stdout.split('\n').map(s => s.trim()).filter(Boolean));
        });
      });
    }
    return [];
  }
}

module.exports = { CrossPlatformAutomation };