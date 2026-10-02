// Logika FIFO lapisan persediaan (inventory layers).
//
// Lapisan (layer) mencatat setiap batch stok MASUK beserta harga pokoknya
// (costPerPcs) sehingga nilai persediaan bisa diaudit secara FIFO: stok keluar
// memakan batch tertua lebih dulu. Lapisan disimpan di `products.raw_data.
// inventoryLayers`, dan bisa disusun ulang dari `inventory_logs` bila belum ada.

export type InventoryLayer = {
  qty: number;
  costPerPcs: number;
  /** Waktu batch masuk; mendukung string ISO, epoch ms, atau { seconds }. */
  ts?: string | number | { seconds: number; nanoseconds?: number };
  purchaseId?: string;
  supplierName?: string;
  warehouseId?: string;
};

export type LayerLogEntry = {
  type?: string;
  amount?: number;
  quantity?: number;
  costPerPcs?: number;
  ts?: string | number | { seconds: number; nanoseconds?: number };
  purchaseId?: string;
  supplierName?: string;
  warehouseId?: string;
};

const INBOUND_TYPES = new Set([
  'MASUK',
  'IN',
  'RESTOCK',
  'RETUR',
  'RETURN',
  'STOCK_IN',
  'PURCHASE',
  'OPNAME_MASUK',
]);

const OUTBOUND_TYPES = new Set([
  'KELUAR',
  'OUT',
  'STOCK_OUT',
  'ORDER',
  'CASHIER',
  'MARKETPLACE',
  'SALES',
  'PENJUALAN',
  'OPNAME_KELUAR',
]);

export function isInboundType(type?: string): boolean {
  return INBOUND_TYPES.has(String(type || '').toUpperCase());
}

export function isOutboundType(type?: string): boolean {
  return OUTBOUND_TYPES.has(String(type || '').toUpperCase());
}

/** Ubah bentuk timestamp apa pun menjadi epoch milidetik (0 bila tak terbaca). */
export function tsMs(ts: InventoryLayer['ts']): number {
  if (ts == null) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof ts === 'object' && typeof (ts as any).seconds === 'number') {
    return (ts as any).seconds * 1000;
  }
  return 0;
}

/** Tambahkan batch masuk ke belakang antrean FIFO (urutan tertua → terbaru). */
export function pushLayer(
  layers: InventoryLayer[],
  layer: InventoryLayer
): InventoryLayer[] {
  const qty = Number(layer.qty || 0);
  if (!Number.isFinite(qty) || qty <= 0) return layers;
  return [...(layers || []), { ...layer, qty }];
}

/**
 * Konsumsi `qty` dari depan antrean FIFO (batch tertua dulu).
 * Mengembalikan sisa lapisan, nilai HPP yang termakan, dan kekurangannya.
 */
export function consumeFifo(
  layers: InventoryLayer[],
  qty: number
): {
  remaining: InventoryLayer[];
  consumedCost: number;
  consumedQty: number;
  shortage: number;
} {
  const remaining: InventoryLayer[] = [];
  let left = Math.max(0, Number(qty) || 0);
  let consumedCost = 0;
  let consumedQty = 0;

  for (const layer of layers || []) {
    if (left <= 0) {
      remaining.push(layer);
      continue;
    }
    const layerQty = Number(layer.qty || 0);
    if (!Number.isFinite(layerQty) || layerQty <= 0) continue;
    const take = Math.min(layerQty, left);
    consumedCost += take * Number(layer.costPerPcs || 0);
    consumedQty += take;
    const rest = layerQty - take;
    if (rest > 0) remaining.push({ ...layer, qty: rest });
    left -= take;
  }

  return {
    remaining,
    consumedCost: Math.round(consumedCost),
    consumedQty,
    shortage: Math.max(0, left),
  };
}

/**
 * Susun ulang lapisan FIFO dari aliran log kronologis (rekonstruksi dari
 * `inventory_logs`). Tipe log yang tidak dikenali (mis. MUTASI/transfer yang
 * tidak mengubah stok total) diabaikan.
 *
 * `fallbackCost` dipakai untuk batch masuk yang tidak membawa harga (log lama).
 */
export function reconstructLayersFromLogs(
  logs: LayerLogEntry[],
  fallbackCost?: (entry: LayerLogEntry) => number
): InventoryLayer[] {
  const sorted = [...(logs || [])].sort((a, b) => tsMs(a.ts) - tsMs(b.ts));
  let layers: InventoryLayer[] = [];

  for (const entry of sorted) {
    const qty = Math.abs(Number(entry.amount ?? entry.quantity ?? 0));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const type = String(entry.type || '').toUpperCase();

    if (isInboundType(type)) {
      const rawCost = Number(entry.costPerPcs ?? (fallbackCost ? fallbackCost(entry) : 0));
      layers = pushLayer(layers, {
        qty,
        costPerPcs: Number.isFinite(rawCost) ? rawCost : 0,
        ts: entry.ts,
        purchaseId: entry.purchaseId,
        supplierName: entry.supplierName,
        warehouseId: entry.warehouseId,
      });
    } else if (isOutboundType(type)) {
      layers = consumeFifo(layers, qty).remaining;
    }
  }

  return layers;
}
