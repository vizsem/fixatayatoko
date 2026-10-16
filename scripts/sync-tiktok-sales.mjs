import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const soldItems = JSON.parse(readFileSync(new URL('../src/data/tiktok-sold-list.json', import.meta.url), 'utf8'));

function cleanTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(title) {
  const stopWords = new Set([
    'isi', 'pcs', 'dan', 'dengan', 'rasa', 'yang', 'untuk', 'sehari', 'hari', 
    'termurah', 'murah', 'grosir', 'grosiran', 'toko', 'warung', 'lengkap', 
    'premium', 'quality', 'terjamin', 'tanpa', 'pewarna', 'tidak', 'ada', 
    'pewangi', 'pulen', 'putih', 'alami', 'note', 'jika', 'merek', 'ini', 
    'habis', 'maka', 'kami', 'kirim', 'random', 'dg', 'kualitas', 'sama', 
    'nikmati', 'keseruan', 'kering', 'food', 'makanan', 'ringan', 'nikmat', 
    'gurih', 'lezat', 'camilan', 'ready', 'stock', 'cocok', 'snack', 'bikin', 
    'nagih', 'karton', 'dus', 'kartonan', 'buka', 'sku', 'bungkus', 'pack', 
    'renceng', 'renteng', 'sachet', 'paket', 'bundling', 'kemasan', 'asli', 
    'halal', 'bpom', 'surakarta', 'jawa', 'tengah'
  ]);
  return cleanTitle(title)
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.has(w));
}

async function run() {
  console.log('Fetching all products from Supabase...');
  let allProducts = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, raw_data')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error('Fetch error:', error); break; }
    allProducts.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Fetched ${allProducts.length} products.`);

  let updatedCount = 0;
  for (const item of soldItems) {
    let matched = allProducts.find(p => 
      p.id === item.tiktokId || 
      p.sku === item.tiktokId || 
      p.sku === 'TT-' + item.tiktokId || 
      p.raw_data?.tiktokProductId === item.tiktokId ||
      p.raw_data?.tiktok_id === item.tiktokId
    );

    if (!matched) {
      const keywords = extractKeywords(item.title);
      let bestScore = 0;
      let bestCandidate = null;

      for (const p of allProducts) {
        const pClean = cleanTitle(p.name);
        let score = 0;
        for (const kw of keywords) {
          if (pClean.includes(kw)) score += kw.length;
        }
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = p;
        }
      }

      if (bestScore >= 8) {
        matched = bestCandidate;
      }
    }

    if (matched) {
      const currentRaw = matched.raw_data || {};
      const updatedRaw = {
        ...currentRaw,
        tiktokProductId: item.tiktokId,
        tiktokSold: item.sold,
        tiktokViews: item.views,
        tiktokRevenue: item.revenue,
      };

      const { error: updateErr } = await supabase
        .from('products')
        .update({
          raw_data: updatedRaw,
          updated_at: new Date().toISOString()
        })
        .eq('id', matched.id);

      if (updateErr) {
        console.error(`Failed to update ${matched.name}:`, updateErr);
      } else {
        updatedCount++;
        matched.raw_data = updatedRaw; // update local cache
      }
    }
  }

  console.log(`\n🎉 Successfully synced ${updatedCount}/${soldItems.length} products with TikTok sales data!`);
}

run();
