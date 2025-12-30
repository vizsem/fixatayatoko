// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ✅ Validasi environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
] as const;

const missingEnvVars = requiredEnvVars.filter(
  key => !process.env[key]
);

if (missingEnvVars.length > 0 && typeof window !== 'undefined') {
  console.warn(
    '[Firebase] Missing environment variables:',
    missingEnvVars
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: ReturnType<typeof initializeApp> | null = null;

// ✅ Hanya inisialisasi sekali
const getAppInstance = () => {
  if (!firebaseApp) {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApp();
    }
  }
  return firebaseApp;
};

export const getAuthInstance = () => {
  const app = getAppInstance();
  return getAuth(app);
};

export const getFirestoreInstance = () => {
  const app = getAppInstance();
  return getFirestore(app);
};