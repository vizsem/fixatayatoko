/**
 * Generator & Formatter SKU/ID Produk Berbasis Kategori (Skema 1)
 * Standar retail profesional: [KODE_KATEGORI]-[4_DIGIT_ANGKA]
 * Contoh: SBK-0001, SNK-0012-CKT, MNM-0005
 */

// Kamus Prefiks Kategori Standar (3-4 Huruf)
export const CATEGORY_PREFIX_MAP: Record<string, string> = {
  // Sembako & Kebutuhan Pokok
  sembako: 'SBK',
  beras: 'SBK',
  minyak: 'SBK',
  gula: 'SBK',
  tepung: 'SBK',
  telur: 'SBK',
  garam: 'SBK',

  // Makanan Ringan / Snack / Kue / Biskuit
  snack: 'SNK',
  makanan: 'SNK',
  keripik: 'SNK',
  biskuit: 'SNK',
  wafer: 'SNK',
  roti: 'SNK',
  kue: 'SNK',
  bakpia: 'SNK',
  cokelat: 'SNK',
  coklat: 'SNK',
  permen: 'SNK',

  // Minuman
  minuman: 'MNM',
  kopi: 'MNM',
  teh: 'MNM',
  susu: 'MNM',
  jus: 'MNM',
  sirup: 'MNM',
  air: 'MNM',

  // Mi / Mie / Pasta
  mie: 'MIE',
  mi: 'MIE',
  bihun: 'MIE',
  pasta: 'MIE',

  // Bumbu & Rempah
  bumbu: 'BMB',
  rempah: 'BMB',
  kecap: 'BMB',
  saus: 'BMB',
  sambal: 'BMB',
  santan: 'BMB',
  penyedap: 'BMB',

  // Kebersihan & Perawatan Rumah
  kebersihan: 'KBR',
  sabun: 'KBR',
  deterjen: 'KBR',
  detergent: 'KBR',
  shampoo: 'KBR',
  sampo: 'KBR',
  pasta_gigi: 'KBR',
  pembersih: 'KBR',

  // Rokok & Tembakau
  rokok: 'ROK',
  tembakau: 'ROK',

  // Perlengkapan Bayi & Anak
  bayi: 'BYI',
  popok: 'BYI',
  pampers: 'BYI',
  baby: 'BYI',

  // Kosmetik & Skincare
  kosmetik: 'KSM',
  skincare: 'KSM',
  perawatan: 'KSM',

  // Kesehatan & Obat
  obat: 'OBT',
  farmasi: 'OBT',
  vitamin: 'OBT',
  suplemen: 'OBT',

  // Perlengkapan Rumah Tangga
  rumah_tangga: 'RTG',
  dapur: 'RTG',
  plastik: 'RTG',

  // Pakaian / Fashion
  fashion: 'FSH',
  pakaian: 'FSH',
  baju: 'FSH',

  // Elektronik & Aksesoris
  elektronik: 'ELK',
  gadget: 'ELK',
  listrik: 'ELK',
};

/**
 * Tentukan prefiks kategori 3 huruf dari nama kategori atau nama produk
 */
export function getCategoryPrefix(categoryName?: string, productName?: string): string {
  const normCat = (categoryName || '').toLowerCase().trim();
  const normProd = (productName || '').toLowerCase().trim();

  // 1. Cek pencocokan langsung pada nama kategori
  for (const [key, prefix] of Object.entries(CATEGORY_PREFIX_MAP)) {
    if (normCat.includes(key)) {
      return prefix;
    }
  }

  // 2. Cek pencocokan pada nama produk jika kategori masih umum
  for (const [key, prefix] of Object.entries(CATEGORY_PREFIX_MAP)) {
    if (normProd.includes(key)) {
      return prefix;
    }
  }

  // Abaikan kategori umum
  const GENERIC_CATS = ['umum', 'general', 'semua', 'lain-lain', 'lainnya', 'default', 'all'];
  if (GENERIC_CATS.includes(normCat)) {
    // Coba tebak dari nama produk
    if (normProd) {
      for (const [key, prefix] of Object.entries(CATEGORY_PREFIX_MAP)) {
        if (normProd.includes(key)) {
          return prefix;
        }
      }
    }
    return 'PRD';
  }

  // 3. Jika nama kategori spesifik berupa 3-4 huruf (misal "ATK", "FMCG")
  const cleanCat = normCat.replace(/[^a-z0-9]/g, '');
  if (cleanCat.length >= 2 && cleanCat.length <= 4 && !GENERIC_CATS.includes(cleanCat)) {
    return cleanCat.toUpperCase();
  }

  // Default fallback
  return 'PRD';
}

/**
 * Kamus singkatan varian populer (agar SKU varian pendek & rapi)
 */
const VARIANT_SUFFIX_MAP: Record<string, string> = {
  cokelat: 'CKT',
  coklat: 'CKT',
  chocolate: 'CKT',
  keju: 'KJU',
  cheese: 'KJU',
  stroberi: 'STR',
  strawberry: 'STR',
  vanila: 'VNL',
  vanilla: 'VNL',
  original: 'ORI',
  ori: 'ORI',
  manis: 'MNS',
  asin: 'ASN',
  gurih: 'GRH',
  pedas: 'PDS',
  spicy: 'PDS',
  balado: 'BLD',
  bbq: 'BBQ',
  barbeque: 'BBQ',
  jagung: 'JGG',
  matcha: 'MTC',
  greentea: 'MTC',
  kopi: 'KPI',
  mocha: 'MCH',
  ayam: 'AYM',
  sapi: 'SPI',
  udang: 'UDG',
  ikan: 'IKN',
  kecil: 'KCL',
  sedang: 'SDG',
  besar: 'BSR',
};

/**
 * Buat suffix SKU varian yang pendek & bermakna
 * Contoh: "Coklat" -> "CKT", "Keju" -> "KJU", "1 Kg" -> "1KG", "Merah" -> "MRH"
 */
export function generateVariantSuffix(variantName: string, index = 0): string {
  const clean = variantName.toLowerCase().trim();

  // 1. Cek di kamus populer
  for (const [key, suffix] of Object.entries(VARIANT_SUFFIX_MAP)) {
    if (clean.includes(key)) {
      return suffix;
    }
  }

  // 2. Cek jika ukuran (cth: "250ml", "1kg", "500gr", "XL", "S", "M")
  const sizeMatch = variantName.toUpperCase().replace(/\s+/g, '').match(/^([0-9]+[A-Z]+|[SMLX]{1,3})$/);
  if (sizeMatch) {
    return sizeMatch[0];
  }

  // 3. Bersihkan karakter non-alphanumeric
  const alphaNum = variantName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alphaNum.length >= 2 && alphaNum.length <= 4) {
    return alphaNum;
  }

  // 4. Ambil 3 konsonan pertama jika ada
  const consonants = alphaNum.replace(/[AEIOU]/g, '');
  if (consonants.length >= 3) {
    return consonants.slice(0, 3);
  }

  // 5. Fallback ke 3 huruf pertama atau V1, V2...
  if (alphaNum.length >= 3) {
    return alphaNum.slice(0, 3);
  }

  return `V${index + 1}`;
}

/**
 * Buat SKU Varian Lengkap
 * Contoh: generateVariantSku("SBK-0001", "Coklat") -> "SBK-0001-CKT"
 */
export function generateVariantSku(parentSku: string, variantName: string, index = 0): string {
  const baseParent = (parentSku || 'PRD-0001').trim().toUpperCase();
  const suffix = generateVariantSuffix(variantName, index);
  return `${baseParent}-${suffix}`;
}

/**
 * Format SKU untuk Tampilan UI yang Rapi
 * Jika SKU berantakan/panjang (seperti prod_1740578942189_a3f9k atau UUID),
 * ubah menjadi tampilan ringkas agar tabel tidak bloated.
 */
export function formatDisplaySku(sku?: string | null, id?: string | null): string {
  const code = (sku || '').trim();

  // Jika SKU sudah rapi (misal: SBK-0001, PRD-0002, IND-001)
  if (code && !code.startsWith('prod_') && code.length <= 18 && !code.includes('_')) {
    return code;
  }

  // Jika SKU berupa UUID panjang atau prod_...
  const target = code || id || '';
  if (target.startsWith('prod_')) {
    // prod_1740578942189_a3f9k -> ambil 6 angka terakhir timestamp atau suffix
    const parts = target.split('_');
    const suffix = parts[parts.length - 1] || parts[1]?.slice(-4) || '001';
    return `PRD-${suffix.toUpperCase()}`;
  }

  // Jika UUID (36 karakter)
  if (target.includes('-') && target.length >= 32) {
    return `ID-${target.slice(0, 6).toUpperCase()}`;
  }

  // Jika kosong
  if (!code) {
    return 'PRD-N/A';
  }

  return code.slice(0, 16);
}
