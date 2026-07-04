import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, User, signInWithCustomToken as firebaseSignInWithCustomToken, signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged, GoogleAuthProvider, signInWithPopup, getRedirectResult, signInWithCredential as firebaseSignInWithCredential, AuthCredential, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, Firestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseConfigStorage, FirebaseConfig } from './firebaseConfigStorage';

class FirebaseService {
  public app: FirebaseApp | null = null;
  public auth: Auth | null = null;
  public firestore: Firestore | null = null;
  private authReadyCallbacks: (() => void)[] = [];
  private authInitialized: boolean = false;
  private persistenceReady: Promise<void> = Promise.resolve();

  constructor() {
    this.initializeFirebase();
  }

  public reinitialize() {
    console.log("[Firebase] Reinitializing with new config...");
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Get Firebase config from stored config (from landing page) or fallback to env vars
      const getFirebaseConfig = (): FirebaseConfig => {
        // First, try to load from localStorage (received from landing page)
        const storedConfig = firebaseConfigStorage.load();
        if (storedConfig) {
          return storedConfig;
        }

        // Fallback to environment variables
        return {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        };
      };

      const firebaseConfig = getFirebaseConfig();

      // Only initialize if we have valid config
      if (firebaseConfig.apiKey) {
        this.app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        this.auth = getAuth(this.app);
        this.firestore = getFirestore(this.app);
        this.persistenceReady = setPersistence(this.auth, browserLocalPersistence)
          .then(() => {
            console.log('[Firebase] Auth persistence set to local.');
          })
          .catch((error) => {
            console.warn('[Firebase] Failed to enable local auth persistence:', error);
          });

        // Listen for the initial auth state to set authInitialized
        this.auth.onAuthStateChanged(() => {
          this.authInitialized = true;
          this.authReadyCallbacks.forEach(cb => cb());
          this.authReadyCallbacks = []; // Clear callbacks after execution
        });
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
    }
  }

  public onAuthReady(callback: () => void) {
    if (this.authInitialized) {
      callback();
    } else {
      this.authReadyCallbacks.push(callback);
    }
  }

  public async ensurePersistenceReady() {
    await this.persistenceReady;
  }

  async signInWithCustomToken(token: string): Promise<User | null> {
    if (!this.auth) return null;
    try {
      await this.ensurePersistenceReady();
      const result = await firebaseSignInWithCustomToken(this.auth, token);
      return result.user;
    } catch (error) {
      console.error("Error signing in with custom token:", error);
      return null;
    }
  }

  async signInWithCredential(credential: AuthCredential): Promise<User | null> {
    if (!this.auth) return null;
    try {
      await this.ensurePersistenceReady();
      const result = await firebaseSignInWithCredential(this.auth, credential);
      return result.user;
    } catch (error) {
      console.error("Error signing in with credential:", error);
      return null;
    }
  }

  async signInWithGoogle(): Promise<User | null> {
    if (!this.auth) return null;
    const provider = new GoogleAuthProvider();
    try {
      await this.ensurePersistenceReady();
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      return null;
    }
  }

  async handleRedirectResult(): Promise<User | null> {
    if (!this.auth) return null;
    try {
      await this.ensurePersistenceReady();
      const result = await getRedirectResult(this.auth);
      return result ? result.user : null;
    } catch (error) {
      console.error("Error handling redirect result:", error);
      return null;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    if (!this.auth) {
      console.error("Firebase Auth not initialized.");
      return;
    }
    try {
      await firebaseSignOut(this.auth);
    } catch (error) {
      console.error("Error during sign-out:", error);
    }
  }

  // Listen for auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    if (!this.auth) {
      // If auth isn't ready, wait for it and then register the callback
      this.onAuthReady(() => {
        if (this.auth) {
          const unsubscribe = firebaseOnAuthStateChanged(this.auth, callback);
        }
      });
      return () => { }; // return empty cleanup for now
    }
    return firebaseOnAuthStateChanged(this.auth, callback);
  }

  // Add a new history entry for a user
  async addHistoryEntry(userId: string, url: string, title: string): Promise<void> {
    if (!this.firestore) {
      console.error("Firebase Firestore not initialized.");
      return;
    }
    try {
      if (!userId) {
        throw new Error("User ID is required to add a history entry.");
      }
      const historyCollectionRef = collection(this.firestore, `users/${userId}/history`);
      await addDoc(historyCollectionRef, {
        url,
        title,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding history entry:", error);
    }
  }

  // Get a user's history
  async getHistory(userId: string): Promise<Array<{ id: string; url: string; title: string; timestamp: Timestamp }>> {
    if (!this.firestore) {
      console.error("Firebase Firestore not initialized.");
      return [];
    }
    try {
      if (!userId) {
        throw new Error("User ID is required to get history.");
      }
      const historyCollectionRef = collection(this.firestore, `users/${userId}/history`);
      const q = query(historyCollectionRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{ id: string; url: string; title: string; timestamp: Timestamp }>;
    } catch (error) {
      console.error("Error getting history:", error);
      return [];
    }
  }
}

const firebaseService = new FirebaseService();
export default firebaseService;
