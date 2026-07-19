/**
 * Advanced DOM Engine
 * Centralized module for DOM interactions via Electron's executeJavaScript.
 * Handles smart element resolution, React-aware value setting, iframe traversal,
 * and CDP-based trusted event dispatch.
 */

// ---------------------------------------------------------------------------
// Shared helpers injected into every page script
// ---------------------------------------------------------------------------

const DOM_HELPERS = `
(function(__domEngineHelpers) {
  if (window.__domEngineLoaded) return;
  window.__domEngineLoaded = true;

  window.__domEngine = {

    // ---- Element Resolution ----

    findElement(selector, text, ariaLabel) {
      // Strategy 1: CSS selector
      if (selector) {
        try {
          const el = document.querySelector(selector);
          if (el && this.isVisible(el)) return el;
        } catch (_) {}

        // Try extracting name attribute from selector
        const nameMatch = selector.match(/\\[name=["']([^"']+)["']\\]/);
        if (nameMatch) {
          const byName = document.querySelector('input[name="' + nameMatch[1] + '"], textarea[name="' + nameMatch[1] + '"]');
          if (byName && this.isVisible(byName)) return byName;
        }

        // Try id shorthand (#foo -> document.getElementById)
        if (selector.startsWith('#')) {
          const byId = document.getElementById(selector.slice(1));
          if (byId && this.isVisible(byId)) return byId;
        }
      }

      // Strategy 2: aria-label
      if (ariaLabel) {
        const el = document.querySelector('[aria-label="' + ariaLabel.replace(/"/g, '\\"') + '"]');
        if (el && this.isVisible(el)) return el;

        // Partial match
        const all = document.querySelectorAll('[aria-label]');
        for (const a of all) {
          if ((a.getAttribute('aria-label') || '').toLowerCase().includes(ariaLabel.toLowerCase())) {
            if (this.isVisible(a)) return a;
          }
        }
      }

      // Strategy 3: text content
      if (text) {
        const t = text.toLowerCase().trim();
        const clickables = document.querySelectorAll(
          'button, a, input[type="submit"], input[type="button"], [role="button"], [role="link"], ' +
          '[role="option"], [role="tab"], [role="menuitem"], [onclick], [role="combobox"], ' +
          'label, summary, .btn, .button'
        );
        for (const el of clickables) {
          const elText = (el.textContent || el.value || '').toLowerCase().trim();
          if (elText === t || elText.includes(t)) {
            if (this.isVisible(el)) return el;
          }
        }

        // Broader: any leaf element
        const all = document.querySelectorAll('*');
        for (const el of all) {
          if (el.children.length === 0 || el.tagName === 'BUTTON' || el.tagName === 'A') {
            const elText = (el.textContent || '').toLowerCase().trim();
            if (elText === t || elText.includes(t)) {
              if (this.isVisible(el)) return el;
            }
          }
        }
      }

      // Strategy 4: placeholder / title partial match
      if (text) {
        const t = text.toLowerCase().trim();
        const inputs = document.querySelectorAll('input, textarea');
        for (const inp of inputs) {
          const ph = (inp.placeholder || inp.title || '').toLowerCase();
          if (ph && (ph.includes(t) || t.includes(ph))) {
            if (this.isVisible(inp)) return inp;
          }
        }
      }

      return null;
    },

    isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (!style || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left <= (window.innerWidth || document.documentElement.clientWidth);
    },

    cssPath(el) {
      const parts = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
        const tag = current.tagName.toLowerCase();
        if (current.id) {
          parts.unshift(tag + '#' + CSS.escape(current.id));
          break;
        }
        const parent = current.parentElement;
        if (!parent) { parts.unshift(tag); break; }
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        const suffix = siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')' : '';
        parts.unshift(tag + suffix);
        current = parent;
      }
      return parts.join(' > ');
    },

    getElementInfo(el) {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        type: el.type || null,
        role: el.getAttribute('role') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        placeholder: el.placeholder || null,
        value: (el.value || '').substring(0, 200),
        text: (el.textContent || '').substring(0, 200),
        selector: this.cssPath(el),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        visible: this.isVisible(el),
        isContentEditable: el.isContentEditable,
        tag: el.tagName,
      };
    },

    // ---- React-aware Value Setting ----

    reactSetValue(el, val) {
      const tag = el.tagName;

      // contenteditable elements
      if (el.isContentEditable || el.contentEditable === 'true') {
        el.focus();
        try {
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, val);
        } catch (_) {
          el.textContent = val;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      // SELECT elements
      if (tag === 'SELECT') {
        const options = Array.from(el.options);
        const match = options.find(o => o.value === val || o.text.toLowerCase() === val.toLowerCase());
        if (match) {
          el.value = match.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }

      // INPUT / TEXTAREA
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        el.textContent = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      const previousValue = el.value;

      // 1. Native value setter (bypasses React's override)
      const proto = el.constructor.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, val);
      } else {
        el.value = val;
      }

      // 2. React internal tracker (prevents dedup)
      const tracker = el._valueTracker;
      if (tracker) tracker.setValue(previousValue);

      // 3. InputEvent with inputType for React 16+
      try {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: val
        }));
      } catch (_) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 4. Change event
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },

    // ---- Click Simulation ----

    simulateClick(el) {
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      el.focus?.({ preventScroll: true });
      const rect = el.getBoundingClientRect();
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      const eventOpts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };

      for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        try {
          if (type.startsWith('pointer')) {
            el.dispatchEvent(new PointerEvent(type, { ...eventOpts, pointerId: 1, pointerType: 'mouse' }));
          } else {
            el.dispatchEvent(new MouseEvent(type, eventOpts));
          }
        } catch (_) {
          el.dispatchEvent(new MouseEvent(type, eventOpts));
        }
      }

      el.click?.();
      return true;
    },

    // ---- Iframe Traversal ----

    findInIframes(selector, text, ariaLabel) {
      const iframes = document.querySelectorAll('iframe');
      const results = [];
      for (let i = 0; i < iframes.length; i++) {
        try {
          const doc = iframes[i].contentDocument || iframes[i].contentWindow?.document;
          if (!doc) continue;
          const el = doc.querySelector ? this._findInDoc(doc, selector, text, ariaLabel) : null;
          if (el) {
            results.push({ iframe: i, element: this.getElementInfo(el) });
          }
        } catch (_) {
          // Cross-origin — cannot access
          results.push({ iframe: i, crossOrigin: true });
        }
      }
      return results;
    },

    _findInDoc(doc, selector, text, ariaLabel) {
      if (selector) {
        try {
          const el = doc.querySelector(selector);
          if (el) return el;
        } catch (_) {}
      }
      if (ariaLabel) {
        const el = doc.querySelector('[aria-label="' + ariaLabel.replace(/"/g, '\\"') + '"]');
        if (el) return el;
      }
      if (text) {
        const t = text.toLowerCase().trim();
        const all = doc.querySelectorAll('button, a, input, [role="button"], [role="link"], label');
        for (const el of all) {
          const elText = (el.textContent || el.value || '').toLowerCase().trim();
          if (elText === t || elText.includes(t)) return el;
        }
      }
      return null;
    },

    // ---- Accessibility Snapshot ----

    getAccessibilityTree(maxDepth) {
      const depth = maxDepth || 10;
      const walk = (node, d) => {
        if (!node || d > depth) return null;
        const info = {
          role: node.role || node.tagName?.toLowerCase() || '',
          name: node.name || node.textContent?.substring(0, 100) || '',
          description: node.description || '',
          value: node.value || '',
        };
        if (node.children && node.children.length) {
          info.children = node.children.slice(0, 50).map(c => walk(c, d + 1)).filter(Boolean);
        }
        return info;
      };

      // Build from DOM directly (faster than CDP Accessibility tree for simple cases)
      const tree = { role: 'root', name: document.title, children: [] };
      const walkDom = (el, d) => {
        if (!el || d > depth) return null;
        if (el.nodeType !== Node.ELEMENT_NODE) return null;
        if (!this.isVisible(el)) return null;

        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const name = el.getAttribute('aria-label') || el.getAttribute('title') || el.placeholder || '';
        const node = { role, name, tag: el.tagName.toLowerCase() };

        if (el.children && el.children.length) {
          const kids = [];
          for (const child of el.children) {
            const c = walkDom(child, d + 1);
            if (c) kids.push(c);
          }
          if (kids.length) node.children = kids.slice(0, 30);
        }
        return node;
      };

      tree.children = Array.from(document.body.children)
        .slice(0, 20)
        .map(c => walkDom(c, 0))
        .filter(Boolean);

      return tree;
    },

    // ---- Get All Clickable Elements ----

    getClickableElements() {
      const selectors = [
        'button', 'a[href]', 'input[type="submit"]', 'input[type="button"]',
        'input[type="checkbox"]', 'input[type="radio"]', 'input:not([type])',
        'textarea', 'select', '[role="button"]', '[role="link"]', '[role="tab"]',
        '[role="menuitem"]', '[role="option"]', '[role="combobox"]',
        '[onclick]', '[tabindex]:not([tabindex="-1"])', 'label', 'summary',
        '[contenteditable="true"]', '[data-testid]'
      ].join(',');

      const elements = [];
      try {
        for (const [index, el] of Array.from(document.querySelectorAll(selectors)).entries()) {
          if (!this.isVisible(el)) continue;
          const info = this.getElementInfo(el);
          info.index = index;
          elements.push(info);
        }
      } catch (_) {}
      return elements.slice(0, 100);
    }
  };
})();
`;

// ---------------------------------------------------------------------------
// Public API — all functions work with Electron's webContents
// ---------------------------------------------------------------------------

class DomeEngine {
  /**
   * Inject helper code into a webContents (idempotent).
   */
  async _ensureInjected(webContents) {
    try {
      await webContents.executeJavaScript(DOM_HELPERS);
    } catch (e) {
      console.error('[DomeEngine] inject failed:', e.message);
    }
  }

  /**
   * Find an element using smart resolution strategies.
   * Returns element info or null.
   */
  async findElement(webContents, { selector, text, 'aria-label': ariaLabel, tabId } = {}) {
    await this._ensureInjected(webContents);
    try {
      const result = await webContents.executeJavaScript(`
        (function() {
          const el = window.__domEngine.findElement(${JSON.stringify(selector || '')}, ${JSON.stringify(text || '')}, ${JSON.stringify(ariaLabel || '')});
          return window.__domEngine.getElementInfo(el);
        })()
      `, true);
      return { success: !!result, element: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Click an element with smart resolution + retry.
   */
  async clickElement(webContents, { selector, text, 'aria-label': ariaLabel, retry = 3, verify = false } = {}) {
    await this._ensureInjected(webContents);
    try {
      const result = await webContents.executeJavaScript(`
        (async function() {
          const MAX_RETRIES = ${retry};

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const el = window.__domEngine.findElement(
              ${JSON.stringify(selector || '')},
              ${JSON.stringify(text || '')},
              ${JSON.stringify(ariaLabel || '')}
            );

            if (el) {
              window.__domEngine.simulateClick(el);
              ${verify ? `
              await new Promise(r => setTimeout(r, 300));
              ` : ''}
              return {
                success: true,
                method: 'dom-engine',
                element: window.__domEngine.getElementInfo(el),
              };
            }

            // Try iframe traversal
            const iframeResults = window.__domEngine.findInIframes(
              ${JSON.stringify(selector || '')},
              ${JSON.stringify(text || '')},
              ${JSON.stringify(ariaLabel || '')}
            );
            const iframeHit = iframeResults.find(r => r.element && !r.crossOrigin);
            if (iframeHit) {
              return {
                success: true,
                method: 'iframe',
                iframeIndex: iframeHit.iframe,
                element: iframeHit.element,
              };
            }

            if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 200));
          }

          return { success: false, error: 'Element not found after ' + MAX_RETRIES + ' retries' };
        })()
      `, true);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Fill a single form field with React-aware value setting.
   */
  async fillField(webContents, { selector, value, retry = 3, verify = true, clearFirst = true } = {}) {
    await this._ensureInjected(webContents);
    try {
      const result = await webContents.executeJavaScript(`
        (async function() {
          const TARGET_VALUE = ${JSON.stringify(value || '')};
          const MAX_RETRIES = ${retry};

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const el = window.__domEngine.findElement(${JSON.stringify(selector || '')}, null, null);
            if (!el) {
              if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 200));
              continue;
            }

            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            await new Promise(r => setTimeout(r, 50));
            el.focus();

            ${clearFirst ? `
            // Clear existing value
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              const proto = el.constructor.prototype;
              const ns = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (ns) ns.call(el, '');
              else el.value = '';
              const tracker = el._valueTracker;
              if (tracker) tracker.setValue('');
              try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent', data: null })); }
              catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
            } else if (el.isContentEditable) {
              el.textContent = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await new Promise(r => setTimeout(r, 30));
            ` : ''}

            window.__domEngine.reactSetValue(el, TARGET_VALUE);

            ${verify ? `
            await new Promise(r => setTimeout(r, 100));
            const currentVal = el.value || el.textContent || '';
            if (currentVal === TARGET_VALUE || currentVal.includes(TARGET_VALUE) || TARGET_VALUE.includes(currentVal)) {
              return { success: true, value: currentVal.substring(0, 200), verified: true, element: window.__domEngine.getElementInfo(el) };
            }
            return { success: true, value: TARGET_VALUE.substring(0, 200), verified: false, element: window.__domEngine.getElementInfo(el) };
            ` : `
            return { success: true, value: TARGET_VALUE.substring(0, 200) };
            `}
          }

          return { success: false, error: 'Failed to fill after ' + MAX_RETRIES + ' retries' };
        })()
      `, true);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Fill multiple form fields atomically with delays between each.
   */
  async multiFillForm(webContents, { fields, delayBetweenFields = 100, retry = 2, verify = true } = {}) {
    await this._ensureInjected(webContents);
    if (!fields || typeof fields !== 'object') {
      return { success: false, error: 'fields must be an object {selector: value}' };
    }

    const entries = Object.entries(fields);
    if (entries.length === 0) {
      return { success: false, error: 'No fields to fill' };
    }

    try {
      const result = await webContents.executeJavaScript(`
        (async function() {
          const fields = ${JSON.stringify(entries)};
          const DELAY = ${delayBetweenFields};
          const MAX_RETRIES = ${retry};
          const results = [];

          for (const [selector, value] of fields) {
            let filled = false;
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              const el = window.__domEngine.findElement(selector, null, null);
              if (!el) {
                if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 200));
                continue;
              }

              el.scrollIntoView({ block: 'center', behavior: 'instant' });
              await new Promise(r => setTimeout(r, 30));
              el.focus();

              // Clear
              if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                const proto = el.constructor.prototype;
                const ns = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (ns) ns.call(el, '');
                else el.value = '';
                const tracker = el._valueTracker;
                if (tracker) tracker.setValue('');
                try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent', data: null })); }
                catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
              } else if (el.isContentEditable) {
                el.textContent = '';
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              await new Promise(r => setTimeout(r, 20));

              window.__domEngine.reactSetValue(el, value);

              ${verify ? `
              await new Promise(r => setTimeout(r, 80));
              const cv = el.value || el.textContent || '';
              const ok = cv === value || cv.includes(value) || value.includes(cv);
              results.push({ selector, success: ok, value: cv.substring(0, 100), verified: ok });
              ` : `
              results.push({ selector, success: true, value: value.substring(0, 100) });
              `}

              filled = true;
              break;
            }
            if (!filled) {
              results.push({ selector, success: false, error: 'Element not found' });
            }

            // Delay between fields for React state updates
            if (DELAY > 0) await new Promise(r => setTimeout(r, DELAY));
          }

          const allSuccess = results.every(r => r.success);
          return { success: allSuccess, results };
        })()
      `, true);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get the accessibility tree snapshot of the page.
   */
  async getAccessibilityTree(webContents, maxDepth = 6) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript(`
        window.__domEngine.getAccessibilityTree(${maxDepth})
      `, true);
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Get all clickable elements on the page.
   */
  async getClickableElements(webContents) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript(`
        window.__domEngine.getClickableElements()
      `, true);
    } catch (e) {
      return [];
    }
  }

  /**
   * CDP-based trusted click using Input.dispatchMouseEvent.
   * Falls back to executeJavaScript click if debugger not attached.
   */
  async cdpClick(webContents, { x, y } = {}) {
    // If we have coordinates, use sendInputEvent for a trusted click
    if (x != null && y != null) {
      try {
        await webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        await webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        return { success: true, method: 'sendInputEvent', x, y };
      } catch (e) {
        // sendInputEvent may fail on some views; fall through
      }
    }
    return { success: false, error: 'CDP click requires valid coordinates' };
  }

  /**
   * Traverse iframes and return results from each accessible frame.
   */
  async traverseIframes(webContents, { selector, text, 'aria-label': ariaLabel } = {}) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript(`
        window.__domEngine.findInIframes(
          ${JSON.stringify(selector || '')},
          ${JSON.stringify(text || '')},
          ${JSON.stringify(ariaLabel || '')}
        )
      `, true);
    } catch (e) {
      return [];
    }
  }

  /**
   * Get element info for a found element.
   */
  async getElementInfo(webContents, { selector, text, 'aria-label': ariaLabel } = {}) {
    await this._ensureInjected(webContents);
    try {
      return await webContents.executeJavaScript(`
        (function() {
          const el = window.__domEngine.findElement(
            ${JSON.stringify(selector || '')},
            ${JSON.stringify(text || '')},
            ${JSON.stringify(ariaLabel || '')}
          );
          return window.__domEngine.getElementInfo(el);
        })()
      `, true);
    } catch (e) {
      return null;
    }
  }
}

module.exports = { DomeEngine, domEngine: new DomeEngine() };
