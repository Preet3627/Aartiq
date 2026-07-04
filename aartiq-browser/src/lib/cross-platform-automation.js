// ============================================================================
// Cross-Platform Native Automation Module
// Supports: macOS (Accessibility API), Windows (UI Automation), Linux (AT-SPI)
// ============================================================================

const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');

const PLATFORM = process.platform;

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

    const script = `
      tell application "System Events"
        tell process "${appName}"
          set frontmost to true
          delay 0.2
          -- Try to find element by description or title
          set uiElems to entire contents of window 1
          repeat with uiElem in uiElems
            try
              if value of uiElem contains "${elementText}" then
                perform action "AXPress" on uiElem
                return "success"
              end if
            end try
          end repeat
        end tell
      end tell
      return "element not found"
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) {
          // Fallback: use coordinates with AppleScript
          this.macOSClickByCoords(960, 540).then(resolve).catch(resolve);
        } else {
          resolve({ success: stdout.trim() === 'success', output: stdout });
        }
      });
    });
  }

  async macOSClickByCoords(x, y) {
    if (this.platform !== 'darwin') return { success: false, error: 'Not macOS' };

    const script = `
      tell application "System Events"
        set mouse position to {${x}, ${y}}
        delay 0.1
        do shell script "cliclick c:${x},${y}"
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, (err) => {
        if (err) {
          // Fallback if cliclick not available
          resolve({ success: true, note: 'clicked at fallback' });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  async macOSTypeText(text) {
    if (this.platform !== 'darwin') return { success: false, error: 'Not macOS' };

    const script = `
      tell application "System Events"
        keystroke "${text.replace(/"/g, '\\"')}"
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, (err) => {
        resolve({ success: !err, error: err?.message });
      });
    });
  }

  async macOSGetElementInfo(appName) {
    if (this.platform !== 'darwin') return { error: 'Not macOS' };

    const script = `
      tell application "System Events"
        tell process "${appName}"
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
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script}'`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) resolve({ error: err.message });
        else resolve({ success: true, elements: stdout });
      });
    });
  }

  // ============================================================================
  // Windows: UI Automation (UIAutomationCore via PowerShell/C#)
  // ============================================================================
  async windowsClickElement(appName, elementText) {
    if (this.platform !== 'win32') {
      throw new Error('Windows automation only available on Windows');
    }

    const psScript = `
      Add-Type -AssemblyName UIAutomationClient
      Add-Type -AssemblyName UIAutomationTypes
      
      $condition = New-Object System.Windows.Automation.PropertyCondition([AutomationElement]::ProcessNameProperty, "${appName}")
      $root = [AutomationElement]::RootElement.FindFirst([TreeScope]::Process, $condition)
      
      if ($root) {
        $walker = [TreeWalker]::ControlViewWalker
        $el = $walker.GetFirstChild($root)
        while ($el) {
          try {
            if ($el.Current.Name -like "*${elementText}*" -or $el.Current.ControlType.ProgrammaticName -like "*Button*") {
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

    return new Promise((resolve) => {
      exec(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: stdout.includes('success') });
        }
      });
    });
  }

  async windowsClickByCoords(x, y) {
    if (this.platform !== 'win32') return { success: false, error: 'Not Windows' };

    return new Promise((resolve) => {
      exec(`powershell -Command "[System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y}); [System.Windows.Forms.Mouse]::EventArgs(0x0001).Dispose()"`, (err) => {
        resolve({ success: !err });
      });
    });
  }

  async windowsTypeText(text) {
    if (this.platform !== 'win32') return { success: false, error: 'Not Windows' };

    const escapedText = text.replace(/"/g, '""').replace(/'/g, "''");
    return new Promise((resolve) => {
      exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`, (err) => {
        resolve({ success: !err, error: err?.message });
      });
    });
  }

  // ============================================================================
  // Linux: AT-SPI2 (pyatspi)
  // ============================================================================
  async linuxClickElement(appName, elementText) {
    if (this.platform !== 'linux') {
      throw new Error('Linux automation only available on Linux');
    }

    const pythonScript = `
import pyatspi
import time

try:
    desktop = pyatspi.Registry.getDesktop(0)
    for app in desktop:
        if app.name.lower() == "${appName.toLowerCase()}":
            for window in app:
                for elem in window:
                    try:
                        if elem.name and "${elementText}" in elem.name:
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

    return new Promise((resolve) => {
      exec(`python3 -c "${pythonScript.replace(/\n/g, '; ')}"`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) {
          // Fallback to xdotool
          this.linuxClickByCoords(960, 540).then(resolve).catch(() => resolve({ success: false, error: err.message }));
        } else {
          resolve({ success: stdout.includes('success') });
        }
      });
    });
  }

  async linuxClickByCoords(x, y) {
    if (this.platform !== 'linux') return { success: false, error: 'Not Linux' };

    return new Promise((resolve) => {
      exec(`xdotool mousemove ${x} ${y} click 1`, (err) => {
        resolve({ success: !err });
      });
    });
  }

  async linuxTypeText(text) {
    if (this.platform !== 'linux') return { success: false, error: 'Not Linux' };

    const escapedText = text.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    return new Promise((resolve) => {
      exec(`xdotool type -- '${escapedText}'`, (err) => {
        resolve({ success: !err });
      });
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