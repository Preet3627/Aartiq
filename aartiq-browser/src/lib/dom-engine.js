/**
 * Advanced DOM Engine v2
 * AX-tree-first element resolution, Playwright-style selectors,
 * element state envelope, waitForElement, and multi-strategy interaction.
 */
const SELECTOR_RE = /^(role|text|label|testid|css|placeholder|title)\s*=\s*(.+)$/i;

const DOM_HELPERS = `
(function(__e) {
  if (window.__domEngineV2) return;
  window.__domEngineV2 = {
    // ── Parse Playwright-style selectors ──
    parseSelector(input) {
      if (!input) return {};
      const m = input.trim().match(${SELECTOR_RE});
      if (m) {
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === 'role') {
          const roleMatch = val.match(/^([a-zA-Z-]+)(?:\\[([^\\]]+)\\])?$/);
          if (roleMatch) {
            const role = roleMatch[1];
            const attrs = {};
            if (roleMatch[2]) {
              roleMatch[2].split(/(?<!\\),/).forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && v.length) attrs[k.trim()] = v.join('=').trim().replace(/\\(.)/g, '$1');
              });
            }
            return { type: 'role', role, attrs };
          }
          return { type: 'role', role: val };
        }
        if (key === 'text') return { type: 'text', text: val };
        if (key === 'label') return { type: 'label', label: val };
        if (key === 'testid') return { type: 'css', css: '[data-testid="' + val.replace(/"/g, '\\"') + '"], [data-test-id="' + val.replace(/"/g, '\\"') + '"]' };
        if (key === 'placeholder') return { type: 'placeholder', placeholder: val };
        if (key === 'title') return { type: 'title', title: val };
        if (key === 'css') return { type: 'css', css: val };
      }
      if (input.startsWith('/') && input.includes('/')) return { type: 'text', text: input.replace(/^\\/(.*)\\/.*$/, '$1') };
      return { type: 'css', css: input };
    },

    // ── Element State Envelope ──
    getElementState(el) {
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = !!(style && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0 &&
        rect.width > 0 && rect.height > 0 &&
        rect.bottom >= 0 && rect.right >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth));
      return {
        visible,
        enabled: !el.disabled,
        checked: !!el.checked,
        focused: el === document.activeElement,
        disabled: !!el.disabled,
        readOnly: !!el.readOnly,
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaBusy: el.getAttribute('aria-busy') === 'true',
        ariaInvalid: el.getAttribute('aria-invalid'),
        ariaSelected: el.getAttribute('aria-selected'),
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaHidden: el.getAttribute('aria-hidden') === 'true',
        tagName: el.tagName.toLowerCase(),
        rect: rect.x != null ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      };
    },

    // ── AX Tree from Chrome's native accessibility tree ──
    async fetchNativeAXTree() {
      if (window.__domNativeAX) return window.__domNativeAX;
      try {
        const resp = await fetch('http://127.0.0.1:9222/json/version');
        if (!resp.ok) return null;
      } catch (_) {}
      try {
        const cdpRes = await new Promise((resolve, reject) => {
          const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/...');
          ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Accessibility.getFullAXTree', params: {} }));
          ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id === 1) { ws.close(); resolve(d.result); } };
          ws.onerror = reject;
          setTimeout(() => reject('timeout'), 2000);
        });
        window.__domNativeAX = cdpRes;
        return cdpRes;
      } catch (_) { return null; }
    },

    // ── Build AX tree from DOM (fast, always available) ──
    buildAXTree() {
      const walk = (node, depth) => {
        if (!node || node.nodeType !== Node.ELEMENT_NODE || depth > 8) return null;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const role = node.getAttribute('role') || this._tagRole(node);
        const state = this.getElementState(node);
        const info = {
          ref: node.__domEngineRef || (node.__domEngineRef = 'e' + Math.random().toString(36).slice(2, 8)),
          role,
          name: this._computeName(node),
          state,
          text: (node.textContent || '').trim().substring(0, 120),
          tag: node.tagName.toLowerCase(),
          type: node.type || null,
          value: node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' ? (node.value || '').substring(0, 80) : null,
          placeholder: node.placeholder || null,
          ariaLabel: node.getAttribute('aria-label') || null,
          description: node.getAttribute('aria-description') || node.getAttribute('title') || null,
          selector: this.cssPath(node),
        };
        if (node.children && node.children.length) {
          const kids = [];
          for (const c of node.children) { const w = walk(c, depth + 1); if (w) kids.push(w); }
          if (kids.length) info.children = kids.slice(0, 20);
        }
        return info;
      };
      return Array.from(document.body.children).slice(0, 15).map(c => walk(c, 0)).filter(Boolean);
    },

    _tagRole(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a' || tag === 'select' || tag === 'textarea') return tag;
      if (tag === 'input') return el.type === 'submit' || el.type === 'button' || el.type === 'checkbox' || el.type === 'radio' ? el.type : 'textbox';
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return 'heading';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'header') return 'banner';
      if (tag === 'footer') return 'contentinfo';
      if (tag === 'img') return 'img';
      if (tag === 'table') return 'table';
      return tag;
    },

    _computeName(el) {
      return el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')?.split(' ').map(id => document.getElementById(id)?.textContent).filter(Boolean).join(' ') ||
        el.getAttribute('title') || el.placeholder || (el.tagName === 'A' || el.tagName === 'BUTTON' ? (el.textContent || '').trim().substring(0, 100) : '');
    },

    // ── AX-First Element Finding ──
    findElement(selector, text, ariaLabel) {
      const parsed = selector ? this.parseSelector(selector) : {};
      const results = [];

      const collect = (nodes) => {
        for (const n of nodes) {
          let match = false;
          if (parsed.type === 'role') {
            if (n.role === parsed.role || n.role === parsed.role.toLowerCase()) {
              if (parsed.attrs) {
                match = Object.entries(parsed.attrs).every(([k, v]) => {
                  if (k === 'name' || k === 'label') return (n.name || '').toLowerCase().includes(v.toLowerCase());
                  if (k === 'checked') return (n.state?.checked) === (v === 'true');
                  if (k === 'expanded') return (n.state?.ariaExpanded) === (v === 'true' ? 'true' : 'false');
                  return (n[k] || '').toString().toLowerCase() === v.toLowerCase();
                });
              } else match = true;
            }
          } else if (parsed.type === 'text') {
            match = (n.text || n.name || '').toLowerCase().includes(parsed.text.toLowerCase());
          } else if (parsed.type === 'label') {
            const labelEl = document.querySelector('label[for="' + parsed.label.replace(/"/g, '\\"') + '"]');
            if (labelEl) {
              const inputId = labelEl.getAttribute('for');
              const input = document.getElementById(inputId);
              if (input) { const info = this._nodeToInfo(input); if (info) { info.labelledBy = parsed.label; results.push(info); } }
            }
            match = (n.ariaLabel || n.placeholder || '').toLowerCase().includes(parsed.label.toLowerCase());
          } else if (parsed.type === 'placeholder') {
            match = (n.placeholder || '').toLowerCase().includes(parsed.placeholder.toLowerCase());
          } else if (parsed.type === 'title') {
            match = (n.description || n.ariaLabel || '').toLowerCase().includes(parsed.title.toLowerCase());
          } else if (parsed.type === 'css') {
            try {
              const el = document.querySelector(parsed.css);
              if (el && this.getElementState(el)?.visible) { results.push(this._nodeToInfo(el, true)); }
            } catch (_) {}
          }
          if (match && n.ref) results.push(n);
          if (n.children) collect(n.children);
        }
      };

      const axTree = this.buildAXTree();
      collect(axTree);

      if (results.length === 0) {
        const byRole = document.querySelectorAll('[role="' + (parsed.role || '') + '"]');
        for (const el of byRole) { if (this.getElementState(el)?.visible) results.push(this._nodeToInfo(el, true)); }
      }

      return results;
    },

    _nodeToInfo(node, isEl) {
      if (isEl) {
        const state = this.getElementState(node);
        return { ref: node.__domEngineRef || (node.__domEngineRef = 'e' + Math.random().toString(36).slice(2, 8)), role: this._tagRole(node), name: this._computeName(node), state, text: (node.textContent || '').trim().substring(0, 120), tag: node.tagName.toLowerCase(), selector: this.cssPath(node), element: node };
      }
      return node;
    },

    // ── Find DOM element from AX ref ──
    resolveRef(ref) {
      if (!ref) return null;
      const all = document.querySelectorAll('*');
      for (const el of all) { if (el.__domEngineRef === ref) return el; }
      return null;
    },

    // ── waitForElement ──
    async waitForElement(selector, options) {
      const { timeout = 5000, visible = true, enabled, checked, interval = 100 } = options || {};
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const results = this.findElement(selector);
        if (results.length > 0) {
          const ref = results[0].ref;
          const el = this.resolveRef(ref);
          if (el) {
            const state = this.getElementState(el);
            if (visible && !state.visible) { await this._sleep(interval); continue; }
            if (enabled !== undefined && state.enabled !== enabled) { await this._sleep(interval); continue; }
            if (checked !== undefined && state.checked !== checked) { await this._sleep(interval); continue; }
            return { success: true, ref, element: this._nodeToInfo(el, true), state };
          }
        }
        await this._sleep(interval);
      }
      return { success: false, error: 'Element not found within ' + timeout + 'ms' };
    },

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

    // ── Click Element with state check ──
    async clickElement(selector, options) {
      const { timeout = 5000, verify = false, button = 'left', clickCount = 1 } = options || {};
      const waited = await this.waitForElement(selector, { timeout, visible: true, enabled: true });
      if (!waited.success) return waited;

      const el = this.resolveRef(waited.ref);
      if (!el) return { success: false, error: 'Element ref lost' };

      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      await this._sleep(80);
      el.focus?.({ preventScroll: true });

      const rect = el.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      const eventOpts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: button === 'right' ? 2 : 0 };

      if (clickCount > 1) eventOpts.detail = clickCount;

      const types = button === 'right'
        ? ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'contextmenu']
        : clickCount > 1
          ? Array.from({ length: clickCount }, (_, i) => ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']).flat()
          : ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];

      for (const type of types) {
        try {
          if (type.startsWith('pointer')) {
            el.dispatchEvent(new PointerEvent(type, { ...eventOpts, pointerId: 1, pointerType: 'mouse' }));
          } else {
            el.dispatchEvent(new MouseEvent(type, eventOpts));
          }
        } catch (_) { el.dispatchEvent(new MouseEvent(type, eventOpts)); }
      }

      if (button === 'left') el.click?.();

      if (verify) {
        await this._sleep(300);
        const state = this.getElementState(el);
        return { success: true, method: 'ax-click', state, element: this._nodeToInfo(el, true) };
      }

      return { success: true, method: 'ax-click', element: this._nodeToInfo(el, true) };
    },

    // ── Fill Form Field with editor support ──
    async fillField(selector, value, options) {
      const { timeout = 5000, clearFirst = true, verify = false } = options || {};
      const waited = await this.waitForElement(selector, { timeout, visible: true, enabled: true });
      if (!waited.success) return waited;

      const el = this.resolveRef(waited.ref);
      if (!el) return { success: false, error: 'Element ref lost' };

      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      await this._sleep(50);
      el.focus();

      if (clearFirst) {
        if (el.isContentEditable || el.contentEditable === 'true') {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const proto = el.constructor.prototype;
          const ns = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (ns) ns.call(el, '');
          else el.value = '';
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue('');
          try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent', data: null })); }
          catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          el.textContent = '';
        }
        await this._sleep(30);
      }

      // Detect code editors
      if (el.closest('.monaco-editor') || el.closest('.monaco-editor') !== null) {
        await this._fillMonaco(el, value);
      } else if (el.closest('.CodeMirror') || document.querySelector('.CodeMirror')) {
        await this._fillCodeMirror(el, value);
      } else if (el.isContentEditable || el.contentEditable === 'true') {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        this._reactSetValue(el, value);
      } else {
        el.textContent = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (verify) {
        await this._sleep(150);
        const currentVal = el.value ?? el.textContent ?? '';
        const ok = currentVal === value || currentVal.includes(value) || value.includes(currentVal);
        return { success: ok, value: currentVal.substring(0, 200), verified: ok, element: this._nodeToInfo(el, true) };
      }

      return { success: true, value: String(value).substring(0, 200), element: this._nodeToInfo(el, true) };
    },

    _reactSetValue(el, val) {
      const tag = el.tagName;
      if (tag === 'SELECT') {
        const opts = Array.from(el.options);
        const match = opts.find(o => o.value === val || o.text.toLowerCase() === val.toLowerCase());
        if (match) { el.value = match.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
        return;
      }
      const prev = el.value;
      const proto = el.constructor.prototype;
      const ns = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (ns) ns.call(el, val); else el.value = val;
      const tracker = el._valueTracker;
      if (tracker) tracker.setValue(prev);
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val })); }
      catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },

    async _fillMonaco(el, value) {
      try {
        const editorEl = el.closest('.monaco-editor');
        if (editorEl && window.monaco?.editor?.getModels) {
          const models = window.monaco.editor.getModels();
          for (const model of models) {
            const views = window.monaco.editor.getEditors?.() || [];
            const hasView = views.some(v => v.getModel?.() === model);
            if (hasView) { model.setValue(value); return; }
          }
        }
        const editor = editorEl?.__monacoEditor;
        if (editor) { editor.setValue(value); return; }
      } catch (_) {}
      el.textContent = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },

    async _fillCodeMirror(el, value) {
      try {
        const cm = el.closest('.CodeMirror');
        if (cm && cm.CodeMirror) { cm.CodeMirror.setValue(value); return; }
        if (window.CodeMirror?.commands?.global) {
          const cmInstance = document.querySelector('.CodeMirror')?.CodeMirror;
          if (cmInstance) { cmInstance.setValue(value); return; }
        }
      } catch (_) {}
      el.textContent = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },

    // ── Snapshot: Get all interactive elements with full state ──
    snapshot() {
      const selectors = [
        'button', 'a[href]', 'input', 'textarea', 'select',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
        '[role="option"]', '[role="combobox"]', '[role="checkbox"]', '[role="radio"]',
        '[role="switch"]', '[role="slider"]', '[role="textbox"]',
        '[onclick]', '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]', '[data-testid]',
      ].join(',');

      const elements = [];
      try {
        for (const el of document.querySelectorAll(selectors)) {
          const state = this.getElementState(el);
          if (!state || state.ariaHidden) continue;
          if (!state.visible && !el.getAttribute('aria-label') && !el.textContent?.trim()) continue;
          elements.push({
            ref: el.__domEngineRef || (el.__domEngineRef = 'e' + Math.random().toString(36).slice(2, 8)),
            role: el.getAttribute('role') || this._tagRole(el),
            name: this._computeName(el),
            state,
            text: (el.textContent || '').trim().substring(0, 100),
            tag: el.tagName.toLowerCase(),
            selector: this.cssPath(el),
          });
        }
      } catch (_) {}
      return elements;
    },

    cssPath(el) {
      const parts = [];
      let cur = el;
      while (cur && cur.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
        const tag = cur.tagName.toLowerCase();
        if (cur.id) { parts.unshift(tag + '#' + CSS.escape(cur.id)); break; }
        const p = cur.parentElement;
        if (!p) { parts.unshift(tag); break; }
        const sibs = Array.from(p.children).filter(c => c.tagName === cur.tagName);
        parts.unshift(tag + (sibs.length > 1 ? ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')' : ''));
        cur = p;
      }
      return parts.join(' > ');
    },
  };
})();
`;

class DomeEngine {
  async _ensureInjected(webContents) {
    try {
      await webContents.executeJavaScript(DOM_HELPERS);
    } catch (e) {
      console.error('[DomeEngine] inject failed:', e.message);
    }
  }

  async findElement(webContents, { selector, text, 'aria-label': ariaLabel } = {}) {
    await this._ensureInjected(webContents);
    const query = selector || text || ariaLabel;
    if (!query) return { success: false, error: 'No selector provided' };
    try {
      return await webContents.executeJavaScript(`
        (async function() {
          const results = window.__domEngineV2.findElement(${JSON.stringify(query)});
          return { success: results.length > 0, elements: results.slice(0, 10), count: results.length };
        })()
      `, true);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async waitForElement(webContents, { selector, timeout = 5000, visible = true, enabled } = {}) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript(`
        (async function() {
          return window.__domEngineV2.waitForElement(${JSON.stringify(selector)}, { timeout: ${timeout}, visible: ${!!visible}, enabled: ${enabled !== undefined ? JSON.stringify(enabled) : 'undefined'} });
        })()
      `, true);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async clickElement(webContents, { selector, text, 'aria-label': ariaLabel, timeout = 5000, verify = false, button } = {}) {
    await this._ensureInjected(webContents);
    const query = selector || text || ariaLabel;
    if (!query) return { success: false, error: 'No selector provided' };
    try {
      return await webContents.executeJavaScript(`
        (async function() {
          return window.__domEngineV2.clickElement(${JSON.stringify(query)}, { timeout: ${timeout}, verify: ${!!verify}, button: ${button ? JSON.stringify(button) : 'undefined'} });
        })()
      `, true);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async fillField(webContents, { selector, value, timeout = 5000, clearFirst = true, verify = false } = {}) {
    await this._ensureInjected(webContents);
    if (!selector) return { success: false, error: 'No selector provided' };
    try {
      return await webContents.executeJavaScript(`
        (async function() {
          return window.__domEngineV2.fillField(${JSON.stringify(selector)}, ${JSON.stringify(value || '')}, { timeout: ${timeout}, clearFirst: ${!!clearFirst}, verify: ${!!verify} });
        })()
      `, true);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async multiFillForm(webContents, { fields, delayBetweenFields = 100, timeout = 5000, verify = true } = {}) {
    await this._ensureInjected(webContents);
    if (!fields || typeof fields !== 'object') return { success: false, error: 'fields must be an object' };
    const entries = Object.entries(fields);
    if (entries.length === 0) return { success: false, error: 'No fields to fill' };
    try {
      return await webContents.executeJavaScript(`
        (async function() {
          const fields = ${JSON.stringify(entries)};
          const DELAY = ${delayBetweenFields};
          const results = [];
          for (const [sel, val] of fields) {
            const r = await window.__domEngineV2.fillField(sel, val, { timeout: ${timeout}, verify: ${!!verify} });
            results.push({ selector: sel, ...r });
            if (DELAY > 0) await new Promise(r2 => setTimeout(r2, DELAY));
          }
          return { success: results.every(r => r.success), results };
        })()
      `, true);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async snapshot(webContents) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript('window.__domEngineV2.snapshot()', true);
    } catch (e) {
      return [];
    }
  }

  async buildAXTree(webContents) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript('window.__domEngineV2.buildAXTree()', true);
    } catch (e) {
      return [];
    }
  }

  async cdpClick(webContents, { x, y } = {}) {
    if (x != null && y != null) {
      try {
        await webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        await webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        return { success: true, method: 'sendInputEvent', x, y };
      } catch (_) {}
    }
    return { success: false, error: 'CDP click requires valid coordinates' };
  }
}

module.exports = { DomeEngine, domEngine: new DomeEngine() };
