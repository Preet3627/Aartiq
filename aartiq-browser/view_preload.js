const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  try {
    Object.defineProperties(window, {
      top: { value: window, writable: false, configurable: false },
      parent: { value: window, writable: false, configurable: false },
      opener: { value: window, writable: false, configurable: false },
    });
    Object.defineProperty(document, 'referrer', { value: '', writable: false, configurable: false });
  } catch (e) {}
});

contextBridge.exposeInMainWorld('__view_api__', {
  getURL: () => window.location.href,
});
