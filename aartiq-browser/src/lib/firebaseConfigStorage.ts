// Utility to store and retrieve Firebase config from localStorage
// This allows the desktop app to receive Firebase config from the landing page

const FIREBASE_CONFIG_KEY = 'comet-firebase-config';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const firebaseConfigStorage = {
  save: (config: FirebaseConfig) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
      }
    } catch (error) {
      console.error('Failed to save Firebase config:', error);
    }
  },

  load: (): FirebaseConfig | null => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to load Firebase config:', error);
    }
    return null;
  },

  clear: () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(FIREBASE_CONFIG_KEY);
      }
    } catch (error) {
      console.error('Failed to clear Firebase config:', error);
    }
  }
};
