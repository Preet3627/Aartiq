const Store = require('electron-store');
const crypto = require('crypto');

const vaultStore = new Store({ name: 'comet-vault' });

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const ITERATIONS = 600000;
const KEY_STORE_KEY = 'vault_encryption_key_derived';

function getOrCreateEncryptionKey() {
  let keyBase64 = vaultStore.get(KEY_STORE_KEY);
  if (!keyBase64) {
    const key = crypto.randomBytes(KEY_LENGTH);
    keyBase64 = key.toString('base64');
    vaultStore.set(KEY_STORE_KEY, keyBase64);
  }
  return Buffer.from(keyBase64, 'base64');
}

function encryptSecret(plaintext, key) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

function decryptSecret(stored, key) {
  try {
    const salt = Buffer.from(stored.salt, 'base64');
    const iv = Buffer.from(stored.iv, 'base64');
    const authTag = Buffer.from(stored.authTag, 'base64');
    const encrypted = Buffer.from(stored.encrypted, 'base64');
    const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}

function getEncryptionKey() {
  const key = getOrCreateEncryptionKey();
  if (key.length !== KEY_LENGTH) {
    throw new Error('Invalid encryption key length');
  }
  return key;
}

const vaultListEntries = async () => {
  const entries = vaultStore.get('entries', []);
  return entries.map(e => ({
    id: e.id,
    title: e.title,
    username: e.username,
    url: e.url,
    createdAt: e.createdAt,
    hasPassword: !!e.encryptedPassword
  }));
};

const vaultSaveEntry = async (payload = {}) => {
  const { id, title, username, password, url, notes } = payload;
  const entries = vaultStore.get('entries', []);
  const existing = entries.findIndex(e => e.id === id);
  const key = getEncryptionKey();
  const entry = { 
    id: id || `vault-${Date.now()}`, 
    title, username, url, notes,
    createdAt: existing >= 0 ? entries[existing].createdAt : Date.now(),
    updatedAt: Date.now()
  };
  if (password) {
    entry.encryptedPassword = encryptSecret(password, key);
  } else if (existing >= 0 && entries[existing].encryptedPassword) {
    entry.encryptedPassword = entries[existing].encryptedPassword;
  }
  if (notes) {
    entry.encryptedNotes = encryptSecret(notes, key);
  } else if (existing >= 0 && entries[existing].encryptedNotes) {
    entry.encryptedNotes = entries[existing].encryptedNotes;
  }
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  vaultStore.set('entries', entries);
  return { success: true, entry: { ...entry, encryptedPassword: undefined, encryptedNotes: undefined } };
};

const vaultDeleteEntry = async (entryId) => {
  const entries = vaultStore.get('entries', []).filter(e => e.id !== entryId);
  vaultStore.set('entries', entries);
  return { success: true };
};

const vaultReadSecret = async (entryId) => {
  const entries = vaultStore.get('entries', []);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return { error: 'Entry not found' };
  const key = getEncryptionKey();
  const password = entry.encryptedPassword ? decryptSecret(entry.encryptedPassword, key) : null;
  const notes = entry.encryptedNotes ? decryptSecret(entry.encryptedNotes, key) : null;
  if (entry.encryptedPassword && !password) {
    return { error: 'Failed to decrypt entry' };
  }
  return { password, notes };
};

const vaultCopySecret = async (entryId) => {
  const entries = vaultStore.get('entries', []);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return { error: 'Entry not found' };
  const key = getEncryptionKey();
  const password = entry.encryptedPassword ? decryptSecret(entry.encryptedPassword, key) : null;
  if (!password) return { error: 'Failed to decrypt password' };
  const { clipboard } = require('electron');
  clipboard.writeText(password);
  return { success: true };
};

module.exports = {
  vaultListEntries,
  vaultSaveEntry,
  vaultDeleteEntry,
  vaultReadSecret,
  vaultCopySecret,
  vaultStore
};