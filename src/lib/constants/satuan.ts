/**
 * Daftar satuan baku yang dipakai di seluruh sistem Atayatoko.
 * Semua form (tambah produk, edit produk, purchase order, satuan jual)
 * WAJIB menggunakan daftar ini agar konsisten.
 */
export const SATUAN_LIST = [
  { value: 'PCS',     label: 'PCS',     desc: 'Per Pcs / Satuan' },
  { value: 'RENCENG', label: 'RENCENG', desc: 'Per Renceng' },
  { value: 'RTG',     label: 'RTG',     desc: 'Per Renteng / Renceng' },
  { value: 'SACHET',  label: 'SACHET',  desc: 'Per Sachet' },
  { value: 'BUNGKUS', label: 'BUNGKUS', desc: 'Per Bungkus' },
  { value: 'PACK',    label: 'PACK',    desc: 'Per Pack' },
  { value: 'LUSIN',   label: 'LUSIN',   desc: '12 Pcs' },
  { value: 'KODI',    label: 'KODI',    desc: '20 Pcs' },
  { value: 'GROS',    label: 'GROS',    desc: '144 Pcs' },
  { value: 'DUS',     label: 'DUS',     desc: 'Per Dus' },
  { value: 'BOX',     label: 'BOX',     desc: 'Per Box' },
  { value: 'KARTON',  label: 'KARTON',  desc: 'Per Karton / CTN' },
  { value: 'BAL',     label: 'BAL',     desc: 'Per Bal' },
  { value: 'SLOP',    label: 'SLOP',    desc: 'Per Slop' },
  { value: 'POUCH',   label: 'POUCH',   desc: 'Per Pouch' },
  { value: 'BOTOL',   label: 'BOTOL',   desc: 'Per Botol' },
  { value: 'GALON',   label: 'GALON',   desc: 'Per Galon' },
  { value: 'KALENG',  label: 'KALENG',  desc: 'Per Kaleng' },
  { value: 'TUBE',    label: 'TUBE',    desc: 'Per Tube' },
  { value: 'ZAK',     label: 'ZAK',     desc: 'Per Zak / Sak' },
  { value: 'KARUNG',  label: 'KARUNG',  desc: 'Per Karung' },
  { value: 'ROLL',    label: 'ROLL',    desc: 'Per Roll' },
  { value: 'IKAT',    label: 'IKAT',    desc: 'Per Ikat' },
  { value: 'LEMBAR',  label: 'LEMBAR',  desc: 'Per Lembar' },
  { value: 'SET',     label: 'SET',     desc: 'Per Set' },
  { value: 'PASANG',  label: 'PASANG',  desc: 'Per Pasang' },
  { value: 'KG',      label: 'KG',      desc: 'Kilogram' },
  { value: 'GRAM',    label: 'GRAM',    desc: 'Gram' },
  { value: 'ONS',     label: 'ONS',     desc: 'Ons (100g)' },
  { value: 'LITER',   label: 'LITER',   desc: 'Per Liter' },
  { value: 'ML',      label: 'ML',      desc: 'Mililiter' },
];

export type SatuanItem = { value: string; label: string; desc: string };

/** Semua kode satuan yang valid */
export const SATUAN_VALUES: string[] = SATUAN_LIST.map((s) => s.value);

/** Default satuan terkecil (base unit) */
export const SATUAN_DEFAULT: string = 'PCS';

/** Kembalikan label dari kode satuan */
export function satuanLabel(value: string): string {
  const found = SATUAN_LIST.find((s) => s.value === value.toUpperCase());
  return found ? found.label : value.toUpperCase();
}

const ALIASES: Record<string, string> = {
  CTN: 'KARTON',
  CARTON: 'KARTON',
  GROSS: 'GROS',
  BANTAL: 'BAL',
  PAK: 'PACK',
};

/**
 * Normalisasi input bebas → kode baku UPPERCASE.
 * Satuan custom yang tidak ada di SATUAN_LIST tetap dipertahankan (tidak dipaksa jadi PCS).
 */
export function normalizeSatuan(raw: string): string {
  const upper = String(raw || '').trim().toUpperCase();
  if (!upper) return SATUAN_DEFAULT;
  return ALIASES[upper] ?? upper;
}

/**
 * Gabungkan SATUAN_LIST bawaan dengan daftar satuan custom dari database/produk.
 */
export function mergeSatuanList(customUnits: (SatuanItem | string)[] = []): SatuanItem[] {
  const map = new Map<string, SatuanItem>();
  for (const s of SATUAN_LIST) {
    map.set(s.value.toUpperCase(), s);
  }
  for (const item of customUnits) {
    const code = typeof item === 'string'
      ? item.trim().toUpperCase()
      : String(item?.value || '').trim().toUpperCase();
    if (!code || map.has(code)) continue;
    const desc = typeof item === 'string' ? 'Satuan Custom' : (item.desc || 'Satuan Custom');
    map.set(code, { value: code, label: code, desc });
  }
  return Array.from(map.values());
}
