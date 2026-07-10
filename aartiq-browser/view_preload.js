const { contextBridge, ipcRenderer } = require('electron');

// ─── Field Classification ─────────────────────────────────────────────────────

const FIELD_PATTERNS = {
  email: [
    { attr: 'type', value: 'email' },
    { attr: 'autocomplete', value: 'email' },
    { attr: 'name', test: /^e-?mail$/i },
    { attr: 'id', test: /e-?mail/i },
    { attr: 'name', test: /e-?mail/i },
    { attr: 'placeholder', test: /e-?mail/i },
    { attr: 'autocomplete', value: 'username' },
  ],
  username: [
    { attr: 'autocomplete', value: 'username' },
    { attr: 'name', test: /^user(name)?$/i },
    { attr: 'id', test: /user(name)?/i },
    { attr: 'name', test: /login/i },
    { attr: 'id', test: /login/i },
    { attr: 'placeholder', test: /user(name)?|login/i },
  ],
  password: [
    { attr: 'type', value: 'password' },
    { attr: 'autocomplete', value: 'current-password' },
    { attr: 'autocomplete', value: 'new-password' },
  ],
  confirmPassword: [
    { attr: 'autocomplete', value: 'new-password' },
    { attr: 'name', test: /confirm|again|repeat/i },
    { attr: 'id', test: /confirm|again|repeat/i },
    { attr: 'placeholder', test: /confirm|again|repeat/i },
  ],
  ccNumber: [
    { attr: 'autocomplete', value: 'cc-number' },
    { attr: 'name', test: /cc.?number|card.?number|card.?no|cc.?no|credit.?card/i },
    { attr: 'id', test: /cc.?number|card.?number|card.?no|cc.?no|credit.?card/i },
    { attr: 'placeholder', test: /card|credit/i },
    { attr: 'name', test: /cardnum/i },
  ],
  ccName: [
    { attr: 'autocomplete', value: 'cc-name' },
    { attr: 'name', test: /cc.?name|card.?name|name.?on.?card|holder/i },
    { attr: 'id', test: /cc.?name|card.?name|holder/i },
  ],
  ccExpiry: [
    { attr: 'autocomplete', value: 'cc-exp' },
    { attr: 'name', test: /cc.?exp|card.?exp|expiry|expir|exp\.?date/i },
    { attr: 'id', test: /cc.?exp|card.?exp|expiry|expir|exp\.?date/i },
    { attr: 'placeholder', test: /mm\s*\/\s*yy|mm\s*yy|exp/i },
  ],
  ccExpMonth: [
    { attr: 'autocomplete', value: 'cc-exp-month' },
    { attr: 'name', test: /exp.?month|cc.?month/i },
    { attr: 'id', test: /exp.?month|cc.?month/i },
  ],
  ccExpYear: [
    { attr: 'autocomplete', value: 'cc-exp-year' },
    { attr: 'name', test: /exp.?year|cc.?year/i },
    { attr: 'id', test: /exp.?year|cc.?year/i },
  ],
  ccCVC: [
    { attr: 'autocomplete', value: 'cc-csc' },
    { attr: 'autocomplete', value: 'cc-cvc' },
    { attr: 'name', test: /cvc|cvv|csc|security.?code|ccv/i },
    { attr: 'id', test: /cvc|cvv|csc|security.?code|ccv/i },
    { attr: 'placeholder', test: /cvc|cvv|csc|security/i },
  ],
  ccType: [
    { attr: 'autocomplete', value: 'cc-type' },
    { attr: 'name', test: /card.?type|cc.?type|card.?brand/i },
    { attr: 'id', test: /card.?type|cc.?type|card.?brand/i },
  ],
  givenName: [
    { attr: 'autocomplete', value: 'given-name' },
    { attr: 'autocomplete', value: 'cc-given-name' },
    { attr: 'name', test: /^f(irst)?name|given.?name/i },
    { attr: 'id', test: /^f(irst)?name|given.?name/i },
  ],
  familyName: [
    { attr: 'autocomplete', value: 'family-name' },
    { attr: 'autocomplete', value: 'cc-family-name' },
    { attr: 'name', test: /^l(ast)?name|surname|family.?name/i },
    { attr: 'id', test: /^l(ast)?name|surname|family.?name/i },
  ],
  fullName: [
    { attr: 'autocomplete', value: 'name' },
    { attr: 'name', test: /^name|full.?name/i },
    { attr: 'id', test: /^name|full.?name/i },
  ],
  phone: [
    { attr: 'type', value: 'tel' },
    { attr: 'autocomplete', value: 'tel' },
    { attr: 'autocomplete', value: 'tel-national' },
    { attr: 'name', test: /phone|mobile|tel(e)?phone|contact.?no/i },
    { attr: 'id', test: /phone|mobile|tel(e)?phone|contact.?no/i },
  ],
  streetAddress: [
    { attr: 'autocomplete', value: 'street-address' },
    { attr: 'autocomplete', value: 'address-line1' },
    { attr: 'name', test: /street|address|addr1/i },
    { attr: 'id', test: /street|address|addr1/i },
  ],
  addressLine2: [
    { attr: 'autocomplete', value: 'address-line2' },
    { attr: 'name', test: /addr2|apt|suite|unit/i },
    { attr: 'id', test: /addr2|apt|suite|unit/i },
  ],
  city: [
    { attr: 'autocomplete', value: 'address-level2' },
    { attr: 'name', test: /city|town|suburb/i },
    { attr: 'id', test: /city|town|suburb/i },
  ],
  state: [
    { attr: 'autocomplete', value: 'address-level1' },
    { attr: 'name', test: /state|province|region/i },
    { attr: 'id', test: /state|province|region/i },
  ],
  postalCode: [
    { attr: 'autocomplete', value: 'postal-code' },
    { attr: 'autocomplete', value: 'zip-code' },
    { attr: 'name', test: /zip|postal|post.?code/i },
    { attr: 'id', test: /zip|postal|post.?code/i },
  ],
  country: [
    { attr: 'autocomplete', value: 'country' },
    { attr: 'autocomplete', value: 'country-name' },
    { attr: 'name', test: /country|nation/i },
    { attr: 'id', test: /country|nation/i },
  ],
  otp: [
    { attr: 'autocomplete', value: 'one-time-code' },
    { attr: 'name', test: /otp|totp|2fa|mfa|auth.?code|verification.?code/i },
    { attr: 'id', test: /otp|totp|2fa|mfa|auth.?code/i },
    { attr: 'placeholder', test: /otp|code|2fa|mfa|verification/i },
    { attr: 'inputmode', value: 'numeric' },
    { attr: 'maxlength', value: '6' },
  ],
  search: [
    { attr: 'type', value: 'search' },
    { attr: 'autocomplete', value: 'off' },
    { attr: 'name', test: /search|query|q$/i },
    { attr: 'id', test: /search|query|q$/i },
    { attr: 'role', value: 'search' },
  ],
};

function getAutocompleteValue(el) {
  const ac = el.getAttribute('autocomplete');
  if (!ac) return null;
  const parts = ac.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
}

function matchField(input) {
  if (!input || input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'reset') return null;
  const tag = input.tagName?.toLowerCase();
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return null;

  const type = (input.type || 'text').toLowerCase();
  for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const p of patterns) {
      const val = p.attr === 'autocomplete' ? getAutocompleteValue(input) : input.getAttribute(p.attr) || input[p.attr];
      if (val == null) continue;
      const strVal = String(val);
      if (p.value && strVal.toLowerCase() === p.value.toLowerCase()) return fieldName;
      if (p.test && p.test.test(strVal)) return fieldName;
    }
  }

  if (fieldName === 'password' && type === 'password') return 'password';
  if (fieldName === 'email' && type === 'email') return 'email';
  if (fieldName === 'tel' && type === 'tel') return 'phone';

  return null;
}

function classifyFields(container) {
  const fields = {};
  const inputs = container.querySelectorAll('input, select, textarea');
  for (const el of inputs) {
    const name = matchField(el);
    if (name) {
      if (!fields[name]) fields[name] = [];
      fields[name].push(el);
    }
  }
  return fields;
}

function getFormType(fields) {
  if (fields.password && !fields.confirmPassword) return 'login';
  if (fields.password && fields.confirmPassword) return 'registration';
  if (fields.ccNumber || fields.ccExpiry || fields.ccCVC || fields.ccName) return 'credit-card';
  if (fields.streetAddress || fields.city || fields.postalCode || fields.country) return 'address';
  if (fields.givenName || fields.familyName || fields.fullName) return 'identity';
  if (fields.email && !fields.password) return 'email-only';
  if (fields.otp) return 'otp';
  return null;
}

// ─── Autofill Engine ─────────────────────────────────────────────────────────

function fillElement(el, value) {
  if (!el || value == null) return;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'select') {
    for (const opt of el.options) {
      if (opt.value.toLowerCase() === value.toLowerCase() || opt.text.toLowerCase() === value.toLowerCase()) {
        el.value = opt.value;
        break;
      }
    }
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function doAutofill() {
  try {
    const fields = classifyFields(document);
    const formType = getFormType(fields);

    const domain = window.location.hostname;
    const url = window.location.href;

    const vault = await ipcRenderer.invoke('get-autofill-data', domain);
    if (!vault) return;

    if (fields.password) {
      const loginField = fields.email?.[0] || fields.username?.[0];
      if (vault.credentials?.length) {
        const cred = vault.credentials[0];
        if (loginField && cred.username) fillElement(loginField, cred.username);
        if (fields.password[0] && cred.password) fillElement(fields.password[0], cred.password);
      }
    }

    if (formType === 'credit-card' && vault.cards?.length) {
      const card = vault.cards[0];
      if (fields.ccNumber?.[0] && card.number) fillElement(fields.ccNumber[0], card.number);
      if (fields.ccName?.[0] && card.name) fillElement(fields.ccName[0], card.name);
      if (fields.ccExpiry?.[0] && card.expiry) fillElement(fields.ccExpiry[0], card.expiry);
      if (fields.ccExpMonth?.[0] && card.expMonth) fillElement(fields.ccExpMonth[0], card.expMonth);
      if (fields.ccExpYear?.[0] && card.expYear) fillElement(fields.ccExpYear[0], card.expYear);
      if (fields.ccCVC?.[0] && card.cvc) fillElement(fields.ccCVC[0], card.cvc);
    }

    if (formType === 'address' && vault.addresses?.length) {
      const addr = vault.addresses[0];
      if (fields.streetAddress?.[0] && addr.street) fillElement(fields.streetAddress[0], addr.street);
      if (fields.addressLine2?.[0] && addr.line2) fillElement(fields.addressLine2[0], addr.line2);
      if (fields.city?.[0] && addr.city) fillElement(fields.city[0], addr.city);
      if (fields.state?.[0] && addr.state) fillElement(fields.state[0], addr.state);
      if (fields.postalCode?.[0] && addr.zip) fillElement(fields.postalCode[0], addr.zip);
      if (fields.country?.[0] && addr.country) fillElement(fields.country[0], addr.country);
    }
  } catch (e) {
    console.error('[Autofill] Error:', e);
  }
}

// ─── Save Detection Engine ──────────────────────────────────────────────────

function getSubmitValues(fields) {
  const values = {};
  for (const [name, els] of Object.entries(fields)) {
    const el = els?.[0];
    if (el && el.value) values[name] = el.value;
  }
  return values;
}

function buildSavePayload(formType, values, domain, url) {
  switch (formType) {
    case 'login':
    case 'registration':
      return {
        type: 'credential',
        domain,
        url,
        username: values.email || values.username || '',
        password: values.password || '',
      };
    case 'credit-card':
      return {
        type: 'card',
        domain,
        url,
        ccNumber: values.ccNumber || '',
        ccName: values.ccName || '',
        ccExpiry: values.ccExpiry || '',
        ccExpMonth: values.ccExpMonth || '',
        ccExpYear: values.ccExpYear || '',
        ccCVC: values.ccCVC || '',
      };
    case 'address':
      return {
        type: 'address',
        domain,
        url,
        street: values.streetAddress || '',
        line2: values.addressLine2 || '',
        city: values.city || '',
        state: values.state || '',
        zip: values.postalCode || '',
        country: values.country || '',
        fullName: values.fullName || values.givenName || values.familyName || '',
        phone: values.phone || '',
        email: values.email || '',
      };
    case 'identity':
      return {
        type: 'identity',
        domain,
        url,
        givenName: values.givenName || '',
        familyName: values.familyName || '',
        fullName: values.fullName || '',
        phone: values.phone || '',
        email: values.email || '',
      };
    default:
      return null;
  }
}

function isSearchForm(fields) {
  return !!fields.search;
}

// ─── Initialization ──────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  try {
    Object.defineProperties(window, {
      top: { value: window, writable: false, configurable: false },
      parent: { value: window, writable: false, configurable: false },
      opener: { value: window, writable: false, configurable: false },
    });
    Object.defineProperty(document, 'referrer', { value: '', writable: false, configurable: false });
  } catch (e) {}

  setTimeout(() => doAutofill(), 800);

  setTimeout(() => {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || !(form instanceof HTMLElement)) return;

      const fields = classifyFields(form);
      const formType = getFormType(fields);

      if (!formType || formType === 'otp' || isSearchForm(fields)) return;
      if (!fields.password && formType === 'login') return;

      const hasPassword = !!fields.password?.[0]?.value;
      const hasCC = !!fields.ccNumber?.[0]?.value;
      const hasAddress = !!fields.streetAddress?.[0]?.value;

      if (!hasPassword && !hasCC && !hasAddress) return;

      const values = getSubmitValues(fields);
      const domain = window.location.hostname;
      const url = window.location.href;
      const payload = buildSavePayload(formType, values, domain, url);

      if (!payload) return;

      setTimeout(() => {
        try {
          if (formType === 'login' || formType === 'registration') {
            ipcRenderer.send('propose-password-save', {
              domain, url,
              username: values.email || values.username || '',
              password: values.password || '',
              type: 'login',
            });
          } else if (formType === 'credit-card') {
            ipcRenderer.send('propose-form-collection-save', {
              domain, url, title: `Card saved from ${domain}`,
              data: values,
              type: 'credit-card',
            });
          } else if (formType === 'address' || formType === 'identity') {
            ipcRenderer.send('propose-form-collection-save', {
              domain, url, title: `Address saved from ${domain}`,
              data: values,
              type: formType,
            });
          }
        } catch (err) {
          console.error('[Autofill] Save proposal failed:', err);
        }
      }, 300);
    });

    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el || el.tagName?.toLowerCase() !== 'input') return;
      const fieldName = matchField(el);
      if (!fieldName) return;
      if (el.dataset._aartiq_autofilled === 'true') return;

      const domain = window.location.hostname;
      ipcRenderer.invoke('get-autofill-data', domain).then(vault => {
        if (!vault) return;
        if ((fieldName === 'email' || fieldName === 'username') && vault.credentials?.length) {
          showAutofillDropdown(el, vault.credentials.map(c => ({ label: `${c.username}`, value: c.username, password: c.password, type: 'credential' })));
        }
        if ((fieldName === 'ccNumber') && vault.cards?.length) {
          showAutofillDropdown(el, vault.cards.map(c => ({ label: `•••• ${c.number?.slice(-4) || '****'}`, value: c.number, card: c, type: 'card' })));
        }
      }).catch(() => {});
    });
  }, 1200);
});

// ─── Autofill Dropdown ──────────────────────────────────────────────────────

function showAutofillDropdown(inputEl, items) {
  const existing = document.getElementById('__aartiq_autofill_dropdown__');
  if (existing) existing.remove();

  const rect = inputEl.getBoundingClientRect();
  const dropdown = document.createElement('div');
  dropdown.id = '__aartiq_autofill_dropdown__';
  dropdown.style.cssText = `
    position:fixed; top:${rect.bottom + window.scrollY}px; left:${rect.left + window.scrollX}px;
    min-width:${Math.max(rect.width, 200)}px; background:#1a1a2e; border:1px solid rgba(139,92,246,0.3);
    border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:2147483647;
    font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:13px; overflow:hidden;
    backdrop-filter:blur(12px);
  `;

  const header = document.createElement('div');
  header.textContent = 'Aartiq Neural Vault';
  header.style.cssText = 'padding:8px 12px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:rgba(139,92,246,0.8); border-bottom:1px solid rgba(255,255,255,0.05);';
  dropdown.appendChild(header);

  for (const item of items) {
    const row = document.createElement('div');
    row.style.cssText = 'padding:10px 12px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.15s; color:rgba(255,255,255,0.85);';
    row.onmouseenter = () => row.style.background = 'rgba(139,92,246,0.15)';
    row.onmouseleave = () => row.style.background = 'transparent';

    const icon = document.createElement('span');
    icon.textContent = item.type === 'card' ? '💳' : '🔑';
    icon.style.fontSize = '14px';
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = item.label;
    label.style.flex = '1';
    row.appendChild(label);

    row.onclick = () => {
      if (item.type === 'credential') {
        const pwInput = inputEl.form?.querySelector('input[type="password"]');
        fillElement(inputEl, item.value);
        if (item.password && pwInput) fillElement(pwInput, item.password);
      } else if (item.type === 'card' && item.card) {
        fillElement(inputEl, item.value);
        const form = inputEl.form;
        if (form) {
          const ccFields = classifyFields(form);
          if (ccFields.ccName?.[0] && item.card.name) fillElement(ccFields.ccName[0], item.card.name);
          if (ccFields.ccExpiry?.[0] && item.card.expiry) fillElement(ccFields.ccExpiry[0], item.card.expiry);
          if (ccFields.ccExpMonth?.[0] && item.card.expMonth) fillElement(ccFields.ccExpMonth[0], item.card.expMonth);
          if (ccFields.ccExpYear?.[0] && item.card.expYear) fillElement(ccFields.ccExpYear[0], item.card.expYear);
          if (ccFields.ccCVC?.[0] && item.card.cvc) fillElement(ccFields.ccCVC[0], item.card.cvc);
        }
      }
      dropdown.remove();
    };

    dropdown.appendChild(row);
  }

  document.body.appendChild(dropdown);

  const close = (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('mousedown', close);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

contextBridge.exposeInMainWorld('__view_api__', {
  getURL: () => window.location.href,
});
