// compare-firestore-supabase.ts
// Script to compare user data and roles between Firebase Firestore and Supabase.
// It fetches users from Firebase Auth / Firestore and from Supabase auth tables,
// then reports count differences and any mismatched roles.

import admin from 'firebase-admin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Load environment variables (ensure .env.local is loaded when running via ts-node)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FIREBASE_SERVICE_ACCOUNT_PATH) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

// Initialise Firebase Admin SDK
const serviceAccountStr = fs.readFileSync(path.resolve(FIREBASE_SERVICE_ACCOUNT_PATH), 'utf-8');
const serviceAccount = JSON.parse(serviceAccountStr);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialise Supabase client (admin)
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchFirebaseUsers() {
  // Fetch auth users
  const list: admin.auth.UserRecord[] = [];
  let nextPageToken: string | undefined = undefined;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    list.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  // Fetch Firestore user documents for role information
  const snapshot = await admin.firestore().collection('users').get();
  const roleMap: Record<string, string> = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.role) {
      roleMap[doc.id] = data.role as string;
    }
  });

  // Combine auth info with role from Firestore
  const users = list.map(u => ({
    uid: u.uid,
    email: u.email,
    role: roleMap[u.uid] || 'unknown',
  }));
  return users;
}

async function fetchSupabaseUsers() {
  // Supabase stores auth users in the "auth.users" view/table.
  // Use the admin API to bypass PostgREST schema limitations.
  const usersList: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      console.error('Supabase fetch error:', error);
      process.exit(1);
    }
    
    const users = data.users;
    usersList.push(...users);
    if (users.length < 1000) {
      hasMore = false;
    } else {
      page++;
    }
  }

  const users = usersList.map(u => ({
    uid: u.id,
    email: u.email,
    role: u.app_metadata?.role ?? 'unknown',
  }));
  return users;
}

async function compare() {
  const firebase = await fetchFirebaseUsers();
  const supabaseUsers = await fetchSupabaseUsers();

  console.log(`Firebase users: ${firebase.length}`);
  console.log(`Supabase users: ${supabaseUsers.length}`);

  const supabaseMap = new Map(supabaseUsers.map(u => [u.uid, u]));

  const mismatches: string[] = [];
  for (const f of firebase) {
    const s = supabaseMap.get(f.uid);
    if (!s) {
      mismatches.push(`❌ User ${f.uid} (${f.email}) present in Firebase but missing in Supabase`);
    } else if (f.role !== s.role) {
      mismatches.push(`⚠️ Role mismatch for ${f.uid}: Firebase=${f.role}, Supabase=${s.role}`);
    }
  }

  // Detect extra users in Supabase
  const firebaseUids = new Set(firebase.map(u => u.uid));
  for (const s of supabaseUsers) {
    if (!firebaseUids.has(s.uid)) {
      mismatches.push(`❌ User ${s.uid} (${s.email}) present in Supabase but missing in Firebase`);
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ All users and roles match between Firebase and Supabase');
  } else {
    console.log('🔎 Mismatches found:');
    mismatches.forEach(m => console.log(m));
  }
}

compare().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
