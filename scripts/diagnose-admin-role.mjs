#!/usr/bin/env node
/**
 * Diagnostik READ-ONLY: cocokkan akun login (auth.users) dengan baris
 * `public.users` dan perannya.
 *
 * Otorisasi Server Action membaca peran dari `public.users.role`. Kalau sebuah
 * akun login TIDAK punya baris di `public.users`, perannya null -> semua
 * `requireStaff()`/`requireAdmin()` menolak, walau di Supabase Auth terlihat
 * seperti "super admin".
 *
 * Pakai: node scripts/diagnose-admin-role.mjs [email]
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const filterEmail = process.argv[2]?.toLowerCase();

// Peran yang dianggap boleh oleh src/lib/auth-helpers.ts
const ADMIN_ROLES = ['admin', 'superadmin', 'super_admin', 'owner', 'super-admin'];

const { data: usersPage, error: authErr } = await admin.auth.admin.listUsers({ perPage: 200 });
if (authErr) {
  console.error('Gagal membaca auth.users:', authErr.message);
  process.exit(1);
}

const { data: rows, error: rowErr } = await admin.from('users').select('id, role, full_name');
if (rowErr) {
  console.error('Gagal membaca public.users:', rowErr.message);
  process.exit(1);
}

const byId = new Map((rows || []).map((r) => [r.id, r]));

console.log(`auth.users: ${usersPage.users.length} akun | public.users: ${rows?.length ?? 0} baris\n`);
console.log('email'.padEnd(34) + 'public.users?'.padEnd(15) + 'role'.padEnd(14) + 'boleh akses admin?');
console.log('-'.repeat(88));

for (const u of usersPage.users) {
  if (filterEmail && (u.email || '').toLowerCase() !== filterEmail) continue;

  const row = byId.get(u.id);
  const role = row?.role ?? null;
  const appMetaRole = u.app_metadata?.role ?? null;
  const boleh = ADMIN_ROLES.includes(String(role || appMetaRole || '').toLowerCase());

  console.log(
    (u.email || '(tanpa email)').padEnd(34) +
      (row ? 'ya' : 'TIDAK ADA').padEnd(15) +
      String(role || appMetaRole || '(null)').padEnd(14) +
      (boleh ? 'YA' : 'TIDAK')
  );
}

console.log('');
console.log('Baris public.users yang TIDAK punya akun auth (yatim):');
let yatim = 0;
for (const r of rows || []) {
  if (!usersPage.users.some((u) => u.id === r.id)) {
    console.log(`  ${r.id}  role=${r.role ?? '(null)'}  ${r.full_name ?? ''}`);
    yatim++;
  }
}
if (!yatim) console.log('  (tidak ada)');

console.log('');
console.log('Peran yang dianggap admin oleh kode:', ADMIN_ROLES.join(', '));
