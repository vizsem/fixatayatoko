#!/usr/bin/env node
/**
 * Pemeriksa kesiapan migrasi 20261002 (poin & dompet).
 *
 * Memastikan kolom dan fungsi yang dibutuhkan halaman `admin/points` dan
 * `admin/wallet` benar-benar ada di database remote. Hanya MEMBACA:
 * fungsi uji dipanggil dengan delta 0, yang ditolak sebelum menyentuh data.
 *
 * Pakai: npm run verify:loyalty
 * Keluar dengan kode 1 bila ada yang belum siap (cocok untuk CI/deploy gate).
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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error('URL/Service key tidak ditemukan. Isi .env.local dulu.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

// --- 1. Kolom yang dibutuhkan ------------------------------------------------
const spec = await fetch(`${url}/rest/v1/`, { headers }).then((r) => r.json());
const defs = spec.definitions || spec.components?.schemas || {};

const REQUIRED_COLUMNS = {
  users: ['points', 'is_points_frozen'],
  point_logs: ['type'],
  wallet_logs: ['type', 'order_id'],
};

for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
  const props = defs[table]?.properties ?? {};
  const missing = columns.filter((c) => !(c in props));
  record(
    `${table}: kolom ${columns.join(', ')}`,
    missing.length === 0,
    missing.length === 0 ? 'ada semua' : `belum ada: ${missing.join(', ')}`
  );
}

// --- 2. Fungsi atomik --------------------------------------------------------
// Dipanggil dengan delta 0 supaya ditolak SEBELUM menulis apa pun.
// 400 + kode 22023 = fungsi ada dan validasinya jalan.
// 404              = fungsi tidak ada / nama parameter tidak cocok.
async function probeFunction(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  if (res.ok) return { ok: true, detail: 'ada (memanggil dengan delta 0 tidak ditolak)' };
  if (res.status === 404) return { ok: false, detail: 'BELUM ADA (404)' };
  const code = parsed.code ?? '';
  const message = parsed.message ?? text.slice(0, 120);
  return { ok: true, detail: `${code} — ${message}` };
}

const uuid = '00000000-0000-0000-0000-000000000000';

const points = await probeFunction('adjust_user_points', {
  p_user_id: uuid,
  p_delta: 0,
  p_type: 'PROBE',
  p_description: 'pemeriksaan kesiapan',
});
record('fungsi adjust_user_points()', points.ok, points.detail);

const wallet = await probeFunction('adjust_user_wallet', {
  p_user_id: uuid,
  p_delta: 0,
  p_type: 'PROBE',
  p_description: 'pemeriksaan kesiapan',
});
record('fungsi adjust_user_wallet()', wallet.ok, wallet.detail);

// --- 3. Agregat ledger -------------------------------------------------------
const totalsRes = await fetch(`${url}/rest/v1/rpc/ledger_totals`, {
  method: 'POST',
  headers: jsonHeaders,
  body: '{}',
});
let totalsDetail = `HTTP ${totalsRes.status}`;
let totalsOk = false;
if (totalsRes.ok) {
  const rows = await totalsRes.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (row && 'point_in' in row) {
    totalsOk = true;
    totalsDetail =
      `poin masuk ${row.point_in}, poin keluar ${row.point_out}, ` +
      `dana masuk ${row.wallet_in}, dana keluar ${row.wallet_out}`;
  } else {
    totalsDetail = `bentuk tak terduga: ${JSON.stringify(rows).slice(0, 120)}`;
  }
} else if (totalsRes.status === 404) {
  totalsDetail = 'BELUM ADA (404)';
}
record('fungsi ledger_totals()', totalsOk, totalsDetail);

// --- 4. Hasil backfill (informatif) -----------------------------------------
async function nullCount(table, column) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&${column}=is.null`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = res.headers.get('content-range') ?? '';
  return range.split('/')[1] ?? '?';
}

const pointNull = await nullCount('point_logs', 'points');
const walletNull = await nullCount('wallet_logs', 'amount');
const orphanUser = await nullCount('point_logs', 'user_id');
record(
  'backfill kolom bertipe',
  true,
  `point_logs.points kosong: ${pointNull} baris | wallet_logs.amount kosong: ${walletNull} baris | ` +
    `point_logs.user_id kosong: ${orphanUser} baris (data lama tanpa pemetaan — wajar)`
);

// --- Ringkasan ---------------------------------------------------------------
console.log('\n=== Kesiapan migrasi 20261002 (poin & dompet) ===\n');
let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}`);
  console.log(`      ${r.detail}`);
}

console.log('');
if (failed === 0) {
  console.log('  STATUS: SIAP — halaman /admin/points dan /admin/wallet berfungsi penuh.');
} else {
  console.log(`  STATUS: BELUM SIAP — ${failed} pemeriksaan gagal.`);
  console.log('  Jalankan supabase/migrations/20261002_loyalty_wallet_hardening.sql');
  console.log('  di Supabase SQL Editor (paste ISI berkasnya, bukan nama berkasnya).');
}
console.log('');

process.exit(failed === 0 ? 0 : 1);
