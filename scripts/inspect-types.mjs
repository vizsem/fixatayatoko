#!/usr/bin/env node
/**
 * Diagnostik: tampilkan kolom + TIPE untuk tabel tertentu, diambil dari
 * spesifikasi OpenAPI yang diterbitkan PostgREST (`GET /rest/v1/`).
 *
 * Ini sumber tipe yang paling akurat yang bisa diakses tanpa koneksi
 * Postgres langsung, dan penting karena skema remote sudah menyimpang dari
 * file migrasi (mis. `point_logs.id` dideklarasikan UUID di migrasi tetapi
 * berisi id gaya Firestore di remote).
 *
 * Pakai: node scripts/inspect-types.mjs point_logs wallet_logs users
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
    /* opsional */
  }
  return env;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('URL/Service key tidak ditemukan.');
  process.exit(1);
}

const wanted = process.argv.slice(2);
if (wanted.length === 0) {
  console.error('Sebutkan nama tabel.');
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`Gagal mengambil spesifikasi OpenAPI: HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
const defs = spec.definitions || spec.components?.schemas || {};

for (const table of wanted) {
  const def = defs[table];
  if (!def) {
    console.log(`- ${table}: tidak ada di spesifikasi PostgREST`);
    continue;
  }
  const props = def.properties || {};
  const rows = Object.entries(props).map(([name, meta]) => {
    const type = meta.format ? `${meta.type}/${meta.format}` : meta.type;
    return `${name}: ${type}`;
  });
  console.log(`- ${table}`);
  for (const r of rows) console.log(`    ${r}`);
}
