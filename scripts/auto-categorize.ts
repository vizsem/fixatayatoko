import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define keyword-to-category mapping
const categoryMapping = [
  { category: 'Minyak Goreng', keywords: ['minyak', 'bimoli', 'sania', 'filma', 'sunco', 'tropical', 'fortune'] },
  { category: 'Beras', keywords: ['beras', 'rojo lele', 'setra ramos'] },
  { category: 'Gula', keywords: ['gula', 'gulaku'] },
  { category: 'Kopi', keywords: ['kopi', 'kapal api', 'luwak', 'torabika', 'indocafe', 'good day', 'nescafe'] },
  { category: 'Susu', keywords: ['susu', 'bendera', 'dancow', 'indomilk', 'frisian flag', 'sgm', 'bebelac', 'lactamil', 'prenagen', 'bear brand'] },
  { category: 'Mie Instan', keywords: ['mie', 'indomie', 'sedap', 'sedaap', 'sarimi', 'supermi', 'lemonilo', 'pop mie'] },
  { category: 'Teh', keywords: ['teh', 'sariwangi', 'sosro', 'pucuk', 'tong tji', 'sari wangi'] },
  { category: 'Sabun Mandi', keywords: ['sabun', 'lifebuoy', 'nuvo', 'giv', 'shinzui', 'lux', 'dettol', 'biore', 'citra'] },
  { category: 'Shampo', keywords: ['shampo', 'shampoo', 'clear', 'pantene', 'sunsilk', 'head & shoulders', 'zinc', 'dove', 'rejoice'] },
  { category: 'Deterjen & Pewangi', keywords: ['deterjen', 'rinso', 'daia', 'so klin', 'soklin', 'attack', 'boom', 'molto', 'downy', 'royale'] },
  { category: 'Popok Bayi', keywords: ['popok', 'mamy poko', 'mamypoko', 'sweety', 'merries', 'pampers', 'happy nappy', 'fitti'] },
  { category: 'Rokok', keywords: ['rokok', 'gudang garam', 'djarum', 'sampoerna', 'dji sam soe', 'marlboro', 'dunhill', 'class mild', 'surya', 'promild'] },
  { category: 'Minuman Botol/Kemasan', keywords: ['aqua', 'le minerale', 'coca cola', 'sprite', 'fanta', 'pucuk', 'floridina', 'teh botol', 'pocari', 'mizone', 'vit', 'cleo', 'club'] },
  { category: 'Snack & Biskuit', keywords: ['snack', 'taro', 'chitato', 'qtela', 'biskuat', 'roma', 'beng beng', 'chocolatos', 'garuda', 'gery', 'nabati', 'oreo', 'slai olai', 'tango', 'regal', 'kacang', 'keripik'] },
  { category: 'Bumbu & Saus', keywords: ['kecap', 'bango', 'abc', 'sedaap', 'saos', 'saus', 'sambal', 'masako', 'royco', 'racik', 'ladaku', 'desaku', 'bumbu', 'sasa', 'ajinomoto', 'miwon'] },
  { category: 'Tepung', keywords: ['tepung', 'segitiga', 'kunci biru', 'cakra kembar', 'sajiku', 'kobe'] },
  { category: 'Perawatan Gigi', keywords: ['pasta gigi', 'odol', 'pepsodent', 'ciptadent', 'close up', 'sikat gigi', 'formula', 'systema'] },
  { category: 'Tisu', keywords: ['tisu', 'tissue', 'paseo', 'nice', 'tessa', 'multi'] },
  { category: 'Obat-obatan', keywords: ['obat', 'panadol', 'bodrex', 'promag', 'tolak angin', 'antangin', 'paramex', 'mixagrip', 'decolgen', 'insto', 'rohto', 'betadine', 'minyak kayu putih', 'cap lang'] },
  { category: 'Pembersih', keywords: ['pembersih', 'sunlight', 'mama lemon', 'vixal', 'wipol', 'super pel', 'porstex', 'harpic', 'baygon', 'hit', 'vape'] },
  { category: 'Perawatan Kulit & Kosmetik', keywords: ['kosmetik', 'wardah', 'ponds', 'garnier', 'fair & lovely', 'marina', 'viva', 'bedak', 'handbody', 'lotion'] },
  { category: 'Es Krim', keywords: ['es krim', 'ice cream', 'wall\'s', 'campina', 'aice', 'joyday'] },
  { category: 'Minuman Serbuk & Sirup', keywords: ['pop ice', 'nutrisari', 'marjan', 'sirup', 'syrup', 'abc', 'teajus', 'kuku bima', 'extra joss', 'energen'] },
  { category: 'Plastik & Kemasan', keywords: ['plastik', 'kresek', 'mika', 'sedotan', 'karet', 'gelas cup'] },
  { category: 'Perlengkapan', keywords: ['korek', 'baterai', 'alkaline', 'abc'] }
];

function determineCategory(name) {
  const lowerName = name.toLowerCase();
  for (const mapping of categoryMapping) {
    if (mapping.keywords.some(keyword => lowerName.includes(keyword))) {
      return mapping.category;
    }
  }
  return null;
}

async function run() {
  console.log('Fetching all products...');
  
  // Ambil semua produk
  let allProducts = [];
  let page = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, raw_data')
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
      console.error('Error fetching products:', error);
      process.exit(1);
    }

    if (data.length > 0) {
      allProducts = [...allProducts, ...data];
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allProducts.length} products. Analyzing categories...`);

  let updatedCount = 0;
  const updates = [];
  const categoryCounts = {};

  for (const product of allProducts) {
    // Only update if category is empty, GENERAL, TIDAK ADA KATEGORI, or null
    const currentCategory = product.category || (product.raw_data && (product.raw_data.category || product.raw_data.Kategori));
    const isUncategorized = !currentCategory || 
                            currentCategory === '' || 
                            currentCategory.toUpperCase() === 'GENERAL' || 
                            currentCategory.toUpperCase() === 'TIDAK ADA KATEGORI' ||
                            currentCategory.toUpperCase() === 'SNACK'; // SNACK often default

    const newCategory = determineCategory(product.name);

    if (newCategory) {
      // Jika produk belum punya kategori atau kategorinya umum, timpa dengan kategori baru
      if (isUncategorized || currentCategory.toUpperCase() !== newCategory.toUpperCase()) {
        const updatedRawData = { ...(product.raw_data || {}), category: newCategory, Kategori: newCategory };
        updates.push({
          id: product.id,
          category: newCategory,
          raw_data: updatedRawData
        });
        
        categoryCounts[newCategory] = (categoryCounts[newCategory] || 0) + 1;
      }
    }
  }

  console.log(`\nFound ${updates.length} products to categorize.`);
  
  if (updates.length === 0) {
    console.log('No products need categorizing.');
    return;
  }

  // Print summary of what will be updated
  console.log('\nCategory assignment summary:');
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${cat}: ${count} products`);
  }

  console.log('\nUpdating products in database (batch processing)...');
  
  // Supabase update in chunks
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    
    // Upsert or update? The easiest way is bulk update if upsert works with existing IDs
    const { error } = await supabase
      .from('products')
      .upsert(chunk, { onConflict: 'id' });

    if (error) {
      console.error(`Error updating chunk ${i/chunkSize + 1}:`, error);
    } else {
      updatedCount += chunk.length;
      process.stdout.write(`\rProgress: ${updatedCount}/${updates.length}`);
    }
  }

  console.log('\n\n✅ Done! Successfully auto-categorized products.');
}

run();
