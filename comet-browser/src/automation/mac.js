const { execSync, spawn, exec } = require('child_process');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

let isInitialized = false;
let useNative = false;
let stevePath = null;
let automationBinary = null;

async function initialize() {
  if (isInitialized) return true;
  
  try {
    automationBinary = path.join(__dirname, '..', '..', 'bin', 'comet-automation');
    
    try {
      execSync(`test -x "${automationBinary}"`, { stdio: 'ignore' });
      useNative = true;
      isInitialized = true;
      console.log('[Automation/macOS] Using native Comet automation binary');
      return true;
    } catch (e) {}
    
    try {
      execSync('which steve', { stdio: 'ignore' });
      stevePath = 'steve';
      useNative = true;
      isInitialized = true;
      console.log('[Automation/macOS] Using steve CLI for accessibility-based clicking');
      return true;
    } catch (e) {}
    
    try {
      execSync(`test -x "${path.join(__dirname, '..', '..', 'bin', 'steve')}"`, { stdio: 'ignore' });
      stevePath = path.join(__dirname, '..', '..', 'bin', 'steve');
      useNative = true;
      isInitialized = true;
      console.log('[Automation/macOS] Using bundled steve CLI');
      return true;
    } catch (e) {}
    
    try {
      execSync('xattr -c /Applications/Safari.app 2>/dev/null || true', { stdio: 'ignore' });
    } catch (e) {}
    
    isInitialized = true;
    console.log('[Automation/macOS] Using AppleScript fallback for clicking');
    return true;
  } catch (err) {
    console.error('[Automation/macOS] Init failed:', err.message);
    isInitialized = true;
    return true;
  }
}

function moveMouse(x, y) {
  if (stevePath) {
    try {
      execSync(`${stevePath} move ${x} ${y}`, { stdio: 'ignore' });
      return;
    } catch (e) {}
  }
  
  const script = `
    tell application "System Events"
      set the position of the mouse to {${x}, ${y}}
    end tell
  `;
  execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
}

function click(x, y, button = 'left', double = false) {
  if (stevePath) {
    const btn = button === 'right' ? 'right' : (button === 'middle' ? 'middle' : 'left');
    const count = double ? '2' : '1';
    try {
      execSync(`${stevePath} click ${btn}${count} ${x} ${y}`, { stdio: 'ignore' });
      return;
    } catch (e) {}
  }
  
  moveMouse(x, y);
  
  if (button === 'left') {
    const script = double
      ? `tell application "System Events" to click at {${x}, ${y}}`
      : `tell application "System Events" to click at {${x}, ${y}}`;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  } else if (button === 'right') {
    const script = `tell application "System Events" to click at {${x}, ${y}}`;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  } else if (button === 'middle') {
    moveMouse(x, y);
    execSync('cliclick m:down && sleep 0.05 && cliclick m:up', { stdio: 'ignore' });
  }
}

function typeText(text) {
  const sanitized = text
    .replace(/'/g, "'\"'\"'")
    .replace(/\n/g, '" & return & "');
  
  const script = `
    tell application "System Events"
      keystroke "${sanitized}"
    end tell
  `;
  execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
}

function keyTap(key, modifiers = []) {
  const modMap = {
    'command': 'command down',
    'control': 'control down',
    'alt': 'option down',
    'shift': 'shift down',
    'control': 'control down',
    'meta': 'command down'
  };
  
  const mods = modifiers.map(m => modMap[m] || `${m} down`).join(' ');
  const keyUpper = key.charAt(0).toUpperCase() + key.slice(1);
  
  let code;
  const keyCodes = {
    'return': 'return',
    'enter': 'return',
    'tab': 'tab',
    'space': ' ',
    'delete': 'delete',
    'escape': 'escape',
    'escape': 'escape',
    'up': 'up arrow',
    'down': 'down arrow',
    'left': 'left arrow',
    'right': 'right arrow',
    'home': 'home',
    'end': 'end',
    'pageup': 'page up',
    'pagedown': 'page down',
    'f1': 'f1',
    'f2': 'f2',
    'f3': 'f3',
    'f4': 'f4',
    'f5': 'f5',
    'f6': 'f6',
    'f7': 'f7',
    'f8': 'f8',
    'f9': 'f9',
    'f10': 'f10',
    'f11': 'f11',
    'f12': 'f12'
  };
  
  code = keyCodes[key.toLowerCase()] || keyUpper;
  
  if (mods && code) {
    const script = `
      tell application "System Events"
        keystroke "${code}" using {${mods}}
      end tell
    `;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  } else if (code) {
    const script = `
      tell application "System Events"
        keystroke "${code}"
      end tell
    `;
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  }
}

function scroll(x, y, direction, amount = 3) {
  const directions = {
    'up': '{0, -' + amount * 100 + '}',
    'down': '{0, ' + amount * 100 + '}',
    'left': '{-' + amount * 100 + ', 0}',
    'right': '{' + amount * 100 + ', 0}'
  };
  
  const delta = directions[direction] || '{0, -100}';
  
  moveMouse(x, y);
  
  const script = `
    tell application "System Events"
      set the scroll direction of window 1 to ${delta}
    end tell
  `;
  execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
}

function getMousePos() {
  try {
    const output = execSync('cliclick p', { encoding: 'utf8' }).trim();
    const [x, y] = output.split(',').map(Number);
    return { x, y };
  } catch (e) {
    try {
      const output = execSync('osascript -e \'tell application "System Events" to get {position of mouse}\'', { encoding: 'utf8' }).trim();
      const [y, x] = output.split(', ').map(Number);
      return { x, y };
    } catch (e2) {
      return { x: 0, y: 0 };
    }
  }
}

async function findElement(accessibilityLabel, options = {}) {
  if (!stevePath) return null;
  
  try {
    const output = execSync(`steve find "${accessibilityLabel}" --json`, { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

async function clickElement(accessibilityLabel) {
  if (!stevePath) return { success: false, error: 'steve not available' };
  
  try {
    execSync(`steve click --title "${accessibilityLabel}"`, { stdio: 'ignore' });
    return { success: true };
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
  findElement,
  clickElement,
  backend: 'native'
};