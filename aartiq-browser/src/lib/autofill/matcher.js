"use strict";
/**
 * Form field matcher (TypeScript, Node-testable).
 *
 * Maps page fields to profile keys using the same strategy cascade as Aartiq's
 * FormFieldMatcher.js (autocomplete token → input type → name → label →
 * placeholder), so it can run without a DOM and be unit-tested. The renderer-side
 * injector produces the descriptors; this module does the matching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchField = matchField;
exports.matchFields = matchFields;
const AUTOCOMPLETE_MAP = {
    'given-name': 'firstName', 'family-name': 'lastName', 'surname': 'lastName',
    email: 'email', tel: 'phone', 'tel-national': 'phone', phone: 'phone',
    organization: 'organization', company: 'organization',
    'street-address': 'addressLine1', 'address-line1': 'addressLine1',
    'address-line2': 'addressLine2', 'address-level1': 'state',
    'address-level2': 'city', state: 'state', province: 'state',
    city: 'city', 'postal-code': 'postalCode', zip: 'postalCode',
    'zip-code': 'postalCode', country: 'country', 'country-name': 'country',
};
const INPUT_TYPE_MAP = { email: 'email', tel: 'phone' };
const NAME_MAP = {
    firstname: 'firstName', first_name: 'firstName', first: 'firstName', fname: 'firstName', givenname: 'firstName',
    lastname: 'lastName', last_name: 'lastName', last: 'lastName', lname: 'lastName', surname: 'lastName', familyname: 'lastName',
    email: 'email', e_mail: 'email', emailaddress: 'email', mail: 'email',
    phone: 'phone', telephone: 'phone', tel: 'phone', mobile: 'phone', cell: 'phone',
    company: 'organization', organization: 'organization', organisation: 'organization', companyname: 'organization',
    address: 'addressLine1', street: 'addressLine1', street_address: 'addressLine1', address1: 'addressLine1',
    address_line1: 'addressLine1', addr_line1: 'addressLine1',
    address2: 'addressLine2', address_line2: 'addressLine2', addr_line2: 'addressLine2',
    city: 'city', town: 'city', locality: 'city',
    state: 'state', province: 'state', region: 'state',
    zip: 'postalCode', zipcode: 'postalCode', zip_code: 'postalCode',
    postal_code: 'postalCode', postalcode: 'postalCode', postcode: 'postalCode',
    country: 'country',
};
const LABEL_MAP = [
    [['first name', 'given name'], 'firstName'],
    [['last name', 'surname', 'family name'], 'lastName'],
    [['email', 'e-mail', 'email address'], 'email'],
    [['phone', 'telephone', 'phone number', 'mobile', 'cell'], 'phone'],
    [['company', 'organization', 'organisation', 'company name'], 'organization'],
    [['address', 'street address', 'address line 1'], 'addressLine1'],
    [['address line 2'], 'addressLine2'],
    [['city', 'town'], 'city'],
    [['state', 'province', 'region'], 'state'],
    [['zip', 'zip code', 'postal code', 'post code'], 'postalCode'],
    [['country'], 'country'],
];
function normalize(s) {
    return String(s || '').toLowerCase().trim().replace(/[\s_-]+/g, ' ');
}
function matchAutocomplete(f) {
    const ac = normalize(f.autocomplete || '');
    if (!ac)
        return null;
    const cleaned = ac.replace(/^(section-\w+\s+|shipping\s+|billing\s+)/i, '').trim();
    const key = AUTOCOMPLETE_MAP[cleaned];
    return key ? { profileKey: key, confidence: 100, matchedBy: 'autocomplete' } : null;
}
function matchInputType(f) {
    const key = INPUT_TYPE_MAP[(f.type || 'text').toLowerCase()];
    return key ? { profileKey: key, confidence: 90, matchedBy: 'inputType' } : null;
}
function matchName(f) {
    const name = normalize(f.name || '');
    if (!name)
        return null;
    if (NAME_MAP[name])
        return { profileKey: NAME_MAP[name], confidence: 80, matchedBy: 'name' };
    for (const [pattern, pk] of Object.entries(NAME_MAP)) {
        if (name.includes(pattern))
            return { profileKey: pk, confidence: 70, matchedBy: 'name' };
    }
    return null;
}
function matchLabel(f) {
    const label = normalize(f.label || '');
    if (!label)
        return null;
    for (const [patterns, pk] of LABEL_MAP) {
        if (patterns.some((p) => label === p))
            return { profileKey: pk, confidence: 75, matchedBy: 'label' };
        if (patterns.some((p) => label.includes(p)))
            return { profileKey: pk, confidence: 65, matchedBy: 'label' };
    }
    return null;
}
function matchPlaceholder(f) {
    const ph = normalize(f.placeholder || '');
    if (!ph)
        return null;
    for (const [patterns, pk] of LABEL_MAP) {
        if (patterns.some((p) => ph === p || ph.includes(p)))
            return { profileKey: pk, confidence: 50, matchedBy: 'placeholder' };
    }
    return null;
}
function matchField(f) {
    const strategies = [matchAutocomplete, matchInputType, matchName];
    for (const s of strategies) {
        const r = s(f);
        if (r)
            return r;
    }
    const l = matchLabel(f);
    if (l)
        return l;
    const p = matchPlaceholder(f);
    if (p)
        return p;
    return null;
}
/** Match a list of fields against a profile, preferring higher-confidence matches. */
function matchFields(fields, profile) {
    const assignments = new Map();
    const usedIndices = new Set();
    for (const f of fields) {
        if (f.disabled)
            continue;
        const type = (f.type || '').toLowerCase();
        if (['hidden', 'submit', 'button', 'file', 'image', 'password', 'checkbox', 'radio'].includes(type))
            continue;
        const result = matchField(f);
        if (!result)
            continue;
        const value = profile[result.profileKey];
        if (value === undefined || value === null || value === '')
            continue;
        if (usedIndices.has(f.index))
            continue;
        const existing = assignments.get(result.profileKey);
        if (existing && existing.confidence >= result.confidence)
            continue;
        assignments.set(result.profileKey, {
            fieldIndex: f.index,
            selector: f.selector,
            value: String(value),
            confidence: result.confidence,
            matchedBy: result.matchedBy,
            profileKey: result.profileKey,
        });
        usedIndices.add(f.index);
    }
    return Array.from(assignments.values());
}
