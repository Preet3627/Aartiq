const { execSync, spawn } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

let isInitialized = false;
let nutJsPath = null;
let useNative = false;
let automationBinary = null;

async function initialize() {
  if (isInitialized) return true;
  
  try {
    automationBinary = path.join(__dirname, '..', '..', 'bin', 'comet-automation.exe');
    
    try {
      execSync(`where "${automationBinary}"`, { stdio: 'ignore' });
      useNative = true;
      isInitialized = true;
      console.log('[Automation/Win] Using native Windows automation binary');
      return true;
    } catch (e) {}
    
    try {
      execSync('npm list @nut-tree/nut-js', { stdio: 'ignore' });
      nutJsPath = '@nut-tree/nut-js';
      useNative = true;
      isInitialized = true;
      console.log('[Automation/Win] Using nut.js for automation');
      return true;
    } catch (e) {}
    
    try {
      execSync('npm list xa11y', { stdio: 'ignore' });
      useNative = true;
      isInitialized = true;
      console.log('[Automation/Win] Using xa11y for accessibility-based automation');
      return true;
    } catch (e) {}
    
    isInitialized = true;
    console.log('[Automation/Win] Using PowerShell fallback');
    return true;
  } catch (err) {
    console.error('[Automation/Win] Init failed:', err.message);
    isInitialized = true;
    return true;
  }
}

function moveMouse(x, y) {
  const script = `
    Add-Type -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool SetCursorPos(int X, int Y);
"@ -Name "Win32" -Namespace "Win32Functions" -PassThru | Out-Null
[Win32.Win32Functions]::SetCursorPos(${x}, ${y})
  `;
  
  try {
    execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ';')}"`, { 
      stdio: 'ignore',
      windowsHide: true 
    });
  } catch {
    execSync(`powershell -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y})"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  }
}

function click(x, y, button = 'left', double = false) {
  moveMouse(x, y);
  
  const mouseDown = button === 'right' ? 'RightDown' : (button === 'middle' ? 'MiddleDown' : 'LeftDown');
  const mouseUp = button === 'right' ? 'RightUp' : (button === 'middle' ? 'MiddleUp' : 'LeftUp');
  
  const clickCount = double ? 2 : 1;
  
  for (let i = 0; i < clickCount; i++) {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -MemberDefinition @"
[DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
[DllImport("user32.dll")]
public static extern bool SetCursorPos(int X, int Y);
private const uint MOUSEEVENTF_LEFTDOWN = 0x02;
private const uint MOUSEEVENTF_LEFTUP = 0x04;
private const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
private const uint MOUSEEVENTF_RIGHTUP = 0x10;
private const uint MOUSEEVENTF_MIDDLEDOWN = 0x20;
private const uint MOUSEEVENTF_MIDDLEUP = 0x40;
"@ -Name "Mouse" -Namespace "Win32" -PassThru | Out-Null

[Win32.Mouse]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 10
[Win32.Mouse]::mouse_event(${button === 'right' ? '0x08' : (button === 'middle' ? '0x20' : '0x02')}, 0, 0, 0, 0)
Start-Sleep -Milliseconds 10
[Win32.Mouse]::mouse_event(${button === 'right' ? '0x10' : (button === 'middle' ? '0x40' : '0x04')}, 0, 0, 0, 0)
    `;
    
    try {
      execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
        stdio: 'ignore',
        windowsHide: true
      });
    } catch {
      const pyautoguiScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x}, ${y}); Start-Sleep -Milliseconds 10; [System.Windows.Forms.SendKeys]::SendWait('{${button === 'right' ? '{RIGHT}' : '{LEFT}'}}')`;
      execSync(`powershell -ExecutionPolicy Bypass -Command "${pyautoguiScript}"`, {
        stdio: 'ignore',
        windowsHide: true
      });
    }
  }
}

function typeText(text) {
  const sanitized = text
    .replace(/'/g, "''")
    .replace(/"/g, '`"')
    .replace(/\{/g, '{{}')
    .replace(/\}/g, '{{}');
  
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Start-Sleep -Milliseconds 50
    [System.Windows.Forms.SendKeys]::SendWait("${sanitized}")
  `;
  
  try {
    execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  } catch (err) {
    console.warn('[Automation/Win] TypeText failed:', err.message);
  }
}

function keyTap(key, modifiers = []) {
  const keyMap = {
    'return': '{ENTER}',
    'enter': '{ENTER}',
    'tab': '{TAB}',
    'escape': '{ESC}',
    'esc': '{ESC}',
    'backspace': '{BACKSPACE}',
    'delete': '{DELETE}',
    'del': '{DELETE}',
    'up': '{UP}',
    'down': '{DOWN}',
    'left': '{LEFT}',
    'right': '{RIGHT}',
    'home': '{HOME}',
    'end': '{END}',
    'pageup': '{PGUP}',
    'pagedown': '{PGDN}',
    'f1': '{F1}',
    'f2': '{F2}',
    'f3': '{F3}',
    'f4': '{F4}',
    'f5': '{F5}',
    'f6': '{F6}',
    'f7': '{F7}',
    'f8': '{F8}',
    'f9': '{F9}',
    'f10': '{F10}',
    'f11': '{F11}',
    'f12': '{F12}',
    'space': ' ',
    ' ': ' '
  };
  
  const modMap = {
    'control': '^',
    'ctrl': '^',
    'alt': '%',
    'shift': '+',
    'command': '^'
  };
  
  let keyCode = keyMap[key.toLowerCase()] || key.toUpperCase();
  let modifierStr = modifiers.map(m => modMap[m.toLowerCase()] || '').join('');
  
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Start-Sleep -Milliseconds 10
    [System.Windows.Forms.SendKeys]::SendWait("${modifierStr}${keyCode}")
  `;
  
  try {
    execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  } catch (err) {
    console.warn('[Automation/Win] KeyTap failed:', err.message);
  }
}

function scroll(x, y, direction, amount = 3) {
  const scrollAmount = direction === 'up' ? -120 * amount : (direction === 'down' ? 120 * amount : 0);
  const hScrollAmount = direction === 'left' ? -120 * amount : (direction === 'right' ? 120 * amount : 0);
  
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -MemberDefinition @"
[DllImport("user32.dll")]
public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, uint dwExtraInfo);
private const uint MOUSEEVENTF_WHEEL = 0x0800;
private const uint MOUSEEVENTF_HWHEEL = 0x01000;
"@ -Name "Mouse" -Namespace "Win32" -PassThru | Out-Null
Start-Sleep -Milliseconds 10
[Win32.Mouse]::mouse_event(0x0800, 0, 0, ${scrollAmount}, 0)
  `;
  
  try {
    execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
      stdio: 'ignore',
      windowsHide: true
    });
  } catch (err) {
    console.warn('[Automation/Win] Scroll failed:', err.message);
  }
}

function getMousePos() {
  try {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $pos = [System.Windows.Forms.Cursor]::Position
      Write-Output "$($pos.X),$($pos.Y)"
    `;
    const output = execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
    const [x, y] = output.split(',').map(Number);
    return { x, y };
  } catch (err) {
    return { x: 0, y: 0 };
  }
}

async function findWindow(windowTitle) {
  const script = `
    Get-Process | Where-Object { $_.MainWindowTitle -like "*${windowTitle}*" } | Select-Object -First 1 -ExpandProperty Id
  `;
  
  try {
    const pid = execSync(`powershell -ExecutionPolicy Bypass -Command "${script}"`, {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
    return pid ? parseInt(pid) : null;
  } catch (e) {
    return null;
  }
}

async function clickElementByTitle(title) {
  const script = `
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "${title}")
    $element = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($element) {
      $invokePattern = $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $invokePattern.Invoke()
      Write-Output "success"
    }
  `;
  
  try {
    const result = execSync(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, {
      encoding: 'utf8',
      windowsHide: true
    }).trim();
    return { success: result === 'success' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  initialize,
  moveMouse,
  click,
  typeText,
  keyTap,
  scroll,
  getMousePos,
  findWindow,
  clickElementByTitle,
  backend: 'native'
};