const Store = require('electron-store');
const crypto = require('crypto');

const PROFILE_FIELDS = [
  'label', 'firstName', 'lastName', 'email', 'phone', 'organization',
  'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country',
];

class AutofillProfileService {
  constructor() {
    this.store = new Store({
      name: 'autofill-profiles',
      encryptionKey: 'aartiq-autofill-v1',
      schema: {
        profiles: {
          type: 'array',
          default: [],
          items: {
            type: 'object',
            properties: Object.fromEntries(
              PROFILE_FIELDS.map(f => [f, { type: 'string', default: '' }])
            ),
            additionalProperties: { type: 'string' },
          },
        },
      },
    });
  }

  listProfiles() {
    return this.store.get('profiles', []);
  }

  getProfile(id) {
    const profiles = this.listProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  addProfile(input) {
    const profiles = this.listProfiles();
    const profile = {
      id: crypto.randomUUID(),
      ...Object.fromEntries(PROFILE_FIELDS.map(f => [f, ''])),
      ...Object.fromEntries(
        Object.entries(input || {})
          .filter(([k]) => PROFILE_FIELDS.includes(k))
          .map(([k, v]) => [k, String(v || '')])
      ),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!profile.label || !profile.label.trim()) {
      throw new Error('Profile label is required');
    }
    profiles.push(profile);
    this.store.set('profiles', profiles);
    return profile;
  }

  updateProfile(id, updates) {
    const profiles = this.listProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Profile not found');
    const allowed = Object.fromEntries(
      Object.entries(updates || {})
        .filter(([k]) => PROFILE_FIELDS.includes(k))
        .map(([k, v]) => [k, String(v || '')])
    );
    if ('label' in allowed && !allowed.label.trim()) {
      throw new Error('Profile label cannot be empty');
    }
    profiles[index] = { ...profiles[index], ...allowed, updatedAt: new Date().toISOString() };
    this.store.set('profiles', profiles);
    return profiles[index];
  }

  deleteProfile(id) {
    const profiles = this.listProfiles();
    const filtered = profiles.filter(p => p.id !== id);
    if (filtered.length === profiles.length) return false;
    this.store.set('profiles', filtered);
    return true;
  }

  getProfileFields() {
    return [...PROFILE_FIELDS];
  }
}

module.exports = { AutofillProfileService };
