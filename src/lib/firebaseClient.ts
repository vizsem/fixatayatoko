import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  initializeFirestore, 
  CACHE_SIZE_UNLIMITED 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 1. Konfigurasi Firebase Anda (Pastikan Env Variables sudah diisi di Vercel/.env)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 2. Inisialisasi App (Singleton Pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 3. Inisialisasi Firestore dengan Custom Settings (Unlimited Cache)
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});

const auth = getAuth(app);

// 4. Aktifkan Fitur Offline (Hanya berjalan di sisi Client/Browser)
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // Biasanya terjadi jika membuka banyak tab sekaligus
      console.warn("Firestore Persistence: Gagal karena banyak tab terbuka.");
    } else if (err.code === "unimplemented") {
      // Browser lama yang tidak mendukung
      console.warn("Firestore Persistence: Browser tidak mendukung fitur offline.");
    }
  });
}

export { app, db, auth };