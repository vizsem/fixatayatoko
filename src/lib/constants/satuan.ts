/**
 * Daftar satuan baku yang dipakai di seluruh sistem Atayatoko.
 * Semua form (tambah produk, edit produk, purchase order, satuan jual)
 * WAJIB menggunakan daftar ini agar konsisten.
 */
export const SATUAN_LIST = [
  { value: 'PCS',    label: 'PCS',    desc: 'Per Pcs / Satuan' },
  { value: 'LUSIN',  label: 'LUSIN',  desc: '12 Pcs' },
  { value: 'KODI',   label: 'KODI',   desc: '20 Pcs' },
  { value: 'GROS',   label: 'GROS',   desc: '144 Pcs' },
  { value: 'PACK',   label: 'PACK',   desc: 'Per Pack' },
  { value: 'DUS',    label: 'DUS',    desc: 'Per Dus' },
  { value: 'BOX',    label: 'BOX',    desc: 'Per Box' },
  { value: 'KARTON', label: 'KARTON', desc: 'Per Karton / CTN' },
  { value: 'BAL',    label: 'BAL',    desc: 'Per Bal' },
  { value: 'SLOP',   label: 'SLOP',   desc: 'Per Slop' },
  { value: 'POUCH',  label: 'POUCH',  desc: 'Per Pouch' },
  { value: 'ROLL',   label: 'ROLL',   desc: 'Per Roll' },
  { value: 'KG',     label: 'KG',     desc: 'Kilogram' },
  { value: 'LITER',  label: 'LITER',  desc: 'Per Liter' },
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
 * normalizeSatuan('ctn') → 'KARTON'
 * normalizeSatuan('Pcs') → 'PCS'
 */
export function normalizeSatuan(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return ALIASES[upper] ?? (SATUAN_VALUES.includes(upper) ? upper : 'PCS');
}
