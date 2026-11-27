/**
 * Generator ID & nilai acak di sisi klien.
 *
 * Sengaja diletakkan di module scope, **bukan** di dalam body komponen.
 * Memanggil fungsi impure seperti `Date.now()` atau `Math.random()` langsung
 * di dalam render React dapat menyebabkan hasil yang tidak stabil antar-render
 * dan berpotensi memicu hydration mismatch antara server dan klien.
 *
 * Dengan memusatkannya di sini, komponen tetap deklaratif dan nilai acak/waktu
 * hanya dihasilkan pada saat benar-benar dibutuhkan (event handler, dsb).
 */

/** Waktu sekarang dalam milidetik (epoch). */
export const nowMs = (): number => Date.now();

/**
 * Suffix acak base36.
 * @param length jumlah karakter yang dihasilkan
 */
export const randomSuffix = (length = 5): string =>
  Math.random().toString(36).slice(2, 2 + length);

/**
 * ID bertimestamp dengan format `<prefix>_<millis>_<suffix>`.
 * @example timestampId('ord') // "ord_1759248000000_a3f9k"
 */
export const timestampId = (prefix: string, suffixLength = 5): string =>
  `${prefix}_${nowMs()}_${randomSuffix(suffixLength)}`;

/**
 * ID numerik murni dengan format `<prefix>-<millis>`.
 * @example millisId('MKT') // "MKT-1759248000000"
 */
export const millisId = (prefix: string): string => `${prefix}-${nowMs()}`;

/**
 * Kode acak huruf besar dengan format `<prefix>-<KODE>`.
 * @example randomCode('ATY') // "ATY-9F3K2A"
 */
export const randomCode = (prefix: string, length = 6): string =>
  `${prefix}-${randomSuffix(length).toUpperCase()}`;

/**
 * Nama file unik, aman untuk path storage.
 * @example uniqueFileName('payment-proofs', 'jpg') // "payment-proofs/1759248000000-a3f9k.jpg"
 */
export const uniqueFileName = (folder: string, extension: string): string =>
  `${folder}/${nowMs()}-${randomSuffix(5)}.${extension}`;

/**
 * Generator kode transaksi ringkas (9–10 karakter) untuk transaksi baru.
 * Menggabungkan 4 karakter terakhir epoch base36 + 2 karakter acak uppercase.
 * @example shortTxCode('SO')  // "SO-9K2A4B"
 * @example shortTxCode('PO')  // "PO-9K2A4B"
 * @example shortTxCode('MKT') // "MKT-9K2A4B"
 * @example shortTxCode('POS') // "POS-9K2A4B"
 */
export const shortTxCode = (prefix: string): string => {
  const tsPart = nowMs().toString(36).slice(-4).toUpperCase();
  const randPart = randomSuffix(2).toUpperCase();
  return `${prefix.toUpperCase()}-${tsPart}${randPart}`;
};

/**
 * Format tampilan nomor transaksi agar ringkas di seluruh halaman & struk cetak,
 * tanpa mengubah ID asli di database.
 * @example formatShortTxNo('SO-1795625399892')       // "SO-399892"
 * @example formatShortTxNo('PO-1795625399892')       // "PO-399892"
 * @example formatShortTxNo('POS-1795625399892-ABC')  // "POS-892ABC"
 * @example formatShortTxNo('ord_1795625399892_ab12') // "ORD-892AB1"
 */
export const formatShortTxNo = (rawNo?: string | null): string => {
  const clean = String(rawNo || '').trim();
  if (!clean) return '-';

  // Format: PREFIX-1234567890123 (timestamp 9+ digit)
  const dashDigits = clean.match(/^([A-Z0-9]+)-(\d{9,})$/i);
  if (dashDigits) {
    return `${dashDigits[1].toUpperCase()}-${dashDigits[2].slice(-6)}`;
  }

  // Format: POS-1795625399892-XYZ atau PREFIX-1795625399892-XYZ
  const dashMulti = clean.match(/^([A-Z]+)-(\d{9,})-([A-Z0-9]+)$/i);
  if (dashMulti) {
    return `${dashMulti[1].toUpperCase()}-${dashMulti[2].slice(-3)}${dashMulti[3].slice(0, 3).toUpperCase()}`;
  }

  // Format: ord_1795625399892_abc12 / so_1795625399892_abc12 / po_...
  const underMatch = clean.match(/^([a-z]+)_(\d{9,})(?:_([a-z0-9]+))?$/i);
  if (underMatch) {
    const pfx = underMatch[1].toUpperCase();
    const tail = underMatch[2].slice(-4) + (underMatch[3] ? underMatch[3].slice(0, 2).toUpperCase() : '');
    return `${pfx}-${tail}`;
  }

  // Jika format lain yang terlalu panjang (> 14 karakter)
  if (clean.length > 14) {
    const parts = clean.split(/[-_]/);
    if (parts.length > 1 && parts[0].length <= 6) {
      return `${parts[0].toUpperCase()}-${parts[parts.length - 1].slice(-6).toUpperCase()}`;
    }
    return `#${clean.slice(-6).toUpperCase()}`;
  }

  return clean;
};
