#!/usr/bin/env node
/**
 * merge-duplicate-products.mjs
 *
 * Mencari dan menggabungkan produk duplikat di Supabase.
 *
 * Pakai:
 *   node scripts/merge-duplicate-products.mjs          ← dry-run
 *   node scripts/merge-duplicate-products.mjs --apply  ← benar-benar merge & hapus
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  } catch {}
  return env;
}

const env = { ...loadEnvLocal(), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('URL/Service key Supabase tidak ditemukan di .env.local');
  process.exit(1);
}

const DRY_RUN = !process.argv.includes('--apply');

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) { const b = await res.text(); throw new Error(`${res.status}: ${b}`); }
  if (res.status === 204) return null;
  return res.json();
}

function cleanName(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSimilar(nameA, nameB) {
  const a = cleanName(nameA);
  const b = cleanName(nameB);
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const wa = a.split(' ').filter(w => w.length > 2);
  const wb = b.split(' ').filter(w => w.length > 2);
  if (wa.length < 2 || wb.length < 2) return false;
  const mAB = wa.filter(w => b.includes(w)).length / wa.length;
  const mBA = wb.filter(w => a.includes(w)).length / wb.length;
  return mAB >= 0.8 || mBA >= 0.8;
}

function scoreProd(p) {
  let s = 0;
  if (p.image_url) s += 10;
  const r = p.raw_data || {};
  if (r.channelPricing?.tiktok) s += 5;
  if (r.channelPricing?.shopee) s += 5;
  if (r.priceTiktok) s += 3;
  if (r.priceShopee) s += 3;
  if (p.price > 0) s += 2;
  if (p.is_active) s += 1;
  return s;
}

function mergeRawData(master, duplicates) {
  let m = { ...(master.raw_data || {}) };
  for (const dup of duplicates) {
    const r = dup.raw_data || {};
    if (r.channelPricing) {
      m.channelPricing = m.channelPricing || {};
      for (const [ch, units] of Object.entries(r.channelPricing)) {
        if (!m.channelPricing[ch]) m.channelPricing[ch] = units;
        else m.channelPricing[ch] = { ...units, ...m.channelPricing[ch] };
      }
    }
    if (!m.image_url && r.image_url) m.image_url = r.image_url;
    if (!m.imageUrl && r.imageUrl) m.imageUrl = r.imageUrl;
    if (!m.Link_Foto && r.Link_Foto) m.Link_Foto = r.Link_Foto;
    if (!m.images && r.images) m.images = r.images;
    if (!m.tiktokProductId && r.tiktokProductId) m.tiktokProductId = r.tiktokProductId;
    if (!m.shopeeProductId && r.shopeeProductId) m.shopeeProductId = r.shopeeProductId;
    if (!m.priceTiktok && r.priceTiktok) m.priceTiktok = r.priceTiktok;
    if (!m.priceShopee && r.priceShopee) m.priceShopee = r.priceShopee;
  }
  return m;
}

async function main() {
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`  Merge Duplicate Products`);
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY-RUN (tidak ada perubahan)' : '⚠️  APPLY (merge & hapus duplikat!)'}`);
  console.log(`${'─'.repeat(65)}\n`);

  console.log('📥 Mengambil semua produk...');
  const products = await sbFetch('/products?select=id,name,sku,barcode,unit,price,cost_price,stock,image_url,is_active,raw_data,created_at&order=created_at.asc&limit=5000');
  console.log(`   → ${products.length} produk ditemukan\n`);

  const visited = new Set();
  const groups = [];

  for (let i = 0; i < products.length; i++) {
    if (visited.has(products[i].id)) continue;
    const group = [products[i]];
    visited.add(products[i].id);
    for (let j = i + 1; j < products.length; j++) {
      if (visited.has(products[j].id)) continue;
      if (isSimilar(products[i].name, products[j].name)) {
        group.push(products[j]);
        visited.add(products[j].id);
      }
    }
    if (group.length > 1) groups.push(group);
  }

  if (groups.length === 0) {
    console.log('✅ Tidak ada produk duplikat ditemukan!');
    return;
  }

  const totalDups = groups.reduce((s, g) => s + g.length - 1, 0);
  console.log(`⚠️  ${groups.length} grup duplikat, total ${totalDups} produk akan dihapus:\n`);

  let totalDeleted = 0;

  for (const [idx, group] of groups.entries()) {
    group.sort((a, b) => scoreProd(b) - scoreProd(a));
    const master = group[0];
    const dups = group.slice(1);

    const masterHasImage = !!master.image_url;
    const masterHasTiktok = !!master.raw_data?.channelPricing?.tiktok || !!master.raw_data?.priceTiktok;
    const masterHasShopee = !!master.raw_data?.channelPricing?.shopee || !!master.raw_data?.priceShopee;

    console.log(`[${String(idx+1).padStart(3)}] ${master.name?.slice(0, 60)}`);
    console.log(`      MASTER   : ${master.id.slice(0,20)}.. aktif=${master.is_active} foto=${masterHasImage} tiktok=${masterHasTiktok} shopee=${masterHasShopee}`);
    for (const d of dups) {
      const dImg = !!d.image_url;
      const dTT  = !!d.raw_data?.channelPricing?.tiktok || !!d.raw_data?.priceTiktok;
      const dSh  = !!d.raw_data?.channelPricing?.shopee || !!d.raw_data?.priceShopee;
      console.log(`      DUPLIKAT : ${d.id.slice(0,20)}.. aktif=${d.is_active} foto=${dImg} tiktok=${dTT} shopee=${dSh} → HAPUS`);
    }

    if (!DRY_RUN) {
      const mergedRaw = mergeRawData(master, dups);
      const payload = { raw_data: mergedRaw, updated_at: new Date().toISOString() };
      if (!master.image_url) {
        const withImg = dups.find(d => d.image_url);
        if (withImg) payload.image_url = withImg.image_url;
      }
      if (!master.is_active && dups.some(d => d.is_active)) payload.is_active = true;

      await sbFetch(`/products?id=eq.${master.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify(payload) });

      for (const dup of dups) {
        await sbFetch(`/products?id=eq.${dup.id}`, { method: 'DELETE', prefer: 'return=minimal' });
        totalDeleted++;
      }
      console.log(`      ✅ Digabung, ${dups.length} duplikat dihapus`);
    }
  }

  console.log(`\n${'─'.repeat(65)}`);
  if (DRY_RUN) {
    console.log(`\n📋 DRY-RUN selesai — ${groups.length} grup, ${totalDups} produk akan dihapus.`);
    console.log(`\n   ➡  Untuk menerapkan:`);
    console.log(`   node scripts/merge-duplicate-products.mjs --apply\n`);
  } else {
    console.log(`\n✅ Selesai! ${totalDeleted} produk duplikat dihapus dan datanya digabung.\n`);
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
