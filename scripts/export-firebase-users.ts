import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import admin from 'firebase-admin';
import * as fs from 'fs';
import path from 'path';

// Initialise Firebase Admin SDK – it will pick credentials from env vars or GOOGLE_APPLICATION_CREDENTIALS
// Initialise Firebase Admin SDK – try a service‑account JSON file first, then fall back to env vars or ADC
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  // Build credential from individual env vars (private key may contain escaped newlines)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
} else {
  // Fallback to Application Default Credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS)
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

async function exportAllUsers() {
  const users: any[] = [];
  let nextPageToken: string | undefined;

  // Fetch Firestore user documents for role information
  const snapshot = await admin.firestore().collection('users').get();
  const roleMap: Record<string, string> = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.role) {
      roleMap[doc.id] = data.role as string;
    }
  });

  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    result.users.forEach(u => {
      const role = roleMap[u.uid];
      const customClaims = u.customClaims || {};
      if (role) {
        customClaims.role = role;
      }
      
      users.push({
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        displayName: u.displayName,
        photoURL: u.photoURL,
        phoneNumber: u.phoneNumber,
        passwordHash: u.passwordHash ? Buffer.from(u.passwordHash).toString('base64') : undefined,
        passwordSalt: u.passwordSalt ? Buffer.from(u.passwordSalt).toString('base64') : undefined,
        customClaims: Object.keys(customClaims).length > 0 ? customClaims : undefined,
        providerData: u.providerData,
      });
    });
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  const outPath = path.resolve(process.cwd(), 'firebase-users.json');
  fs.writeFileSync(outPath, JSON.stringify(users, null, 2));
  console.log(`✅ Exported ${users.length} users to ${outPath}`);
}

exportAllUsers().catch(err => {
  console.error('❌ Failed to export users:', err);
  process.exit(1);
});
