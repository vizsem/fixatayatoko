/**
 * XLSX Dynamic Import Utility
 *
 * Menggantikan `import * as XLSX from 'xlsx'` yang bersifat static (menambah ~500KB ke bundle).
 * Dengan dynamic import, library hanya dimuat saat benar-benar dibutuhkan (klik tombol ekspor).
 *
 * Penggunaan:
 *   const { exportToExcel } = await import('@/lib/xlsx-utils');
 *   exportToExcel(data, 'laporan-penjualan');
 *
 *  ATAU gunakan helper langsung:
 *   import { exportToExcel } from '@/lib/xlsx-utils';
 */

/** Ekspor array of objects ke file .xlsx */
export async function exportToExcel(
  rows: Record<string, unknown>[],
  fileName = 'export',
  sheetName = 'Sheet1'
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Ekspor array of arrays (dengan header baris pertama) ke file .xlsx */
export async function exportAoaToExcel(
  aoa: unknown[][],
  fileName = 'export',
  sheetName = 'Sheet1'
): Promise<void> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/** Baca file Excel (dari input file) dan kembalikan sebagai array of objects */
export async function readExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Lazy-load XLSX dan kembalikan instance-nya.
 * Gunakan ini jika butuh akses penuh ke API XLSX.
 */
export async function getXLSX() {
  return import('xlsx');
}
