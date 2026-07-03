function normalizeTarget(value) {
  return String(value || '').trim();
}

function buildClickScript(targetText, options = {}) {
  const target = JSON.stringify(normalizeTarget(targetText));
  const forceIndex = Number.isInteger(options.forceIndex) ? String(options.forceIndex) : 'null';
  const threshold = Number.isFinite(options.threshold) ? Number(options.threshold) : 0.62;
  const shouldClick = options.click === true ? 'true' : 'false';

  return `
(() => {
  const targetText = ${target};
  const forceIndex = ${forceIndex};
  const threshold = ${threshold};
  const shouldClick = ${shouldClick};

  const normalize = (value) => String(value || '')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();

  const getRole = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit.toLowerCase();
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (['checkbox', 'radio', 'range'].includes(type)) return type;
      return 'textbox';
    }
    return tag;
  };

  const getLabels = (el) => {
    const labels = [];
    if (el.labels) {
      for (const label of el.labels) labels.push(label.innerText || label.textContent || '');
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      for (const id of labelledBy.split(/\\s+/)) {
        const label = document.getElementById(id);
        if (label) labels.push(label.innerText || label.textContent || '');
      }
    }
    return labels;
  };

  const getNameParts = (el) => [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('alt'),
    el.getAttribute('name'),
    el.getAttribute('placeholder'),
    el.value,
    ...getLabels(el),
    el.innerText,
    el.textContent,
  ].filter(Boolean);

  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    if (!style || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0 &&
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth);
  };

  const cssPath = (el) => {
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(tag + '#' + CSS.escape(current.id));
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const suffix = siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')' : '';
      parts.unshift(tag + suffix);
      current = parent;
    }
    return parts.join(' > ');
  };

  const scoreText = (target, candidate, role) => {
    const targetNorm = normalize(target);
    const textNorm = normalize(candidate);
    if (!targetNorm || !textNorm) return 0;
    let score = 0;
    if (targetNorm === textNorm) score = 1.25;
    else if (textNorm.startsWith(targetNorm)) score = 1.0;
    else if (textNorm.includes(targetNorm)) score = 0.9;
    else if (targetNorm.includes(textNorm)) score = Math.max(score, 0.72);

    const targetTokens = targetNorm.split(' ').filter(Boolean);
    const textTokens = textNorm.split(' ').filter(Boolean);
    if (targetTokens.length && textTokens.length) {
      const overlap = targetTokens.filter((token) => textTokens.includes(token)).length;
      score = Math.max(score, (overlap / Math.max(targetTokens.length, textTokens.length)) * 0.82);
    }

    if (/button|link|menuitem|tab|checkbox|radio|combobox|textbox/.test(role)) {
      score += 0.06;
    }
    return score;
  };

  const selectors = [
    'button',
    'a[href]',
    'input',
    'textarea',
    'select',
    'summary',
    'label',
    '[role]',
    '[aria-label]',
    '[title]',
    '[onclick]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(',');

  const clickElement = (el) => {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    el.focus?.({ preventScroll: true });
    const rect = el.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width / 2);
    const clientY = Math.round(rect.top + rect.height / 2);
    for (const type of ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        button: 0,
      }));
    }
    el.click?.();
  };

  const records = [];
  let selectorMatch = null;
  try {
    selectorMatch = targetText ? document.querySelector(targetText) : null;
  } catch (_) {
    selectorMatch = null;
  }

  if (selectorMatch && isVisible(selectorMatch)) {
    records.push({
      el: selectorMatch,
      score: 1.4,
      method: 'selector',
      text: getNameParts(selectorMatch).join(' ').replace(/\\s+/g, ' ').trim(),
      role: getRole(selectorMatch),
    });
  }

  for (const [index, el] of Array.from(document.querySelectorAll(selectors)).entries()) {
    if (!isVisible(el)) continue;
    const role = getRole(el);
    const text = getNameParts(el).join(' ').replace(/\\s+/g, ' ').trim();
    const score = scoreText(targetText, text, role);
    if (score <= 0) continue;
    records.push({ el, index, score, method: 'text', text, role });
  }

  records.sort((a, b) => b.score - a.score);
  const chosen = Number.isInteger(forceIndex)
    ? records.find((record) => record.index === forceIndex)
    : records[0];

  const candidates = records.slice(0, 40).map((record) => {
    const rect = record.el.getBoundingClientRect();
    return {
      index: record.index,
      score: Number(record.score.toFixed(3)),
      text: record.text,
      role: record.role,
      tag: record.el.tagName.toLowerCase(),
      selector: cssPath(record.el),
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      method: record.method,
    };
  });

  if (!chosen || (!Number.isInteger(forceIndex) && chosen.score < threshold)) {
    return { success: false, reason: 'no-dom-match', candidates };
  }

  if (shouldClick) {
    clickElement(chosen.el);
  }

  const rect = chosen.el.getBoundingClientRect();
  return {
    success: true,
    method: chosen.method === 'selector' ? 'dom-selector' : 'dom-accessible-text',
    clickedText: chosen.text,
    role: chosen.role,
    selector: cssPath(chosen.el),
    score: Number(chosen.score.toFixed(3)),
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
    candidates,
  };
})()
`;
}

async function inspectClickableTargets(webContents, targetText) {
  return webContents.executeJavaScript(buildClickScript(targetText, { click: false }), true);
}

async function clickTargetInWebContents(webContents, targetText, options = {}) {
  return webContents.executeJavaScript(buildClickScript(targetText, {
    click: true,
    forceIndex: options.forceIndex,
    threshold: options.threshold,
  }), true);
}

async function resolveAndClickWithAi(webContents, targetText, aiEngine) {
  const inspected = await inspectClickableTargets(webContents, targetText);
  if (inspected?.success) {
    return clickTargetInWebContents(webContents, targetText, { threshold: inspected.score });
  }

  const candidates = inspected?.candidates || [];
  if (!aiEngine || candidates.length === 0) {
    return inspected || { success: false, reason: 'no-dom-match', candidates: [] };
  }

  const candidateList = candidates
    .slice(0, 30)
    .map((candidate, position) => `[${position}] index=${candidate.index} role=${candidate.role} text="${candidate.text}" selector=${candidate.selector}`)
    .join('\n');

  const response = await aiEngine.chat({
    model: 'llama-3.1-8b-instant',
    systemPrompt: 'You choose the best clickable DOM target. Respond with ONLY {"position":N} or {"position":-1}.',
    message: `User target: "${targetText}"\nClickable candidates:\n${candidateList}`,
  });

  const cleaned = String(response || '').replace(/```json|```/g, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const match = cleaned.match(/\{[\s\S]*"position"\s*:\s*(-?\d+)[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }

  const position = Number(parsed?.position);
  if (!Number.isInteger(position) || position < 0 || position >= candidates.length) {
    return { success: false, reason: 'ai-no-dom-match', candidates };
  }

  const chosen = candidates[position];
  const result = await clickTargetInWebContents(webContents, targetText, { forceIndex: chosen.index });
  return {
    ...result,
    method: result.success ? 'dom-ai-resolved' : result.method,
    aiSelectedText: chosen.text,
  };
}

module.exports = {
  inspectClickableTargets,
  clickTargetInWebContents,
  resolveAndClickWithAi,
};
