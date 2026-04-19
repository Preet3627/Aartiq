const Store = require('electron-store');

const vaultStore = new Store({ name: 'comet-vault' });

const vaultListEntries = async () => {
  const entries = vaultStore.get('entries', []);
  return entries.map(e => ({ id: e.id, title: e.title, username: e.username, url: e.url, createdAt: e.createdAt }));
};

const vaultSaveEntry = async (payload = {}) => {
  const { id, title, username, password, url, notes } = payload;
  const entries = vaultStore.get('entries', []);
  const existing = entries.findIndex(e => e.id === id);
  const entry = { 
    id: id || `vault-${Date.now()}`, 
    title, username, password, url, notes, 
    createdAt: existing >= 0 ? entries[existing].createdAt : Date.now(),
    updatedAt: Date.now()
  };
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  vaultStore.set('entries', entries);
  return { success: true, entry };
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
  return { password: entry.password, notes: entry.notes };
};

const vaultCopySecret = async (entryId) => {
  const entries = vaultStore.get('entries', []);
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return { error: 'Entry not found' };
  const { clipboard } = require('electron');
  clipboard.writeText(entry.password);
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