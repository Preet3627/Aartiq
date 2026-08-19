/**
 * AutofillVault — encrypted credential + identity-profile store.
 *
 * Uses Aartiq's E2EE2 scheme (crypto-utils) so secrets never sit in plaintext on
 * disk. The vault is unlocked in memory for the session; exportEncrypted() yields
 * a single `E2EE2:` blob the Electron layer persists. Form filling resolves a
 * domain to the best credential/profile and matches it against page fields.
 */

import { encrypt, decrypt } from '../crypto-utils';
import { matchFields, type FieldDescriptor, type FieldMatch, type Profile, type ProfileKey } from './matcher';

export interface CredentialEntry {
  id: string;
  domain: string;
  username?: string;
  password?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileEntry {
  id: string;
  label: string;
  fields: Profile;
  createdAt: number;
  updatedAt: number;
}

export interface VaultData {
  credentials: CredentialEntry[];
  profiles: ProfileEntry[];
}

function uid(): string {
  return 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export class AutofillVault {
  private unlocked = false;
  private credentials: CredentialEntry[] = [];
  private profiles: ProfileEntry[] = [];

  constructor(private readonly passphrase: string) {}

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): void {
    this.unlocked = true;
  }

  lock(): void {
    this.unlocked = false;
    this.credentials = [];
    this.profiles = [];
  }

  private ensure(): void {
    if (!this.unlocked) throw new Error('Vault is locked. Call unlock() first.');
  }

  // --- Credentials -------------------------------------------------------

  async addCredential(input: Omit<CredentialEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<CredentialEntry> {
    this.ensure();
    const now = Date.now();
    const entry: CredentialEntry = { ...input, id: uid(), createdAt: now, updatedAt: now };
    this.credentials.push(entry);
    return entry;
  }

  updateCredential(id: string, patch: Partial<CredentialEntry>): void {
    this.ensure();
    const c = this.credentials.find((x) => x.id === id);
    if (c) Object.assign(c, patch, { updatedAt: Date.now() });
  }

  removeCredential(id: string): void {
    this.ensure();
    this.credentials = this.credentials.filter((x) => x.id !== id);
  }

  listCredentials(): CredentialEntry[] {
    this.ensure();
    return [...this.credentials];
  }

  getForDomain(domain: string): CredentialEntry[] {
    this.ensure();
    const host = domain.replace(/^www\./, '');
    return this.credentials.filter((c) => {
      const d = (c.domain || '').replace(/^www\./, '');
      return d === host || d.endsWith('.' + host) || host.endsWith('.' + d);
    });
  }

  // --- Profiles ----------------------------------------------------------

  addProfile(label: string, fields: Profile): ProfileEntry {
    this.ensure();
    const now = Date.now();
    const entry: ProfileEntry = { id: uid(), label, fields, createdAt: now, updatedAt: now };
    this.profiles.push(entry);
    return entry;
  }

  listProfiles(): ProfileEntry[] {
    this.ensure();
    return [...this.profiles];
  }

  // --- Form filling ------------------------------------------------------

  /** Resolve a profile object for a domain (credential username/email + identity). */
  resolveProfileForDomain(domain: string): Profile {
    this.ensure();
    const creds = this.getForDomain(domain);
    const profile: Profile = {};
    if (creds[0]?.username) profile.email = creds[0].username;
    const identity = this.profiles[0];
    if (identity) Object.assign(profile, identity.fields);
    return profile;
  }

  /** Match page fields against the best credential/profile for a domain. */
  matchForm(domain: string, fields: FieldDescriptor[]): FieldMatch[] {
    this.ensure();
    const profile = this.resolveProfileForDomain(domain);
    const matches = matchFields(fields, profile);
    const cred = this.getForDomain(domain)[0];
    if (cred?.password) {
      for (const f of fields) {
        if ((f.type || '').toLowerCase() === 'password') {
          matches.push({ fieldIndex: f.index, selector: f.selector, value: cred.password, confidence: 100, matchedBy: 'vault', profileKey: 'email' as ProfileKey });
          break;
        }
      }
    }
    return matches;
  }

  // --- Persistence -------------------------------------------------------

  async exportEncrypted(): Promise<string> {
    this.ensure();
    const data: VaultData = { credentials: this.credentials, profiles: this.profiles };
    return encrypt(JSON.stringify(data), this.passphrase);
  }

  static async importEncrypted(blob: string, passphrase: string): Promise<AutofillVault> {
    const json = await decrypt(blob, passphrase);
    const data = JSON.parse(json) as VaultData;
    const vault = new AutofillVault(passphrase);
    vault.unlock();
    vault.credentials = data.credentials ?? [];
    vault.profiles = data.profiles ?? [];
    return vault;
  }
}
