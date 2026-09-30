#!/usr/bin/env node
/**
 * Skrip diagnostik: tampilkan kolom asli sebuah tabel di Supabase.
 *
 * Memakai REST (PostgREST) sehingga TIDAK butuh koneksi Postgres langsung.
 * Hanya membaca (GET), tidak pernah menulis.
 *
 * Pakai: node scripts/inspect-columns.mjs users point_logs wallet_logs
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

const tables = process.argv.slice(2).filter((a) => a !== '--count' && !a.startsWith('--limit='));
const countOnly = process.argv.includes('--count');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const rowLimit = limitArg ? Number(limitArg.split('=')[1]) : 3;
if (tables.length === 0) {
  console.error('Sebutkan minimal satu nama tabel.');
  process.exit(1);
}

for (const table of tables) {
  if (countOnly) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    });
    const total = (res.headers.get('content-range') || '').split('/')[1];
    console.log(`- ${table}: ${res.ok ? total ?? '?' : `HTTP ${res.status}`} baris`);
    continue;
  }

  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=${rowLimit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.log(`- ${table}: respons bukan JSON (HTTP ${res.status})`);
    continue;
  }
  if (!res.ok) {
    console.log(`- ${table}: HTTP ${res.status} -> ${JSON.stringify(parsed).slice(0, 200)}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    console.log(`- ${table}: bentuk tak terduga -> ${JSON.stringify(parsed).slice(0, 200)}`);
    continue;
  }
  const cols = parsed.length > 0 ? Object.keys(parsed[0]).sort() : [];
  console.log(`- ${table}: ${parsed.length === 0 ? 'KOSONG (kolom tak terbaca)' : `${cols.length} kolom`}`);
  if (cols.length) console.log(`    ${cols.join(', ')}`);
  for (const [i, row] of parsed.slice(0, rowLimit).entries()) {
    const shown = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === 'string' && v.length > 90 ? `${v.slice(0, 90)}…` : v,
      ])
    );
    console.log(`    contoh[${i}]: ${JSON.stringify(shown)}`);
  }
}
