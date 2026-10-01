#!/usr/bin/env node
/**
 * Audit cakupan Realtime — READ-ONLY.
 *
 * Menjawab: "tabel mana saja yang dilanggani kode tapi belum masuk publication
 * supabase_realtime?" Tanpa ini, setiap langganan adalah pembaruan yang diam-diam
 * tidak pernah datang (gejala: UI basi sampai reload manual).
 *
 * Cara kerja:
 *  1. Pindai src/ untuk mencari dua bentuk langganan Realtime:
 *       a. `'postgres_changes', { ... table: '<nama>' }`  (langganan langsung)
 *       b. `onSnapshot(collection(db, '<nama>'))` / `doc(db, '<nama>')`
 *          (lewat bridge di src/lib/firebase.ts — bridge memakai
 *           postgres_changes di baliknya)
 *  2. Ambil daftar tabel yang BENAR-BENAR ada di remote (OpenAPI PostgREST).
 *  3. Baca daftar tabel di migrasi 20261006_realtime_publication.sql.
 *  4. Laporkan kesenjangannya.
 *
 * Pakai: node scripts/audit-realtime-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function loadEnvLocal() {
  const env = {};
  try {
    const text = readFileSync(join(ROOT, '.env.local'), 'utf8');
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

// ---------------------------------------------------------------------------
// 1. Pindai kode
// ---------------------------------------------------------------------------
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(p);
  }
})(SRC);

/** table -> Set(daftar file) */
const langganan = new Map();
const dinamis = [];

const add = (table, file) => {
  if (!langganan.has(table)) langganan.set(table, new Set());
  langganan.get(table).add(relative(ROOT, file));
};

/** Ambil argumen pertama sebuah pemanggilan, sadar tanda kurung. */
function argPertama(text, startIdx) {
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) return text.slice(startIdx, i);
      depth--;
    } else if (c === ',' && depth === 0) {
      return text.slice(startIdx, i);
    }
  }
  return text.slice(startIdx);
}

/**
 * Nama tabel yang disebut di sebuah ekspresi.
 *
 * Bridge memetakan subcollection ke segmen TERAKHIR:
 *   collection(db, 'chats', id, 'messages') -> tabel `messages`
 *   collection(db, 'products', id, 'reviews') -> tabel `reviews`
 * (lihat src/lib/firebase.ts). Jadi selalu ambil string terakhir.
 */
function tabelDariEkspresi(expr) {
  const hasil = new Set();
  for (const m of expr.matchAll(/(?:collection|doc)\(\s*db\s*,\s*([^)]*)\)/g)) {
    const bagian = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    if (bagian.length) hasil.add(bagian[bagian.length - 1]);
  }
  return hasil;
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');

  // (a) postgres_changes langsung
  const langsung = /'postgres_changes'\s*,\s*\{([^}]*)\}/gs;
  for (const m of text.matchAll(langsung)) {
    const t = m[1].match(/table:\s*'([A-Za-z_][A-Za-z0-9_]*)'/);
    if (t) add(t[1], file);
    else dinamis.push(`${relative(ROOT, file)}: postgres_changes dengan nama tabel dinamis`);
  }

  // (b) onSnapshot lewat bridge, termasuk yang argumennya variabel.
  //     Bridge (src/lib/firebase.ts) memakai postgres_changes di baliknya.
  const variabel = new Map(); // nama -> Set(tabel)
  // Definisi bisa multi-baris, mis. `const q = query(\n collection(db, 'x'),\n ...);`
  for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g)) {
    const t = tabelDariEkspresi(m[2]);
    if (t.size) variabel.set(m[1], t);
  }

  for (const m of text.matchAll(/\bonSnapshot\s*\(/g)) {
    const arg = argPertama(text, m.index + m[0].length);
    const langsungDariArg = tabelDariEkspresi(arg);

    if (langsungDariArg.size) {
      for (const t of langsungDariArg) add(t, file);
      continue;
    }

    // Argumen berupa variabel (mis. `onSnapshot(q, ...)`).
    const nama = arg.trim().match(/^([A-Za-z_$][\w$]*)$/);
    if (nama && variabel.has(nama[1])) {
      for (const t of variabel.get(nama[1])) add(t, file);
      continue;
    }

    dinamis.push(`${relative(ROOT, file)}: onSnapshot(${arg.trim().slice(0, 40)}...) tidak bisa dilacak`);
  }
}

// ---------------------------------------------------------------------------
// 2. Tabel yang ada di remote
// ---------------------------------------------------------------------------
let tabelRemote = new Set();
if (url && key) {
  const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/', {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.ok) {
    const spec = await res.json();
    const defs = spec?.definitions || spec?.components?.schemas || {};
    tabelRemote = new Set(Object.keys(defs));
  }
}

// ---------------------------------------------------------------------------
// 3. Tabel di migrasi Realtime
// ---------------------------------------------------------------------------
let tabelMigrasi = new Set();
try {
  const mig = readFileSync(join(ROOT, 'supabase/migrations/20261006_realtime_publication.sql'), 'utf8');
  const blok = mig.match(/daftar text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/);
  if (blok) {
    for (const m of blok[1].matchAll(/'([A-Za-z_][A-Za-z0-9_]*)'/g)) tabelMigrasi.add(m[1]);
  }
} catch {
  console.log('PERINGATAN: migrasi 20261006_realtime_publication.sql tidak ditemukan.\n');
}

// ---------------------------------------------------------------------------
// 4. Laporan
// ---------------------------------------------------------------------------
const daftar = [...langganan.keys()].sort();

console.log('=== TABEL YANG DILANGGANI KODE (butuh Realtime) ===\n');
console.log(
  'tabel'.padEnd(20) +
    'ada?'.padEnd(7) +
    'di migrasi?'.padEnd(13) +
    'dipakai di'
);
console.log('-'.repeat(110));

const belumMasukMigrasi = [];
for (const t of daftar) {
  const ada = tabelRemote.has(t);
  const diMigrasi = tabelMigrasi.has(t);
  if (ada && !diMigrasi) belumMasukMigrasi.push(t);

  const pemakai = [...langganan.get(t)]
    .map((f) => f.replace(/^src\//, ''))
    .join(', ');
  console.log(
    t.padEnd(20) +
      (ada ? 'ya' : 'TIDAK').padEnd(7) +
      (diMigrasi ? 'ya' : 'BELUM').padEnd(13) +
      pemakai.slice(0, 62)
  );
  if (pemakai.length > 62) console.log(' '.repeat(40) + '  ' + pemakai.slice(62));
}

console.log('');
if (dinamis.length) {
  console.log('=== LANGGANAN DENGAN NAMA TABEL DINAMIS (perlu dicek manual) ===');
  for (const d of [...new Set(dinamis)]) console.log('  ' + d);
  console.log('');
}

console.log('=== RINGKASAN ===');
if (belumMasukMigrasi.length === 0) {
  console.log('  Semua tabel yang dilanggani kode dan ada di remote sudah masuk migrasi.');
} else {
  console.log(`  ${belumMasukMigrasi.length} tabel dilanggani kode dan ada di remote,`);
  console.log('  TETAPI belum masuk migrasi:');
  for (const t of belumMasukMigrasi) console.log(`    - ${t}`);
}

const tidakAda = daftar.filter((t) => !tabelRemote.has(t));
if (tidakAda.length) {
  console.log('');
  console.log(`  ${tidakAda.length} tabel dilanggani kode tetapi TIDAK ADA di remote`);
  console.log('  (langganan ini tidak akan pernah berfungsi):');
  for (const t of tidakAda) console.log(`    - ${t}`);
}

console.log('');
console.log(`  Total tabel dilanggani: ${daftar.length}`);
console.log(`  Total tabel di migrasi : ${tabelMigrasi.size}`);
