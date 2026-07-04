const { BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow = null;
const openWindows = [];

function getTopWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  for (const win of openWindows) {
    if (!win.isDestroyed()) return win;
  }
  return null;
}

function sendToActiveWindow(channel, ...args) {
  const target = getTopWindow();
  if (target && !target.isDestroyed()) {
    target.webContents.send(channel, ...args);
    return target;
  }
  return null;
}

function getAllWindows() {
  const windows = [];
  if (mainWindow && !mainWindow.isDestroyed()) {
    windows.push(mainWindow);
  }
  for (const win of openWindows) {
    if (!win.isDestroyed()) {
      windows.push(win);
    }
  }
  return windows;
}

function closeAllWindows() {
  const allWins = getAllWindows();
  for (const win of allWins) {
    if (!win.isDestroyed()) {
      win.close();
    }
  }
}

function focusMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

function getWindowBounds() {
  const target = getTopWindow();
  if (target && !target.isDestroyed()) {
    return target.getBounds();
  }
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workArea;
}

function createChildWindow(parent, options = {}) {
  const child = new BrowserWindow({
    parent: parent,
    modal: options.modal !== false,
    show: false,
    ...options,
  });

  child.once('ready-to-show', () => {
    if (!child.isDestroyed()) {
      child.show();
    }
  });

  return child;
}

function destroyWindow(window) {
  if (window && !window.isDestroyed()) {
    window.destroy();
  }
}

function windowExists(window) {
  return window && !window.isDestroyed();
}

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.childWindows = new Map();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  getMainWindow() {
    return this.mainWindow;
  }

  getTopWindow() {
    return getTopWindow();
  }

  sendToActiveWindow(channel, ...args) {
    return sendToActiveWindow(channel, ...args);
  }

  getAllWindows() {
    return getAllWindows();
  }

  closeAllWindows() {
    closeAllWindows();
  }

  focusMainWindow() {
    focusMainWindow();
  }

  getWindowBounds() {
    return getWindowBounds();
  }

  createChildWindow(parent, options) {
    return createChildWindow(parent, options);
  }

  destroyWindow(window) {
    destroyWindow(window);
  }

  windowExists(window) {
    return windowExists(window);
  }

  addChildWindow(id, window) {
    this.childWindows.set(id, window);
  }

  removeChildWindow(id) {
    const win = this.childWindows.get(id);
    if (win) {
      destroyWindow(win);
      this.childWindows.delete(id);
    }
  }

  getChildWindow(id) {
    return this.childWindows.get(id);
  }

  closeAllChildWindows() {
    for (const [id, win] of this.childWindows) {
      destroyWindow(win);
    }
    this.childWindows.clear();
  }
}

const windowManager = new WindowManager();

module.exports = {
  WindowManager,
  windowManager,
  getTopWindow,
  sendToActiveWindow,
  getAllWindows,
  closeAllWindows,
  focusMainWindow,
  getWindowBounds,
  createChildWindow,
  destroyWindow,
  windowExists,
};
