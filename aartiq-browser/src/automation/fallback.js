let nutJs = null;
let xa11y = null;

async function initialize() {
  if (nutJs !== null || xa11y !== null) return nutJs !== null || xa11y !== null;
  
  const nutAttempts = [
    'nut.js',
    '@nut-tree/nut-js',
    '@nut-tree/bolt'
  ];
  
  for (const pkg of nutAttempts) {
    try {
      nutJs = require(pkg);
      await nutJs.init();
      console.log('[Automation/Fallback] nut.js loaded successfully');
      return true;
    } catch (e) {
      nutJs = null;
    }
  }
  
  const xa11yAttempts = [
    'xa11y'
  ];
  
  for (const pkg of xa11yAttempts) {
    try {
      xa11y = require(pkg);
      console.log('[Automation/Fallback] xa11y loaded successfully');
      return true;
    } catch (e) {
      xa11y = null;
    }
  }
  
  console.warn('[Automation/Fallback] No automation backend available');
  return false;
}

function moveMouse(x, y) {
  if (nutJs) {
    mouseMove(nutJs, x, y);
    return;
  }
  if (xa11y) {
    xa11y.mouse.move(x, y);
    return;
  }
  throw new Error('Automation not available');
}

async function mouseMove(nut, x, y) {
  await nut.mouse.move(nut.mouse.position.x, x, nut.mouse.position.y, y);
}

function click(x, y, button = 'left', double = false) {
  if (nutJs) {
    const { mouse, Button } = nutJs;
    nutJs.mouse.move(x, y);
    const btn = button === 'right' ? Button.RIGHT : (button === 'middle' ? Button.MIDDLE : Button.LEFT);
    double ? mouse.click(btn, 2) : mouse.click(btn);
    return;
  }
  if (xa11y) {
    xa11y.mouse.click(x, y, button, double ? 2 : 1);
    return;
  }
  throw new Error('Automation not available');
}

function typeText(text) {
  if (nutJs) {
    nutJs.keyboard.type(text);
    return;
  }
  if (xa11y) {
    xa11y.keyboard.type(text);
    return;
  }
  throw new Error('Automation not available');
}

function keyTap(key, modifiers = []) {
  if (nutJs) {
    nutJs.keyboard.type(key);
    return;
  }
  if (xa11y) {
    xa11y.keyboard.press(key);
    return;
  }
  throw new Error('Automation not available');
}

function scroll(x, y, direction, amount = 3) {
  if (nutJs) {
    const { ScrollDirection } = nutJs;
    const dir = direction === 'up' ? ScrollDirection.UP : (direction === 'down' ? ScrollDirection.DOWN : 
                  direction === 'left' ? ScrollDirection.LEFT : ScrollDirection.RIGHT);
    nutJs.mouse.move(x, y);
    nutJs.mouse.scroll(dir, amount);
    return;
  }
  if (xa11y) {
    xa11y.mouse.scroll(x, y, direction, amount);
    return;
  }
  throw new Error('Automation not available');
}

function getMousePos() {
  if (nutJs) {
    return nutJs.mouse.position;
  }
  if (xa11y) {
    return xa11y.mouse.position;
  }
  throw new Error('Automation not available');
}

module.exports = {
  initialize,
  moveMouse,
  click,
  typeText,
  keyTap,
  scroll,
  getMousePos,
  isAvailable() { return nutJs !== null || xa11y !== null; }
};
