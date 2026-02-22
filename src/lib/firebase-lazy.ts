// Firebase lazy loading utility untuk mengurangi bundle size
import { FirebaseApp } from 'firebase/app';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy-loaded instances
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export const getFirebaseApp = async (): Promise<FirebaseApp> => {
  if (!app) {
    const { initializeApp } = await import('firebase/app');
    app = initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseAuth = async (): Promise<Auth> => {
  if (!authInstance) {
    const { getAuth } = await import('firebase/auth');
    const app = await getFirebaseApp();
    authInstance = getAuth(app);
  }
  return authInstance;
};

export const getFirestoreDB = async (): Promise<Firestore> => {
  if (!dbInstance) {
    const { getFirestore } = await import('firebase/firestore');
    const app = await getFirebaseApp();
    dbInstance = getFirestore(app);
  }
  return dbInstance;
};

export const getFirebaseStorage = async (): Promise<FirebaseStorage> => {
  if (!storageInstance) {
    const { getStorage } = await import('firebase/storage');
    const app = await getFirebaseApp();
    storageInstance = getStorage(app);
  }
  return storageInstance;
};

// Utility untuk mendapatkan semua services sekaligus
export const getFirebaseServices = async () => {
  const [authInstance, dbInstance, storageInstance] = await Promise.all([
    getFirebaseAuth(),
    getFirestoreDB(),
    getFirebaseStorage(),
  ]);
  
  return {
    auth: authInstance,
    db: dbInstance,
    storage: storageInstance,
  };
};

// Cleanup function untuk development
export const cleanupFirebase = () => {
  app = null;
  authInstance = null;
  dbInstance = null;
  storageInstance = null;
};