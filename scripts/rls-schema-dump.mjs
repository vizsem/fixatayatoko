#!/usr/bin/env node
/**
 * Dump skema nyata dari PostgREST OpenAPI + periksa apakah tabel `settings`
 * membocorkan rahasia ke pengunjung tanpa login (anon).
 *
 * Skrip ini SENGAJA tidak pernah mencetak nilai rahasia. Untuk field yang
 * dicurigai, hanya dicetak: ada/tidak, panjang, dan apakah terlihat seperti
 * kunci API. Jadi aman dijalankan dan hasilnya bisa dibagikan.
 *
 *   node scripts/rls-schema-dump.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const text = readFileSync(resolve(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

/** Nama field yang isinya rahasia. Nilai TIDAK pernah dicetak. */
const SECRET_PATTERN = /key|secret|token|password|pass|signature|private|credential|auth/i;
/** Nama field yang berisi data bank / uang. */
const PAYMENT_PATTERN = /bank|rekening|account|midtrans|xendit|payment|va\b|merchant/i;

function classify(name, value) {
  if (value === null || value === undefined) return 'null';
  const t = typeof value;
  if (t !== 'string') return `${t}`;
  if (value.length === 0) return 'string kosong';
  return `string(${value.length})`;
}

function riskFor(name) {
  if (SECRET_PATTERN.test(name)) return 'RAHASIA';
  if (PAYMENT_PATTERN.test(name)) return 'PEMBAYARAN';
  return null;
}

async function getSpec() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const spec = await res.json();
  return spec.definitions || spec.components?.schemas || {};
}

async function main() {
  const schemas = await getSpec();
  const names = Object.keys(schemas).sort();

  console.log(`=== SKEMA NYATA (${names.length} tabel) ===`);
  console.log('Diambil dari spesifikasi PostgREST, jadi ini kolom yang benar-benar ada.');
  console.log('TIPE IKUT DICETAK: jangan pernah mengasumsikan tipe kolom. `users.id`');
  console.log('ternyata uuid, sedangkan tabel lain memakai text — perbedaan itu pernah');
  console.log('membuat migration gagal dengan "operator does not exist: uuid = text".');
  console.log('');

  const out = [];
  const uuidColumns = [];
  for (const name of names) {
    const props = schemas[name].properties || {};
    const cols = Object.entries(props).map(([col, def]) => {
      const type = def?.format ? `${def.type ?? 'string'}:${def.format}` : String(def?.type ?? '?');
      if (type.includes('uuid')) uuidColumns.push(`${name}.${col}`);
      return `${col}:${type}`;
    });
    out.push(`${name} (${cols.length} kolom):`);
    out.push(`    ${cols.join(', ')}`);
  }
  out.forEach((l) => console.log(l));

  console.log('');
  console.log('=== KOLOM BERTIPE uuid (harus dibandingkan dengan auth.uid() TANPA ::text) ===');
  if (uuidColumns.length === 0) {
    console.log('(tidak ada)');
  } else {
    uuidColumns.forEach((c) => console.log(`  ${c}`));
  }

  // --- Pemeriksaan kebocoran `settings` lewat anon -------------------------
  console.log('');
  console.log('=== APAKAH `settings` MEMBOCORKAN RAHASIA KE ANON? ===');

  const asAnon = await fetch(`${url}/rest/v1/settings?select=*`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const rows = await asAnon.json();

  if (!Array.isArray(rows)) {
    console.log('Gagal baca sebagai anon:', JSON.stringify(rows));
    return;
  }

  console.log(`Anon membaca ${rows.length} baris dari \`settings\`.`);
  console.log('');

  if (rows.length === 0) {
    console.log('Tidak ada baris yang terbaca. Aman untuk sekarang.');
    return;
  }

  for (const row of rows) {
    const id = row.id ?? row.raw_data?.id ?? '(tanpa id)';
    console.log(`  --- dokumen id="${id}" ---`);
    const flat = flatten(row);
    const flagged = [];
    for (const [path, value] of Object.entries(flat)) {
      const risk = riskFor(path);
      const desc = classify(path, value);
      if (risk) {
        flagged.push(`    [${risk}] ${path} -> ${desc}`);
      }
    }
    const top = Object.keys(row);
    console.log(`    kolom: ${top.join(', ')}`);
    if (flagged.length === 0) {
      console.log('    Tidak ada nama field yang menyerupai rahasia.');
    } else {
      flagged.forEach((f) => console.log(f));
      console.log('    CATATAN: nama kolom seperti `key`/`periodKey` juga cocok dengan pola');
      console.log('    "rahasia", jadi periksa dulu sebelum menyimpulkan ada kebocoran.');
    }
  }

  // --- Data yang dibutuhkan untuk merancang policy -------------------------
  console.log('');
  console.log('=== NILAI PERAN YANG BENAR-BENAR ADA DI `users.role` ===');
  const usersRes = await fetch(`${url}/rest/v1/users?select=role`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const userRows = await usersRes.json();
  if (Array.isArray(userRows)) {
    const tally = {};
    for (const r of userRows) {
      const role = r.role === null ? '(null)' : String(r.role);
      tally[role] = (tally[role] || 0) + 1;
    }
    console.log(`Total baris users: ${userRows.length}`);
    for (const [role, n] of Object.entries(tally).sort()) {
      console.log(`  ${role.padEnd(20)} ${n}`);
    }
    console.log('Daftar ini yang harus dipakai di dalam policy, bukan tebakan.');
  } else {
    console.log('Gagal baca daftar peran:', JSON.stringify(userRows));
  }
}

/** Ratakan objek bertingkat jadi map "path" -> nilai (dibatasi kedalamannya). */
function flatten(obj, prefix = '', depth = 0, sink = {}) {
  if (depth > 4 || obj === null || typeof obj !== 'object') return sink;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, path, depth + 1, sink);
    } else if (Array.isArray(v)) {
      sink[`${path}[]`] = `array(${v.length})`;
      if (v.length && typeof v[0] === 'object' && v[0] !== null) {
        flatten(v[0], `${path}[0]`, depth + 1, sink);
      }
    } else {
      sink[path] = v;
    }
  }
  return sink;
}

main().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
