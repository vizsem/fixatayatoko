#!/usr/bin/env node
/**
 * Audit RLS: mengukur apa yang sebenarnya BISA dibaca oleh tiap peran.
 *
 * Kenapa skrip ini ada:
 * Halaman admin di aplikasi ini memanggil Supabase dari browser. `supabase-helpers`
 * memakai `supabaseAdmin` dengan `persistSession: false`, sehingga di browser
 * permintaan dikirim sebagai role `anon` dan RLS menolak — halaman jadi kosong.
 *
 * Untuk memutuskan policy RLS mana yang perlu ditulis, kita harus mengukur dulu,
 * bukan menebak. Skrip ini membandingkan tiga peran:
 *   1. anon                     -> pengunjung tanpa login
 *   2. authenticated            -> pengguna login, belum tentu punya baris di `users`
 *   3. authenticated + admin    -> pengguna login dengan baris `users.role = 'admin'`
 *
 * Cara pakai:
 *   node scripts/rls-audit.mjs
 *   node scripts/rls-audit.mjs --keep-user   (jangan hapus akun uji; untuk debug)
 *
 * Akun uji yang dibuat SELALU dihapus di akhir, termasuk saat terjadi error.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const keepUser = process.argv.includes('--keep-user');

// --- Konfigurasi -----------------------------------------------------------

function loadEnv() {
  const text = readFileSync(resolve(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('Env tidak lengkap. Butuh NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const TEMP_EMAIL = `rls-audit-temp-${Date.now()}@example.com`;
const TEMP_PASSWORD = `Tmp-${Math.random().toString(36).slice(2)}-${Date.now()}!A9`;

// --- Helper HTTP -----------------------------------------------------------

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Daftar tabel yang terekspos PostgREST, diambil dari spesifikasi OpenAPI. */
async function listExposedTables() {
  const res = await fetch(`${url}/rest/v1/`, { headers: headers(serviceKey) });
  if (!res.ok) throw new Error(`Gagal ambil skema OpenAPI: HTTP ${res.status}`);
  const spec = await res.json();
  const schemas = spec.definitions || spec.components?.schemas || {};
  return Object.keys(schemas).sort();
}

/**
 * Coba baca 1 baris dengan kunci tertentu.
 * Mengembalikan { status, rows, code } — rows = jumlah baris yang benar-benar terlihat.
 */
async function probe(table, key, token) {
  const authHeader = token ? `Bearer ${token}` : `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  const code = body && !Array.isArray(body) ? body.code : undefined;
  const rows = Array.isArray(body) ? body.length : 0;
  return { status: res.status, rows, code };
}

// --- Akun uji --------------------------------------------------------------

async function createTempUser() {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: headers(serviceKey),
    body: JSON.stringify({
      email: TEMP_EMAIL,
      password: TEMP_PASSWORD,
      email_confirm: true,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Gagal buat user uji: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.id || body.user?.id;
}

async function signIn() {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(anonKey),
    body: JSON.stringify({ email: TEMP_EMAIL, password: TEMP_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Gagal login user uji: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

/** Beri baris di `users` dengan role admin, supaya policy berbasis peran ikut teruji. */
async function grantAdminRow(uid) {
  const res = await fetch(`${url}/rest/v1/users`, {
    method: 'POST',
    headers: headers(serviceKey, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ id: uid, role: 'admin', email: TEMP_EMAIL, name: 'RLS Audit (sementara)' }),
  });
  return res.ok;
}

async function cleanup(uid) {
  const steps = [];
  if (uid) {
    const delRow = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: headers(serviceKey, { Prefer: 'return=minimal' }),
    });
    steps.push(`hapus baris users: HTTP ${delRow.status}`);

    const delUser = await fetch(`${url}/auth/v1/admin/users/${uid}`, {
      method: 'DELETE',
      headers: headers(serviceKey),
    });
    steps.push(`hapus user auth: HTTP ${delUser.status}`);
  }
  return steps;
}

// --- Program utama ---------------------------------------------------------

function fmt(p) {
  const mark = p.rows > 0 ? 'LIHAT' : p.status === 200 ? 'kosong' : `HTTP ${p.status}`;
  const code = p.code ? ` (${p.code})` : '';
  return `${mark}${code}`.padEnd(22);
}

async function main() {
  console.log(`Proyek : ${url}`);
  console.log('');

  const tables = await listExposedTables();
  console.log(`Tabel terekspos PostgREST: ${tables.length}`);
  console.log('');

  let uid = null;
  let token = null;
  let adminRowOk = false;

  try {
    uid = await createTempUser();
    token = await signIn();

    console.log('--- Matriks akses baca (limit 1 baris) ---');
    console.log(
      'tabel'.padEnd(30) + 'anon'.padEnd(22) + 'authenticated'.padEnd(22) + 'auth+admin'
    );
    console.log('-'.repeat(30 + 22 + 22 + 12));

    // Tahap 1: anon dan authenticated TANPA baris di `users`.
    // Penting: baris admin belum dibuat di sini, supaya perbedaan keduanya nyata.
    const results = [];
    for (const table of tables) {
      const asAnon = await probe(table, anonKey, null);
      const asAuth = await probe(table, anonKey, token);
      results.push({ table, asAnon, asAuth, asAdmin: null });
    }

    // Tahap 2: baru beri peran admin, lalu ukur ulang.
    adminRowOk = await grantAdminRow(uid);
    if (!adminRowOk) {
      console.log('! Gagal memberi baris users.role=admin; kolom auth+admin tidak bermakna.');
    }
    for (const row of results) {
      row.asAdmin = await probe(row.table, anonKey, token);
    }

    for (const r of results) {
      console.log(
        r.table.padEnd(30) +
          fmt(r.asAnon) +
          fmt(r.asAuth) +
          fmt(r.asAdmin)
      );
    }

    // Ringkasan kesimpulan.
    const anonReadable = results.filter((r) => r.asAnon.rows > 0).map((r) => r.table);
    const anonDenied = results.filter((r) => r.asAnon.status !== 200).map((r) => r.table);
    const authReadable = results.filter((r) => r.asAuth.rows > 0).map((r) => r.table);
    const adminReadable = results.filter((r) => r.asAdmin.rows > 0).map((r) => r.table);
    const blockedForAdmin = results
      .filter((r) => r.asAdmin.rows === 0 && r.asAdmin.status === 200)
      .map((r) => r.table);

    console.log('');
    console.log('--- Ringkasan ---');
    console.log(`anon bisa baca (ada baris)   : ${anonReadable.length} -> ${anonReadable.join(', ') || '(tidak ada)'}`);
    console.log(`anon ditolak (HTTP != 200)   : ${anonDenied.length} -> ${anonDenied.join(', ') || '(tidak ada)'}`);
    console.log(`authenticated bisa baca      : ${authReadable.length} -> ${authReadable.join(', ') || '(tidak ada)'}`);
    console.log(`auth+admin bisa baca         : ${adminReadable.length} -> ${adminReadable.join(', ') || '(tidak ada)'}`);
    console.log('');
    console.log(`Tabel yang diblokir untuk admin (HTTP 200 tapi 0 baris): ${blockedForAdmin.length}`);
    console.log(`  ${blockedForAdmin.join(', ') || '(tidak ada)'}`);
  } finally {
    if (!keepUser) {
      const steps = await cleanup(uid);
      console.log('');
      console.log('--- Pembersihan akun uji ---');
      steps.forEach((s) => console.log('  ' + s));
    } else {
      console.log('');
      console.log(`--keep-user: akun ${TEMP_EMAIL} (uid ${uid}) DIBIARKAN. Hapus manual.`);
    }
  }
}

main().catch((error) => {
  console.error('Audit gagal:', error.message);
  process.exit(1);
});
