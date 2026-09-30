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
