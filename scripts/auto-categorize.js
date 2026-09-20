const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

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
  { category: 'Beras', keywords: ['beras', 'rojo lele', 'setra ramos', 'pandan wangi'] },
  { category: 'Gula', keywords: ['gula', 'gulaku'] },
  { category: 'Kopi', keywords: ['kopi', 'kapal api', 'luwak', 'torabika', 'indocafe', 'good day', 'nescafe'] },
  { category: 'Susu', keywords: ['susu', 'bendera', 'dancow', 'indomilk', 'frisian flag', 'sgm', 'bebelac', 'lactamil', 'prenagen', 'bear brand', 'kental manis', 'krimer'] },
  { category: 'Mie Instan', keywords: ['mie', 'indomie', 'sedap', 'sedaap', 'sarimi', 'supermi', 'lemonilo', 'pop mie', 'intermi'] },
  { category: 'Teh', keywords: ['teh', 'sariwangi', 'sosro', 'pucuk', 'tong tji', 'sari wangi'] },
  { category: 'Sabun Mandi', keywords: ['sabun', 'lifebuoy', 'nuvo', 'giv', 'shinzui', 'lux', 'dettol', 'biore', 'citra'] },
  { category: 'Shampo', keywords: ['shampo', 'shampoo', 'clear', 'pantene', 'sunsilk', 'head & shoulders', 'zinc', 'dove', 'rejoice', 'emeran'] },
  { category: 'Deterjen & Pewangi', keywords: ['deterjen', 'rinso', 'daia', 'so klin', 'soklin', 'attack', 'boom', 'molto', 'downy', 'royale', 'kispray', 'pewangi', 'pelembut'] },
  { category: 'Popok Bayi', keywords: ['popok', 'mamy poko', 'mamypoko', 'sweety', 'merries', 'pampers', 'happy nappy', 'fitti', 'diaper'] },
  { category: 'Rokok', keywords: ['rokok', 'gudang garam', 'djarum', 'sampoerna', 'dji sam soe', 'marlboro', 'dunhill', 'class mild', 'surya', 'promild'] },
  { category: 'Minuman Botol/Kemasan', keywords: ['aqua', 'le minerale', 'coca cola', 'sprite', 'fanta', 'pucuk', 'floridina', 'teh botol', 'pocari', 'mizone', 'vit', 'cleo', 'club'] },
  { category: 'Snack & Biskuit', keywords: ['snack', 'taro', 'chitato', 'qtela', 'biskuat', 'roma', 'beng beng', 'chocolatos', 'garuda', 'gery', 'nabati', 'oreo', 'slai olai', 'tango', 'regal', 'kacang', 'keripik', 'biskuit', 'wafer', 'permen', 'yupi', 'kopiko'] },
  { category: 'Bumbu & Saus', keywords: ['kecap', 'bango', 'abc', 'sedaap', 'saos', 'saus', 'sambal', 'masako', 'royco', 'racik', 'ladaku', 'desaku', 'bumbu', 'sasa', 'ajinomoto', 'miwon', 'garam', 'cuka'] },
  { category: 'Tepung', keywords: ['tepung', 'segitiga', 'kunci biru', 'cakra kembar', 'sajiku', 'kobe', 'sasa tepung', 'kanji'] },
  { category: 'Perawatan Gigi', keywords: ['pasta gigi', 'odol', 'pepsodent', 'ciptadent', 'close up', 'sikat gigi', 'formula', 'systema'] },
  { category: 'Tisu', keywords: ['tisu', 'tissue', 'paseo', 'nice', 'tessa', 'multi', 'jolly'] },
  { category: 'Obat-obatan', keywords: ['obat', 'panadol', 'bodrex', 'promag', 'tolak angin', 'antangin', 'paramex', 'mixagrip', 'decolgen', 'insto', 'rohto', 'betadine', 'minyak kayu putih', 'cap lang', 'salonpas', 'hot in', 'konidin', 'komix'] },
  { category: 'Pembersih', keywords: ['pembersih', 'sunlight', 'mama lemon', 'vixal', 'wipol', 'super pel', 'porstex', 'harpic', 'baygon', 'hit', 'vape', 'bagus', 'kapur barus'] },
  { category: 'Perawatan Kulit & Kosmetik', keywords: ['kosmetik', 'wardah', 'ponds', 'garnier', 'fair & lovely', 'marina', 'viva', 'bedak', 'handbody', 'lotion', 'cream'] },
  { category: 'Es Krim', keywords: ['es krim', 'ice cream', 'wall\'s', 'campina', 'aice', 'joyday'] },
  { category: 'Minuman Serbuk & Sirup', keywords: ['pop ice', 'nutrisari', 'marjan', 'sirup', 'syrup', 'abc', 'teajus', 'kuku bima', 'extra joss', 'energen', 'chocolatos drink'] },
  { category: 'Plastik & Kemasan', keywords: ['plastik', 'kresek', 'mika', 'sedotan', 'karet', 'gelas cup'] },
  { category: 'Perlengkapan', keywords: ['korek', 'baterai', 'alkaline', 'abc'] }
];

function determineCategory(name) {
  if (!name) return null;
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

    if (data && data.length > 0) {
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
    const currentCategory = product.category || (product.raw_data && (product.raw_data.category || product.raw_data.Kategori));
    const isUncategorized = !currentCategory || 
                            currentCategory === '' || 
                            currentCategory.toUpperCase() === 'GENERAL' || 
                            currentCategory.toUpperCase() === 'TIDAK ADA KATEGORI' ||
                            currentCategory.toUpperCase() === 'SNACK';

    let newCategory = determineCategory(product.name);

    if (isUncategorized && !newCategory) {
      newCategory = 'Lain-lain';
    }

    if (newCategory) {
      if (isUncategorized || (currentCategory && currentCategory.toUpperCase() !== newCategory.toUpperCase())) {
        // Jangan timpa kategori yang sudah valid dengan 'Lain-lain'
        if (!isUncategorized && newCategory === 'Lain-lain') {
          continue;
        }

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

  console.log('\nCategory assignment summary:');
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${cat}: ${count} products`);
  }

  console.log('\nUpdating products in database (batch processing)...');
  
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    
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
