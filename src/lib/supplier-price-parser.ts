/**
 * Supplier Price Text Parser
 * Digunakan untuk mengekstrak data dari broadcast teks WhatsApp supplier
 * seperti Indogrosir, Alfamart, Distributor Sembako, dll.
 */

export interface ParsedSupplierItem {
  rawLine: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  unitCount?: number;
  isKosong: boolean;
  notes?: string;
  suggestedMarginPct?: number;
}

export interface SupplierParseResult {
  title?: string;
  supplierName?: string;
  periodDate?: string;
  items: ParsedSupplierItem[];
  totalParsed: number;
  availableCount: number;
  emptyCount: number;
  categories: string[];
}

/**
 * Membersihkan angka harga yang mengandung karakter salah ketik (typo),
 * misal '252.OOO' (huruf O) -> '252000', '238.5000' -> 238500, dll.
 */
export function sanitizePriceString(priceStr: string): number {
  if (!priceStr) return 0;
  // Ganti huruf O/o besar/kecil menjadi angka 0
  let cleaned = priceStr.replace(/[Oo]/g, '0');
  // Hapus semua karakter non-digit kecuali titik
  cleaned = cleaned.replace(/[^0-9.]/g, '');
  
  // Jika ada titik ribuan, hapus titiknya (e.g. 207.500 -> 207500)
  // Periksa pola: jika setelah titik ada 3 digit (atau 2 digit), itu format ribuan Indo
  const parts = cleaned.split('.');
  if (parts.length > 1) {
    // Gabungkan tanpa titik
    cleaned = parts.join('');
  }
  
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalisasi nama satuan (ctn, pcs, slop, sak, bal, rcg, box, pck, dll)
 */
export function normalizeSupplierUnit(rawUnit: string): { unit: string; count: number } {
  const trimmed = (rawUnit || 'CTN').trim().toUpperCase();
  
  // Cek apakah ada awalan angka (misal: '3 PCS', '2CTN', '5 RCG', '12 PCS', '3BOX')
  const multiMatch = trimmed.match(/^(\d+)\s*(PCS|CTN|RCG|RENCENG|SLOP|BOX|BAL|SAK|PCK|PACK|BTL|KARTON)$/i);
  if (multiMatch) {
    const count = parseInt(multiMatch[1], 10);
    let u = multiMatch[2].toUpperCase();
    if (u === 'KARTON') u = 'CTN';
    if (u === 'RENCENG' || u === 'RCG') u = 'RCG';
    if (u === 'PACK') u = 'PCK';
    return { unit: u, count: count > 0 ? count : 1 };
  }

  if (trimmed.includes('CTN') || trimmed.includes('KARTON') || trimmed.includes('DUS')) return { unit: 'CTN', count: 1 };
  if (trimmed.includes('SLOP') || trimmed.includes('SLP')) return { unit: 'SLOP', count: 1 };
  if (trimmed.includes('BAL')) return { unit: 'BAL', count: 1 };
  if (trimmed.includes('SAK')) return { unit: 'SAK', count: 1 };
  if (trimmed.includes('RCG') || trimmed.includes('RENCENG')) return { unit: 'RCG', count: 1 };
  if (trimmed.includes('BOX')) return { unit: 'BOX', count: 1 };
  if (trimmed.includes('PCK') || trimmed.includes('PACK')) return { unit: 'PCK', count: 1 };
  if (trimmed.includes('BTL') || trimmed.includes('BOTOL')) return { unit: 'BTL', count: 1 };
  if (trimmed.includes('PCS') || trimmed.includes('BIJI')) return { unit: 'PCS', count: 1 };

  return { unit: trimmed || 'CTN', count: 1 };
}

/**
 * Membersihkan nama kategori dari emoji dan spasi berlebih
 */
export function cleanCategoryName(raw: string): string {
  return raw
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parser teks utama
 */
export function parseSupplierPriceBroadcast(text: string): SupplierParseResult {
  const lines = text.split(/\r?\n/);
  const items: ParsedSupplierItem[] = [];
  const categoriesSet = new Set<string>();

  let currentCategory = 'Umum';
  let title = '';
  let periodDate = '';
  let supplierName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Deteksi header periode / supplier
    if (line.includes('HARGA') || line.includes('STOCK POINT') || line.includes('INDOGROSIR')) {
      if (!title) title = line;
      if (line.includes('INDOGROSIR')) supplierName = 'Stock Point Indogrosir Kediri';
      continue;
    }
    if (line.toUpperCase().startsWith('PERIODE')) {
      periodDate = line.replace(/PERIODE\s*/i, '').trim();
      continue;
    }
    if (line.toUpperCase().includes('KEDIRI') && !supplierName) {
      supplierName = 'Stock Point Indogrosir Kediri';
      continue;
    }

    // Deteksi catatan / footer
    if (line.startsWith('*') || line.toUpperCase().includes('MINIMAL ORDER') || line.toUpperCase().includes('SYARAT & KETENTUAN')) {
      continue;
    }

    // Deteksi header kategori (biasanya diawali emoji atau huruf kapital tanpa titik dua harga)
    const isCategoryHeader = (
      /[\u{1F300}-\u{1F9FF}]/u.test(line) ||
      (line === line.toUpperCase() && !line.includes(':') && !line.includes(';') && !/\d{3}/.test(line) && line.length < 50)
    );

    if (isCategoryHeader && !line.includes(':') && !line.includes(';')) {
      const cleanedCat = cleanCategoryName(line);
      if (cleanedCat.length > 2) {
        currentCategory = cleanedCat;
        categoriesSet.add(cleanedCat);
      }
      continue;
    }

    // Parse baris produk
    // Format umum: [Nama Produk] : [Harga/Kosong] / [Satuan] (catatan)
    // Variasi: bisa pakai ';' pemisah, atau spasi tanpa titik dua
    let separatorIdx = line.indexOf(':');
    if (separatorIdx === -1) {
      separatorIdx = line.indexOf(';');
    }

    let namePart = '';
    let pricePart = '';

    if (separatorIdx !== -1) {
      namePart = line.substring(0, separatorIdx).trim();
      pricePart = line.substring(separatorIdx + 1).trim();
    } else {
      // Coba cari pola angka harga di akhir baris (e.g. "sprite 390ML 40.700" atau "garuda pilus 50.000")
      const fallbackMatch = line.match(/^(.*?)\s+((?:\d+[.Oo0-9]+|KOSONG|kosong)(?:\s*\/[a-zA-Z0-9\s]+)?(?:\s*\(.*?\))?)$/i);
      if (fallbackMatch) {
        namePart = fallbackMatch[1].trim();
        pricePart = fallbackMatch[2].trim();
      } else {
        continue; // Tidak bisa diparsing sebagai baris produk
      }
    }

    if (!namePart || namePart.length < 2) continue;

    // Periksa status kosong
    const isKosong = /K[O0]+SONG/i.test(pricePart);

    // Ambil catatan jika ada dalam kurung (misal: "(max 10 ctn)")
    let notes = '';
    const noteMatch = pricePart.match(/\((.*?)\)/);
    if (noteMatch) {
      notes = noteMatch[1].trim();
      pricePart = pricePart.replace(/\(.*?\)/, '').trim();
    }

    // Pecah harga dan satuan (pemisah '/')
    const slashIdx = pricePart.indexOf('/');
    let rawPrice = '';
    let rawUnit = 'CTN';

    if (slashIdx !== -1) {
      rawPrice = pricePart.substring(0, slashIdx).trim();
      rawUnit = pricePart.substring(slashIdx + 1).trim();
    } else {
      rawPrice = pricePart.trim();
      // Tebak satuan default berdasarkan kategori
      if (currentCategory.toUpperCase().includes('ROKOK')) {
        rawUnit = 'SLOP';
      } else if (namePart.toUpperCase().includes('25KG') || namePart.toUpperCase().includes('SAK')) {
        rawUnit = 'SAK';
      } else {
        rawUnit = 'CTN';
      }
    }

    const price = isKosong ? 0 : sanitizePriceString(rawPrice);
    const { unit, count } = normalizeSupplierUnit(rawUnit);

    items.push({
      rawLine: line,
      name: namePart,
      category: currentCategory,
      price,
      unit,
      unitCount: count,
      isKosong,
      notes: notes || undefined,
      suggestedMarginPct: 15, // default 15% margin
    });
  }

  const availableCount = items.filter(it => !it.isKosong).length;
  const emptyCount = items.filter(it => it.isKosong).length;

  return {
    title: title || 'Daftar Harga Supplier',
    supplierName: supplierName || 'Stock Point Indogrosir Kediri',
    periodDate: periodDate || undefined,
    items,
    totalParsed: items.length,
    availableCount,
    emptyCount,
    categories: Array.from(categoriesSet),
  };
}
