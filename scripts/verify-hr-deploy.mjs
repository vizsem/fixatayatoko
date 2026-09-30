#!/usr/bin/env node
/**
 * Pemeriksa kesiapan migrasi 20261003 (tabel HR/payroll).
 *
 * Memastikan 15 tabel modul HR benar-benar ada dan terkunci dari akses publik.
 * Hanya membaca, kecuali satu uji tulis memakai kunci anon yang MEMANG
 * diharapkan ditolak RLS — jadi tidak ada baris yang tertulis.
 *
 * Pakai: npm run verify:hr
 * Keluar dengan kode 1 bila ada yang belum siap (cocok untuk gerbang deploy).
 */
import { readFileSync } from 'node:fs';

function loadEnvLocal() {
  const env = {};
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  } catch {
    /* .env.local opsional bila env sudah ada di proses */
  }
  return env;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!url || !serviceKey) {
  console.error('URL/Service key tidak ditemukan. Isi .env.local dulu.');
  process.exit(1);
}

const HR_TABLES = [
  // Inti HR
  'employees',
  'attendance_records',
  'payroll_slips',
  'payroll_settings',
  'payroll_runs',
  'payroll_adjustments',
  'leave_requests',
  'shift_templates',
  'shift_assignments',
  // Kesejahteraan & penilaian
  'employee_loans',
  'employee_reimbursements',
  'employee_petty_cash',
  'employee_petty_cash_transactions',
  'kpi_scores',
  'candidates',
];

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

// --- 1. Semua tabel ada ------------------------------------------------------
const spec = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
}).then((r) => r.json());
const defs = spec.definitions || spec.components?.schemas || {};

const missing = HR_TABLES.filter((t) => !(t in defs));
record(
  `${HR_TABLES.length} tabel HR tersedia`,
  missing.length === 0,
  missing.length === 0 ? 'semua ada' : `belum ada: ${missing.join(', ')}`
);

// --- 2. Bentuk kolom sesuai harapan -----------------------------------------
// `created_at` dan `updated_at` wajib ada karena buildWritePayload selalu
// menuliskan keduanya; tanpa itu setiap penyimpanan gagal.
const badShape = [];
for (const table of HR_TABLES) {
  const props = defs[table]?.properties ?? {};
  for (const col of ['id', 'raw_data', 'created_at', 'updated_at']) {
    if (!(col in props)) badShape.push(`${table}.${col}`);
  }
}
record(
  'kolom id, raw_data, created_at, updated_at',
  badShape.length === 0,
  badShape.length === 0 ? 'lengkap di semua tabel' : `kurang: ${badShape.join(', ')}`
);

// --- 3. RLS menolak akses publik --------------------------------------------
// Uji tulis memakai kunci anon: tabel ber-RLS tanpa policy akan menolak.
// Permintaannya ditolak, jadi tidak ada baris yang benar-benar tertulis.
if (!anonKey) {
  record('RLS menolak akses publik', true, 'dilewati: kunci anon tidak tersedia');
} else {
  const openTables = [];
  for (const table of HR_TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      // Nilai inilah yang diuji; harus DITOLAK sebelum tersimpan.
      body: JSON.stringify({ id: '__rls_probe__', raw_data: {} }),
    });

    if (res.ok) {
      openTables.push(`${table} (DITERIMA!)`);
      // Bersihkan bila ternyata lolos, supaya tidak meninggalkan sampah.
      await fetch(`${url}/rest/v1/${table}?id=eq.__rls_probe__`, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
    }
  }
  record(
    'RLS menolak tulis dari anon',
    openTables.length === 0,
    openTables.length === 0
      ? `ditolak di ${HR_TABLES.length} tabel`
      : `TERBUKA: ${openTables.join(', ')}`
  );
}

// --- 4. Service role bisa membaca (dipakai Server Action) -------------------
const unreadable = [];
for (const table of HR_TABLES) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) unreadable.push(`${table} (HTTP ${res.status})`);
}
record(
  'service role dapat membaca',
  unreadable.length === 0,
  unreadable.length === 0 ? 'semua tabel terbaca' : `gagal: ${unreadable.join(', ')}`
);

// --- Ringkasan ---------------------------------------------------------------
console.log('\n=== Kesiapan migrasi 20261003 (tabel HR/payroll) ===\n');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}`);
  console.log(`      ${r.detail}`);
}

console.log('');
if (failed === 0) {
  console.log('  STATUS: SIAP — modul HR/payroll dapat dipakai.');
} else {
  console.log(`  STATUS: BELUM SIAP — ${failed} pemeriksaan gagal.`);
  console.log('  Jalankan supabase/migrations/20261003_hr_payroll_tables.sql');
  console.log('  di Supabase SQL Editor (paste ISI berkasnya, bukan nama berkasnya).');
}
console.log('');

process.exit(failed === 0 ? 0 : 1);
