#!/usr/bin/env node
/**
 * Diagnostik READ-ONLY alur PO -> stok.
 *
 * Semua perintah di bawah HANYA membaca (SELECT). Tidak ada data yang diubah.
 *
 *   node scripts/diagnose-stock-flow.mjs            # ringkasan + audit selisih
 *   node scripts/diagnose-stock-flow.mjs <produkId> # telusuri satu produk
 *
 * Gunakan audit selisih untuk membedakan dua penyebab "stok tidak bertambah":
 *  - Semua "OK"      -> stok di DB memang bertambah; masalahnya di layar (UI).
 *  - Ada "BEDA"      -> ada penulis lain yang menimpa nilai stok.
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
  console.error('URL/Service key tidak ditemukan di .env.local.');
  process.exit(1);
}

const base = url.replace(/\/$/, '') + '/rest/v1';
const H = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(path, params = '') {
  const res = await fetch(`${base}${path}${params}`, { headers: H });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 300) };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: true, data: text };
  }
}

// ---------------------------------------------------------------------------
// Mode 1: telusuri satu produk
// ---------------------------------------------------------------------------
const productId = process.argv[2];

if (productId) {
  const enc = encodeURIComponent(productId);
  console.log(`=== PRODUK ${productId} ===`);

  const prod = await rest('/products', `?select=*&id=eq.${enc}`);
  if (!prod.ok) {
    console.log(`  GAGAL: ${prod.status} ${prod.body}`);
  } else if (!prod.data.length) {
    console.log('  Produk tidak ditemukan.');
  } else {
    const p = prod.data[0];
    const raw = p.raw_data || {};
    console.log(`  name                     = ${p.name}`);
    console.log(`  stock (kolom)            = ${p.stock}`);
    console.log(`  cost_price               = ${p.cost_price}`);
    console.log(`  updated_at               = ${p.updated_at}`);
    console.log(`  raw_data.stock           = ${raw.stock}`);
    console.log(`  raw_data.Stok            = ${raw.Stok}`);
    console.log(`  raw_data.stockByWarehouse= ${JSON.stringify(raw.stockByWarehouse)}`);
  }

  console.log('');
  console.log('=== Semua inventory_logs produk ini ===');
  const logs = await rest(
    '/inventory_logs',
    `?select=type,source,amount,prev_stock,next_stock,reference_id,warehouse_id,created_at&product_id=eq.${enc}&order=created_at.asc&limit=50`
  );
  if (!logs.ok) {
    console.log(`  GAGAL: ${logs.status} ${logs.body}`);
  } else if (!logs.data.length) {
    console.log('  (tidak ada log untuk produk ini)');
  } else {
    for (const l of logs.data) {
      console.log(
        `  ${l.created_at}  ${l.type}/${l.source}  amount=${l.amount}  prev=${l.prev_stock} -> next=${l.next_stock}  ref=${l.reference_id}  wh=${l.warehouse_id}`
      );
    }
  }
  console.log('');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Mode 2: ringkasan PO + audit selisih stok vs log
// ---------------------------------------------------------------------------
console.log('=== Kolom tabel products ===');
const openapi = await rest('/');
if (openapi.ok) {
  const defs = openapi.data?.definitions || openapi.data?.components?.schemas || {};
  const props = Object.keys(defs.products?.properties || {});
  console.log(`  punya kolom "stock"? ${props.includes('stock') ? 'YA' : 'TIDAK'}`);
} else {
  console.log(`  GAGAL ambil OpenAPI: ${openapi.status}`);
}

console.log('');
console.log('=== 5 PO terakhir ===');
const pos = await rest('/purchases', '?select=id,created_at,raw_data&order=created_at.desc&limit=5');
if (!pos.ok) {
  console.log(`  GAGAL: ${pos.status} ${pos.body}`);
} else {
  for (const p of pos.data) {
    const raw = p.raw_data || {};
    const items = (raw.items || [])
      .map((i) => `${i.productId} x${i.quantity} ${i.unit || ''} (conv ${i.conversion ?? '-'})`)
      .join(' | ');
    console.log(`  ${p.created_at}  ${p.id}  status=${raw.status || '(kosong)'}`);
    console.log(`     ${items || '(tanpa item)'}`);
  }
}

console.log('');
console.log('=== Audit: stok produk vs log inventory terakhir ===');
const purchaseLogs = await rest(
  '/inventory_logs',
  '?select=product_id&source=eq.PURCHASE&limit=300'
);
if (!purchaseLogs.ok) {
  console.log(`  GAGAL: ${purchaseLogs.status} ${purchaseLogs.body}`);
  process.exit(1);
}

const ids = [...new Set(purchaseLogs.data.map((l) => l.product_id).filter(Boolean))];
let ok = 0;
let bad = 0;

for (const pid of ids) {
  const enc = encodeURIComponent(pid);
  const [prodRes, logRes] = await Promise.all([
    rest('/products', `?select=name,stock,updated_at&id=eq.${enc}`),
    rest(
      '/inventory_logs',
      `?select=type,source,next_stock,reference_id,created_at&product_id=eq.${enc}&order=created_at.desc&limit=1`
    ),
  ]);
  const p = prodRes.ok ? prodRes.data[0] : null;
  const last = logRes.ok ? logRes.data[0] : null;
  if (!p || !last) continue;

  const current = Number(p.stock ?? 0);
  const expected = Number(last.next_stock ?? 0);
  const diff = current - expected;
  const name = (p.name || '').slice(0, 36).padEnd(36);

  if (diff === 0) {
    ok++;
    console.log(`  OK   ${name} stok=${String(current).padStart(5)}  (log: ${last.type}/${last.source})`);
  } else {
    bad++;
    console.log(
      `  BEDA ${name} stok=${String(current).padStart(5)}  log bilang ${expected}  selisih ${diff > 0 ? '+' : ''}${diff}`
    );
    console.log(`       log: ${last.created_at} ${last.type}/${last.source} ref=${last.reference_id}`);
    console.log(`       produk updated_at: ${p.updated_at}`);
  }
}

console.log('');
console.log(`Ringkasan: ${ok} cocok, ${bad} tidak cocok.`);
console.log('Semua "OK" berarti stok di DB memang bertambah oleh PO.');
console.log('(read-only, tidak ada perubahan data)');
