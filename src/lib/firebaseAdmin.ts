import * as admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Handle private key for both dev and prod environments
  const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId // Explicitly set projectId to avoid "Unable to detect a Project Id"
    });
  } else {
    // If credentials are not provided, try to use default application credentials
    // But log a warning because this might fail in some environments (like Vercel without specific setup)
    console.warn('Firebase Admin credentials not fully provided in environment variables.');
    // In Vercel, this fallback often fails with "Unable to detect a Project Id" if env vars are missing.
    // We should only call initializeApp() if we are sure the environment supports ADC,
    // or simply let it throw the error but with a better message if we wrapped it.
    // For now, we'll initialize without args, which causes the reported error if env vars are missing.
    // The solution is to ensure env vars are set in Vercel.
    try {
      admin.initializeApp();
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }
}

// Export safe instances (mock if init failed to prevent build crashes)
// Note: Runtime usage will still fail if init failed, but build/import won't crash immediately.
export const adminDb = admin.apps.length > 0 ? admin.firestore() : {} as admin.firestore.Firestore;
export const FieldValue = admin.apps.length > 0 ? admin.firestore.FieldValue : {} as typeof admin.firestore.FieldValue;
