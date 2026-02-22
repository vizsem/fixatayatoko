import * as admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  // 1. Coba ambil dari variabel JSON utuh (Prioritas utama untuk Vercel)
  let serviceAccount;
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.error('Error parsing GCP_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Ambil dari variabel individual (Cadangan)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (serviceAccount) {
    // Inisialisasi menggunakan JSON utuh jika tersedia
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('Firebase Admin initialized via GCP_SERVICE_ACCOUNT_KEY');
  } else if (projectId && clientEmail && privateKey) {
    // Inisialisasi menggunakan variabel individual milikmu
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId
    });
    console.log('Firebase Admin initialized via individual env vars');
  } else {
    console.warn('Firebase Admin credentials not fully provided in environment variables.');
    try {
      // Fallback terakhir ke Application Default Credentials
      admin.initializeApp();
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }
}

// Export safe instances
export const adminDb = admin.apps.length > 0 ? admin.firestore() : {} as admin.firestore.Firestore;
export const FieldValue = admin.apps.length > 0 ? admin.firestore.FieldValue : {} as typeof admin.firestore.FieldValue;