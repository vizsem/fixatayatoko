import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validate required Supabase env variables
if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is missing in .env.local');
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

type FirebaseUser = {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  passwordHash?: string;     // base64 string
  passwordSalt?: string;     // base64 string (unused for bcrypt)
  customClaims?: Record<string, any>;
  providerData?: any[];
};

async function importUser(u: FirebaseUser) {
  const password = u.passwordHash ? 'AtayaToko2026!' : undefined;

  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    phone: u.phoneNumber,
    password: password,
    email_confirm: u.emailVerified, // set to true if email verified
    app_metadata: {
      role: u.customClaims?.role ?? 'user',
      // you can spread other custom claims here
    },
    user_metadata: {
      full_name: u.displayName,
      avatar_url: u.photoURL,
      providers: u.providerData?.map(p => p.providerId),
    },
    // optional: set the user ID to match Firebase UID (helps with references)
    // Supabase currently does not allow custom IDs, so you may store the old UID in metadata
    //   or create a mapping table in your own DB.
  });

  if (error) {
    console.error(`Failed to import ${u.email ?? u.uid}:`, error.message);
  } else {
    console.log(`Imported ${u.email ?? u.uid}`);
  }
}

async function main() {
  const users: FirebaseUser[] = JSON.parse(
    fs.readFileSync('firebase-users.json', 'utf-8')
  );

  for (const u of users) {
    await importUser(u);
    // optional: add a small delay to respect rate limits (e.g., 200 ms)
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(console.error);
