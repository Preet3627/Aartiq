function extractPageElementsCode() {
  return `
(function() {
  const results = [];
  const selectors = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=image]), textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]';
  const elements = document.querySelectorAll(selectors);
  let idx = 0;
  for (const el of elements) {
    if (el.disabled || el.offsetParent === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const id = el.id ? CSS.escape(el.id) : '';
    let selector = '';
    if (el.name) {
      selector = el.tagName.toLowerCase() + '[name="' + el.name.replace(/"/g, '\\\\"') + '"]';
    } else if (id) {
      selector = '#' + id;
    } else {
      selector = '__vessel_idx:' + idx;
    }
    let label = '';
    if (id) {
      const lbl = document.querySelector('label[for="' + id + '"]');
      if (lbl) label = lbl.textContent;
    }
    if (!label) {
      const parent = el.closest('label');
      if (parent) {
        const clone = parent.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(function(i) { i.remove(); });
        label = clone.textContent;
      }
    }
    if (!label) label = el.getAttribute('aria-label') || '';
    if (!label) {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        var ref = document.getElementById(labelledBy);
        if (ref) label = ref.textContent;
      }
    }
    var ac = el.getAttribute('autocomplete') || '';
    results.push({
      index: idx,
      selector: selector,
      name: el.name || '',
      type: el.type || '',
      placeholder: el.placeholder || '',
      autocomplete: ac,
      label: (label || '').trim().substring(0, 100),
      disabled: false,
      tagName: el.tagName,
    });
    idx++;
  }
  return JSON.stringify(results);
})();
`;
}

function fillFormCode(matches) {
  return `
(function() {
  const matches = ${JSON.stringify(matches)};
  let filled = 0;
  let skipped = 0;
  const details = [];
  function setValue(el, val) {
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      var proto = el.constructor.prototype;
      var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (nativeSetter && nativeSetter.set) nativeSetter.set.call(el, val);
      else el.value = val;
      try {
        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
      } catch(e) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    } else if (tag === 'SELECT') {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function findElement(match) {
    if (match.selector && !match.selector.startsWith('__vessel_idx:')) {
      try {
        var el = document.querySelector(match.selector);
        if (el) return el;
      } catch(e) {}
    }
    var all = document.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]');
    var matchIdx = 0;
    var found = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].disabled || all[i].offsetParent === null) continue;
      var r = all[i].getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (matchIdx === match.fieldIndex) { found = all[i]; break; }
      matchIdx++;
    }
    return found;
  }
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var el = findElement(m);
    if (el) {
      setValue(el, m.value);
      filled++;
      details.push({ label: m.matchedBy, value: m.value, result: 'Filled' });
    } else {
      skipped++;
      details.push({ label: m.matchedBy, value: m.value, result: 'Skipped - element not found' });
    }
  }
  return JSON.stringify({ filled: filled, skipped: skipped, details: details });
})();
`;
}

module.exports = { extractPageElementsCode, fillFormCode };
