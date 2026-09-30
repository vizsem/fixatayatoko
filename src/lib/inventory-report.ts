/**
 * Perhitungan laporan valuasi & perputaran stok.
 *
 * Murni (tanpa I/O) agar bisa diuji; Server Action di
 * `actions/inventory-report.actions.ts` hanya mengambil data mentah.
 *
 * Catatan performa: implementasi lama memfilter seluruh daftar transaksi DUA KALI
 * untuk setiap produk (O(produk x transaksi)). Di sini transaksi diagregasi sekali
 * dalam satu lintasan (O(produk + transaksi)) dengan hasil yang sama.
 */

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  stockIn: number;
  stockOut: number;
  turnoverRate: number;
  stockValue: number;
  imageUrl?: string;
  warehouseId?: string;
}

export interface InventoryWarehouse {
  id: string;
  name: string;
}

export interface InventoryReportResult {
  inventory: InventoryItem[];
  warehouses: InventoryWarehouse[];
}

/** Rasio harga modal bila harga beli tidak tersedia. */
export const FALLBACK_COST_RATIO = 0.8;

type Row = Record<string, any>;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Bangun laporan inventori dari produk, transaksi stok, dan daftar gudang.
 *
 * `transactions` diharapkan sudah dinormalisasi (kolom `raw_data` sudah di-merge),
 * sehingga `productId` / `type` / `quantity` bisa dibaca langsung.
 */
export function buildInventoryReport(
  products: Row[],
  transactions: Row[],
  warehouses: Row[]
): InventoryReportResult {
  // Agregasi stok masuk/keluar per produk dalam satu lintasan.
  const stockInByProduct = new Map<string, number>();
  const stockOutByProduct = new Map<string, number>();

  for (const t of transactions) {
    const productId = String(t.productId ?? '');
    if (!productId) continue;

    const qty = toNumber(t.quantity);
    if (t.type === 'STOCK_IN') {
      stockInByProduct.set(productId, (stockInByProduct.get(productId) ?? 0) + qty);
    } else if (t.type === 'STOCK_OUT') {
      stockOutByProduct.set(productId, (stockOutByProduct.get(productId) ?? 0) + qty);
    }
  }

  const inventory: InventoryItem[] = products.map((p) => {
    const id = String(p.id ?? '');
    const currentStock = toNumber(p.stock);
    const stockIn = stockInByProduct.get(id) ?? 0;
    const stockOut = stockOutByProduct.get(id) ?? 0;

    // Sengaja memakai `||` (bukan `??`) agar sama dengan implementasi lama:
    // nilai 0 dianggap "tidak ada" dan jatuh ke sumber harga berikutnya.
    const cost = toNumber(p.Modal || p.purchasePrice || toNumber(p.priceEcer) * FALLBACK_COST_RATIO);

    return {
      id,
      name: String(p.name ?? ''),
      category: String(p.category ?? ''),
      currentStock,
      stockIn,
      stockOut,
      turnoverRate: currentStock > 0 ? stockOut / currentStock : 0,
      stockValue: currentStock * cost,
      imageUrl: p.imageUrl,
      warehouseId: p.warehouseId,
    };
  });

  return {
    inventory,
    warehouses: warehouses.map((w) => ({
      id: String(w.id ?? ''),
      name: String(w.name ?? w.id ?? ''),
    })),
  };
}
