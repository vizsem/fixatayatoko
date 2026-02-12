import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import {
  Firestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 1. Inisialisasi App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Sempurnakan Firestore dengan Persistent Cache (PENTING)
// Ini membuat data produk tetap bisa diakses saat internet lambat/mati (Offline Support)
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(), // Mendukung banyak tab terbuka sekaligus
  }),
});

// 3. Ekspor Instance Storage & Auth
export const storage: FirebaseStorage = getStorage(app);
export const auth: Auth = getAuth(app);

// 4. Set Persistence Auth (PENTING)
// Agar user tidak perlu login ulang setiap kali browser ditutup
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence);
}

export default app;