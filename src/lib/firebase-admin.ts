// src/lib/firebase-admin.ts
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth(); // ✅ Tambahkan ini