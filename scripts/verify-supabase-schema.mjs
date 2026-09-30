#!/usr/bin/env node
/**
 * Verifikasi Skema Supabase
 * =========================
 * Membaca semua file di `supabase/migrations/*.sql`, mengekstrak daftar tabel
 * yang seharusnya ada, lalu memeriksa apakah tabel tersebut benar-benar ada
 * di project Supabase remote (via PostgREST).
 *
 * Pemakaian:
 *   node scripts/verify-supabase-schema.mjs            # pakai .env.local
 *   node scripts/verify-supabase-schema.mjs --verbose  # tampilkan jumlah baris
 *
 * Exit code:
 *   0 = semua tabel ada
 *   1 = ada tabel yang belum di-apply
 *   2 = konfigurasi env tidak lengkap
 *
 * Catatan: skrip ini hanya membaca (SELECT), tidak pernah mengubah data.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// --- Muat .env.local tanpa dependensi eksternal ------------------------------
function loadEnvFile(path) {
  try {
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Buang tanda kutip pembungkus
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local opsional; env bisa datang dari shell / CI
  }
}

loadEnvFile(join(ROOT, '.env.local'));
loadEnvFile(join(ROOT, '.env'));

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).replace(/\/+$/, '');

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('✗ Konfigurasi tidak lengkap.');
  console.error('  Butuh NEXT_PUBLIC_SUPABASE_URL dan salah satu key Supabase di .env.local');
  process.exit(2);
}

const usingServiceKey = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

// --- Ekstrak tabel yang diharapkan dari file migrasi -------------------------
// Cocok untuk:  CREATE TABLE IF NOT EXISTS public.foo (
//               CREATE TABLE IF NOT EXISTS public."warehouseStock" (
//               create table if not exists public."Foo" (
const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?public\s*\.\s*(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;

function collectExpectedTables() {
  const expected = new Map(); // nama -> [file migrasi]
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // Buang komentar baris agar tidak salah tangkap
    const stripped = sql.replace(/^\s*--.*$/gm, '');
    let match;
    while ((match = CREATE_TABLE_RE.exec(stripped)) !== null) {
      const table = match[1] || match[2];
      if (!expected.has(table)) expected.set(table, []);
      expected.get(table).push(file);
    }
  }
  return { expected, files };
}

// --- Cek keberadaan tabel via PostgREST -------------------------------------
async function checkTable(table) {
  // limit=0 + Prefer count=exact -> tidak menarik baris, tapi dapat jumlahnya
  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'count=exact',
      },
    });
  } catch (error) {
    return { status: 'error', message: String(error?.message || error) };
  }

  if (response.status === 404) {
    const body = await response.json().catch(() => ({}));
    // PGRST205 = tabel tidak ada di schema cache
    if (body?.code === 'PGRST205') return { status: 'missing' };
    return { status: 'missing' };
  }

  if (response.status === 200 || response.status === 206) {
    const range = response.headers.get('content-range'); // contoh: 0-0/42
    const total = range?.includes('/') ? Number(range.split('/')[1]) : null;
    return { status: 'exists', rows: Number.isFinite(total) ? total : null };
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.text().catch(() => '');
    return { status: 'denied', httpStatus: response.status, body: body.slice(0, 160) };
  }

  const body = await response.text().catch(() => '');
  return { status: 'error', message: `HTTP ${response.status} ${body.slice(0, 160)}` };
}

// --- Main -------------------------------------------------------------------
const verbose = process.argv.includes('--verbose');
const { expected, files } = collectExpectedTables();

console.log('Verifikasi Skema Supabase');
console.log('=========================');
console.log(`Project   : ${SUPABASE_URL}`);
console.log(`Key       : ${usingServiceKey ? 'service/secret (bypass RLS)' : 'publishable/anon (RLS aktif)'}`);
console.log(`Migrasi   : ${files.length} file -> ${expected.size} tabel didefinisikan`);
console.log('');

const missing = [];
const denied = [];
const errors = [];

for (const [table, sources] of [...expected.entries()].sort()) {
  const result = await checkTable(table);
  const source = sources.join(', ');

  if (result.status === 'exists') {
    const rowInfo = verbose ? ` (${result.rows ?? '?'} baris)` : '';
    console.log(`  ✓ ${table}${rowInfo}`);
  } else if (result.status === 'missing') {
    console.log(`  ✗ ${table}  <- BELUM ADA  [${source}]`);
    missing.push({ table, source });
  } else if (result.status === 'denied') {
    console.log(`  ⚠ ${table}  (HTTP ${result.httpStatus}, kemungkinan ada tapi RLS menolak key ini)`);
    denied.push({ table, httpStatus: result.httpStatus });
  } else {
    console.log(`  ! ${table}  (${result.message})`);
    errors.push({ table, message: result.message });
  }
}

console.log('');
console.log('Ringkasan');
console.log('---------');
console.log(`  ada        : ${expected.size - missing.length - errors.length - denied.length}`);
console.log(`  belum ada  : ${missing.length}`);
console.log(`  ditolak    : ${denied.length}`);
console.log(`  error      : ${errors.length}`);

if (missing.length > 0) {
  console.log('');
  console.log('Tabel yang belum ada perlu di-apply. Cara tercepat:');
  console.log('  Supabase Dashboard > SQL Editor > tempel isi file migrasi > Run');
  console.log('  atau: supabase link --project-ref <ref> && supabase db push');
  console.log('');
  console.log('File migrasi yang belum ter-apply:');
  for (const file of [...new Set(missing.flatMap((m) => m.source.split(', ')))].sort()) {
    console.log(`  - supabase/migrations/${file}`);
  }
}

process.exit(missing.length > 0 || errors.length > 0 ? 1 : 0);
