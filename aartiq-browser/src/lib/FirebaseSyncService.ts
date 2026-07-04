import { getDatabase, ref, onValue, set, Database } from "firebase/database";
import { User, Auth } from "firebase/auth";
import firebaseService from "./FirebaseService"; // Corrected import
import { Security } from "./Security";

// These will be null initially, and set once firebaseService is initialized
let db: Database | null = null;
let auth: Auth | null = null;
let initCheckInterval: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

// Listen for FirebaseService to be initialized and then set db and auth
const initializeFirebaseSync = () => {
  // Clear any existing interval
  if (initCheckInterval !== null) {
    clearInterval(initCheckInterval);
    initCheckInterval = null;
  }
  
  // Check if Firebase is already initialized
  if (firebaseService.app && firebaseService.auth && !isInitialized) {
    try {
      db = getDatabase(firebaseService.app);
      auth = firebaseService.auth;
      isInitialized = true;
      console.log('[FirebaseSyncService] Firebase initialized successfully');
    } catch (error) {
      console.error('[FirebaseSyncService] Failed to initialize Firebase:', error);
      // Retry in case of temporary failure
      initCheckInterval = setInterval(initializeFirebaseSync, 1000);
      return;
    }
  } else if (!firebaseService.app || !firebaseService.auth) {
    // Firebase not ready yet, set up interval to check
    initCheckInterval = setInterval(() => {
      if (firebaseService.app && firebaseService.auth && !isInitialized) {
        try {
          db = getDatabase(firebaseService.app);
          auth = firebaseService.auth;
          isInitialized = true;
          if (initCheckInterval !== null) {
            clearInterval(initCheckInterval);
            initCheckInterval = null;
          }
          console.log('[FirebaseSyncService] Firebase initialized successfully');
        } catch (error) {
          console.error('[FirebaseSyncService] Failed to initialize Firebase:', error);
          // Keep retrying
        }
      }
    }, 500);
    return;
  }
};

// Start initialization
initializeFirebaseSync();

// Handle reinitialization if FirebaseService is reinitialized
const originalReinitialize = firebaseService.reinitialize;
firebaseService.reinitialize = function() {
  originalReinitialize.call(this);
  // Reset state
  isInitialized = false;
  db = null;
  auth = null;
  // Clear existing interval if any
  if (initCheckInterval !== null) {
    clearInterval(initCheckInterval);
    initCheckInterval = null;
  }
  // Restart initialization
  initializeFirebaseSync();
};

class FirebaseSyncService {
  private userId: string | null = null;

  constructor() {
    // Wait for auth to be initialized before listening to state changes
    const authCheckInterval = setInterval(() => {
      if (auth) {
        auth.onAuthStateChanged((user: User | null) => {
          if (user) {
            this.userId = user.uid;
            // Trigger initial sync for all categories
            this.syncClipboard();
            this.syncHistory();
            this.syncApiKeys();
          } else {
            this.userId = null;
          }
        });
        clearInterval(authCheckInterval);
      }
    }, 500);
  }

  private async getStore() {
    const { useAppStore } = await import("@/store/useAppStore");
    return useAppStore;
  }

  public async syncClipboard() {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot sync clipboard: missing userId or db');
      return;
    }

    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled
    if (store.isGuestMode || !store.cloudSyncConsent) return;

    const clipboardRef = ref(db, "clipboard/" + this.userId);
    onValue(clipboardRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        const useAppStore = await this.getStore();
        const store = useAppStore.getState();

        // Double-check guest mode and sync consent before syncing
        if (store.isGuestMode || !store.cloudSyncConsent) return;
        const { syncPassphrase } = store;
        if (!syncPassphrase) return;

        const decrypted = await Promise.all(
          data.map(item => Security.decrypt(item, syncPassphrase))
        );
        useAppStore.setState({ clipboard: decrypted });
      }
    });
  }

  public async setClipboard(clipboard: unknown[]) {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot set clipboard: missing userId or db');
      return;
    }
    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled or no passphrase for encryption
    if (store.isGuestMode || !store.cloudSyncConsent) return;
    const { syncPassphrase } = store;
    if (!syncPassphrase) return;

    const encrypted = await Promise.all(
      clipboard.map(item => Security.encrypt(String(item), syncPassphrase))
    );

    const clipboardRef = ref(db, "clipboard/" + this.userId);
    set(clipboardRef, encrypted);
  }

  public async syncHistory() {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot sync history: missing userId or db');
      return;
    }

    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled
    if (store.isGuestMode || !store.cloudSyncConsent) return;

    const historyRef = ref(db, "history/" + this.userId);
    onValue(historyRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        const useAppStore = await this.getStore();
        const store = useAppStore.getState();

        // Double-check guest mode and sync consent before syncing
        if (store.isGuestMode || !store.cloudSyncConsent) return;

        useAppStore.setState({ history: data });
      }
    });
  }

  public async setHistory(history: string[]) {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot set history: missing userId or db');
      return;
    }
    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled or no passphrase for encryption
    if (store.isGuestMode || !store.cloudSyncConsent) return;
    const { syncPassphrase } = store;
    if (!syncPassphrase) return;

    const encrypted = await Promise.all(
      history.map(item => Security.encrypt(item, syncPassphrase))
    );

    const historyRef = ref(db, "history/" + this.userId);
    set(historyRef, encrypted);
  }

  public async syncApiKeys() {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot sync API keys: missing userId or db');
      return;
    }
    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled
    if (store.isGuestMode || !store.cloudSyncConsent) return;

    const apiKeysRef = ref(db, "apiKeys/" + this.userId);
    onValue(apiKeysRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const useAppStore = await this.getStore();
        const store = useAppStore.getState();

        // Double-check guest mode and sync consent before syncing
        if (store.isGuestMode || !store.cloudSyncConsent) return;
        const { syncPassphrase } = store;
        if (!syncPassphrase) return;

        const decrypted = await Security.decrypt(data, syncPassphrase);
        const parsedKeys = JSON.parse(decrypted);
        store.setOpenaiApiKey(parsedKeys.openai);
        store.setGeminiApiKey(parsedKeys.gemini);
      }
    });
  }

  public async setApiKeys(apiKeys: Record<string, string>) {
    if (!this.userId || !db) {
      console.warn('[FirebaseSyncService] Cannot set API keys: missing userId or db');
      return;
    }
    const useAppStore = await this.getStore();
    const store = useAppStore.getState();

    // Skip sync if guest mode is enabled or no passphrase for encryption
    if (store.isGuestMode || !store.cloudSyncConsent) return;
    const { syncPassphrase } = store;
    if (!syncPassphrase) return;

    const encryptedKeys = await Security.encrypt(JSON.stringify(apiKeys), syncPassphrase);
    const apiKeysRef = ref(db, "apiKeys/" + this.userId);
    set(apiKeysRef, encryptedKeys);
  }
}

export const firebaseSyncService = new FirebaseSyncService();