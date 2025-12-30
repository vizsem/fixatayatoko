// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
 NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDV5Oz_zphv8UatLlZssdLkrbHSIZ8fOZI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=atayatoko2.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=atayatoko2
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=atayatoko2.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=405021515196
NEXT_PUBLIC_FIREBASE_APP_ID=1:405021515196:web:3693ba57b852525e435fb9
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-6TPZQ4KX1K

};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };