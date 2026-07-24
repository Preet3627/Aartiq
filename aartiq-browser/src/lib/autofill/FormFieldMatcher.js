const AUTOCOMPLETE_MAP = {
  'given-name': 'firstName', 'family-name': 'lastName', 'surname': 'lastName',
  'email': 'email', 'tel': 'phone', 'tel-national': 'phone', 'phone': 'phone',
  'organization': 'organization', 'company': 'organization',
  'street-address': 'addressLine1', 'address-line1': 'addressLine1',
  'address-line2': 'addressLine2', 'address-level1': 'state',
  'address-level2': 'city', 'state': 'state', 'province': 'state',
  'city': 'city', 'postal-code': 'postalCode', 'zip': 'postalCode',
  'zip-code': 'postalCode', 'country': 'country', 'country-name': 'country',
};

const INPUT_TYPE_MAP = { email: 'email', tel: 'phone' };

const NAME_MAP = {
  firstname: 'firstName', first_name: 'firstName', first: 'firstName',
  fname: 'firstName', givenname: 'firstName',
  lastname: 'lastName', last_name: 'lastName', last: 'lastName',
  lname: 'lastName', surname: 'lastName', familyname: 'lastName',
  email: 'email', e_mail: 'email', e_mail_address: 'email',
  emailaddress: 'email', mail: 'email',
  phone: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone', cell: 'phone',
  company: 'organization', organization: 'organization',
  organisation: 'organization', companyname: 'organization',
  address: 'addressLine1', street: 'addressLine1',
  street_address: 'addressLine1', address1: 'addressLine1',
  address_line1: 'addressLine1', addr_line1: 'addressLine1',
  address2: 'addressLine2', address_line2: 'addressLine2',
  addr_line2: 'addressLine2',
  city: 'city', town: 'city', locality: 'city',
  state: 'state', province: 'state', region: 'state',
  zip: 'postalCode', zipcode: 'postalCode', zip_code: 'postalCode',
  postal_code: 'postalCode', postalcode: 'postalCode', postcode: 'postalCode',
  country: 'country',
};

const LABEL_MAP = [
  ['first name', 'given name'], 'firstName',
  ['last name', 'surname', 'family name'], 'lastName',
  ['email', 'e-mail', 'email address'], 'email',
  ['phone', 'telephone', 'phone number', 'mobile', 'cell'], 'phone',
  ['company', 'organization', 'organisation', 'company name'], 'organization',
  ['address', 'street address', 'address line 1'], 'addressLine1',
  ['address line 2'], 'addressLine2',
  ['city', 'town'], 'city',
  ['state', 'province', 'region'], 'state',
  ['zip', 'zip code', 'postal code', 'post code'], 'postalCode',
  ['country'], 'country',
];

function normalize(s) {
  return String(s || '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}

function matchAutocomplete(el) {
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (!ac) return null;
  const cleaned = ac.replace(/^(section-\w+\s+|shipping\s+|billing\s+)/i, '').trim();
  const key = AUTOCOMPLETE_MAP[cleaned];
  if (key) return { value: null, confidence: 100, matchedBy: 'autocomplete', profileKey: key };
  return null;
}

function matchInputType(el) {
  const type = (el.type || 'text').toLowerCase();
  const key = INPUT_TYPE_MAP[type];
  if (key) return { value: null, confidence: 90, matchedBy: 'inputType', profileKey: key };
  return null;
}

function matchName(el) {
  const name = normalize(el.name || '');
  if (!name) return null;
  const key = NAME_MAP[name];
  if (key) return { value: null, confidence: 80, matchedBy: 'name', profileKey: key };
  for (const [pattern, pk] of Object.entries(NAME_MAP)) {
    if (name.includes(pattern)) return { value: null, confidence: 70, matchedBy: 'name', profileKey: pk };
  }
  return null;
}

function labelText(el) {
  let label = '';
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) label = lbl.textContent;
  }
  if (!label) {
    const parent = el.closest('label');
    if (parent) {
      const clone = parent.cloneNode(true);
      const inputs = clone.querySelectorAll('input, select, textarea');
      for (const inp of inputs) inp.remove();
      label = clone.textContent;
    }
  }
  if (!label) label = el.getAttribute('aria-label') || '';
  if (!label) {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) label = ref.textContent;
    }
  }
  return normalize(label);
}

function matchLabel(elFallback) {
  const label = normalize(elFallback.label || '');
  if (!label) return null;
  for (let i = 0; i < LABEL_MAP.length; i += 2) {
    const patterns = LABEL_MAP[i];
    const pk = LABEL_MAP[i + 1];
    if (patterns.some(p => label === p)) return { value: null, confidence: 75, matchedBy: 'label', profileKey: pk };
    if (patterns.some(p => label.includes(p))) return { value: null, confidence: 65, matchedBy: 'label', profileKey: pk };
  }
  return null;
}

function matchPlaceholder(el) {
  const ph = normalize(el.placeholder || '');
  if (!ph) return null;
  for (let i = 0; i < LABEL_MAP.length; i += 2) {
    const patterns = LABEL_MAP[i];
    const pk = LABEL_MAP[i + 1];
    if (patterns.some(p => ph === p || ph.includes(p))) return { value: null, confidence: 50, matchedBy: 'placeholder', profileKey: pk };
  }
  return null;
}

function matchField(el, fallback) {
  const strategies = [matchAutocomplete, matchInputType, matchName];
  for (const strat of strategies) {
    const result = strat(el, fallback);
    if (result) return result;
  }
  if (fallback) {
    const lResult = matchLabel(fallback);
    if (lResult) return lResult;
  }
  const pResult = matchPlaceholder(el);
  if (pResult) return pResult;
  return null;
}

function matchFields(elements, profile) {
  const assignments = new Map();
  const usedIndices = new Set();
  for (const el of elements) {
    if (el.disabled) continue;
    const type = (el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'file', 'image', 'password', 'checkbox', 'radio'].includes(type)) continue;
    const result = matchField(el, el.fallback);
    if (!result) continue;
    const value = profile[result.profileKey];
    if (value === undefined || value === null || value === '') continue;
    if (usedIndices.has(el.index)) continue;
    const existing = assignments.get(result.profileKey);
    if (existing && existing.confidence >= result.confidence) continue;
    assignments.set(result.profileKey, {
      fieldIndex: el.index,
      selector: el.selector,
      value: String(value),
      confidence: result.confidence,
      matchedBy: result.matchedBy,
    });
    usedIndices.add(el.index);
  }
  return Array.from(assignments.values());
}

function buildAssignJS(elements, profile) {
  const matches = matchFields(elements, profile);
  return JSON.stringify(matches);
}

module.exports = { matchField, matchFields, buildAssignJS, AUTOCOMPLETE_MAP, NAME_MAP, LABEL_MAP, INPUT_TYPE_MAP };
