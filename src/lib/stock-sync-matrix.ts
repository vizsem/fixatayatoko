/**
 * Perhitungan matriks sinkronisasi stok.
 *
 * Sengaja dipisah dari Server Action (`actions/stock-sync.actions.ts`) karena
 * file bertanda `'use server'` hanya boleh mengekspor fungsi async, sehingga
 * logika murni di sini tidak bisa diuji langsung dari sana.
 *
 * Modul ini murni (tanpa I/O) sehingga mudah diuji.
 */

export interface StockSyncRow {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  systemStock: number;
  warehouseStock: number;
  difference: number;
  status: 'SYNCED' | 'OUT_OF_SYNC' | 'PENDING' | 'ERROR';
}

/** Ambang selisih yang dianggap OUT_OF_SYNC (di atas ini). */
export const OUT_OF_SYNC_THRESHOLD = 5;

type Row = Record<string, any>;

/**
 * Bangun matriks perbandingan stok antara data sistem (`products.stockByWarehouse`)
 * dan data fisik per gudang (`warehouseStock.quantity`).
 *
 * Semantik status (dipertahankan dari implementasi lama):
 *   - `SYNCED`      : selisih 0
 *   - `OUT_OF_SYNC` : selisih > 5 unit
 *   - `PENDING`     : selisih 1..5 unit
 */
export function buildSyncMatrix(
  products: Row[],
  warehouses: Row[],
  warehouseStocks: Row[]
): StockSyncRow[] {
  // Peta `${productId}_${warehouseId}` -> quantity
  const stockByKey = new Map<string, number>();
  for (const row of warehouseStocks) {
    stockByKey.set(`${row.productId}_${row.warehouseId}`, Number(row.quantity ?? 0) || 0);
  }

  const result: StockSyncRow[] = [];

  for (const product of products) {
    const productId = String(product.id ?? '');
    const byWarehouse = (product.stockByWarehouse || {}) as Record<string, unknown>;

    for (const warehouse of warehouses) {
      const warehouseId = String(warehouse.id ?? '');

      const warehouseStock = stockByKey.get(`${productId}_${warehouseId}`) ?? 0;
      const systemStock = Number(byWarehouse[warehouseId] ?? 0) || 0;
      const difference = Math.abs(warehouseStock - systemStock);

      let status: StockSyncRow['status'] = 'SYNCED';
      if (difference > OUT_OF_SYNC_THRESHOLD) status = 'OUT_OF_SYNC';
      else if (difference > 0) status = 'PENDING';

      result.push({
        id: `${productId}_${warehouseId}`,
        productId,
        productName: String(product.name || 'Untitled'),
        warehouseId,
        warehouseName: String(warehouse.name || 'Unknown'),
        systemStock,
        warehouseStock,
        difference,
        status,
      });
    }
  }

  return result;
}
