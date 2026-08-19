"use strict";
/**
 * AutofillVault — encrypted credential + identity-profile store.
 *
 * Uses Aartiq's E2EE2 scheme (crypto-utils) so secrets never sit in plaintext on
 * disk. The vault is unlocked in memory for the session; exportEncrypted() yields
 * a single `E2EE2:` blob the Electron layer persists. Form filling resolves a
 * domain to the best credential/profile and matches it against page fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutofillVault = void 0;
const crypto_utils_1 = require("../crypto-utils");
const matcher_1 = require("./matcher");
function uid() {
    return 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
class AutofillVault {
    constructor(passphrase) {
        this.passphrase = passphrase;
        this.unlocked = false;
        this.credentials = [];
        this.profiles = [];
    }
    get isUnlocked() {
        return this.unlocked;
    }
    unlock() {
        this.unlocked = true;
    }
    lock() {
        this.unlocked = false;
        this.credentials = [];
        this.profiles = [];
    }
    ensure() {
        if (!this.unlocked)
            throw new Error('Vault is locked. Call unlock() first.');
    }
    // --- Credentials -------------------------------------------------------
    async addCredential(input) {
        this.ensure();
        const now = Date.now();
        const entry = { ...input, id: uid(), createdAt: now, updatedAt: now };
        this.credentials.push(entry);
        return entry;
    }
    updateCredential(id, patch) {
        this.ensure();
        const c = this.credentials.find((x) => x.id === id);
        if (c)
            Object.assign(c, patch, { updatedAt: Date.now() });
    }
    removeCredential(id) {
        this.ensure();
        this.credentials = this.credentials.filter((x) => x.id !== id);
    }
    listCredentials() {
        this.ensure();
        return [...this.credentials];
    }
    getForDomain(domain) {
        this.ensure();
        const host = domain.replace(/^www\./, '');
        return this.credentials.filter((c) => {
            const d = (c.domain || '').replace(/^www\./, '');
            return d === host || d.endsWith('.' + host) || host.endsWith('.' + d);
        });
    }
    // --- Profiles ----------------------------------------------------------
    addProfile(label, fields) {
        this.ensure();
        const now = Date.now();
        const entry = { id: uid(), label, fields, createdAt: now, updatedAt: now };
        this.profiles.push(entry);
        return entry;
    }
    listProfiles() {
        this.ensure();
        return [...this.profiles];
    }
    // --- Form filling ------------------------------------------------------
    /** Resolve a profile object for a domain (credential username/email + identity). */
    resolveProfileForDomain(domain) {
        this.ensure();
        const creds = this.getForDomain(domain);
        const profile = {};
        if (creds[0]?.username)
            profile.email = creds[0].username;
        const identity = this.profiles[0];
        if (identity)
            Object.assign(profile, identity.fields);
        return profile;
    }
    /** Match page fields against the best credential/profile for a domain. */
    matchForm(domain, fields) {
        this.ensure();
        const profile = this.resolveProfileForDomain(domain);
        const matches = (0, matcher_1.matchFields)(fields, profile);
        const cred = this.getForDomain(domain)[0];
        if (cred?.password) {
            for (const f of fields) {
                if ((f.type || '').toLowerCase() === 'password') {
                    matches.push({ fieldIndex: f.index, selector: f.selector, value: cred.password, confidence: 100, matchedBy: 'vault', profileKey: 'email' });
                    break;
                }
            }
        }
        return matches;
    }
    // --- Persistence -------------------------------------------------------
    async exportEncrypted() {
        this.ensure();
        const data = { credentials: this.credentials, profiles: this.profiles };
        return (0, crypto_utils_1.encrypt)(JSON.stringify(data), this.passphrase);
    }
    static async importEncrypted(blob, passphrase) {
        const json = await (0, crypto_utils_1.decrypt)(blob, passphrase);
        const data = JSON.parse(json);
        const vault = new AutofillVault(passphrase);
        vault.unlock();
        vault.credentials = data.credentials ?? [];
        vault.profiles = data.profiles ?? [];
        return vault;
    }
}
exports.AutofillVault = AutofillVault;
