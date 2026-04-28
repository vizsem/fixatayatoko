import { addDoc, collection, serverTimestamp, WriteBatch, doc, Transaction, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type InventoryLogType = 'MASUK' | 'KELUAR' | 'MUTASI';
export type InventorySource = 'PURCHASE' | 'ORDER' | 'CASHIER' | 'MANUAL' | 'MARKETPLACE' | 'OPNAME' | 'TRANSFER' | 'RECONCILIATION';

export interface InventoryLogData {
  productId: string;
  productName: string;
  type: InventoryLogType;
  amount: number;
  adminId: string; // ID user/admin/operator
  fromWarehouseId?: string;
  toWarehouseId?: string;
  supplierId?: string;
  orderId?: string;
  note?: string;
  source: InventorySource;
  referenceId?: string; // Generic reference ID (Order ID, Purchase ID, etc.)
  prevStock?: number;
  nextStock?: number;
}

/**
 * Menambahkan log inventaris ke koleksi 'inventory_logs'
 * Supports optional batch for atomic operations
 */
export const addInventoryLog = async (data: InventoryLogData, batch?: WriteBatch) => {
  try {
    const logData = {
      ...data,
      date: serverTimestamp(),
    };

    if (batch) {
      const newLogRef = doc(collection(db, 'inventory_logs'));
      batch.set(newLogRef, logData);
    } else {
      await addDoc(collection(db, 'inventory_logs'), logData);
    }
  } catch (error) {
    console.error('Error adding inventory log:', error);
    // Kita tidak throw error agar tidak mengganggu proses utama transaksi
  }
};

/**
 * Mengurangi stok produk secara atomik dalam transaksi, memprioritaskan gudang utama lalu gudang lain
 * dan menulis inventory_log (type: KELUAR).
 */
export const deductStockTx = async (tx: Transaction, params: {
  productId: string;
  amount: number;
  adminId: string;
  note?: string;
  source: InventorySource;
  mainWarehouseId?: string; // default 'gudang-utama'
}) => {
  const { productId, amount, adminId, note, source, mainWarehouseId = 'gudang-utama' } = params;
  if (amount <= 0) return;
  const pRef = doc(db, 'products', productId);
  const snap = await tx.get(pRef);
  if (!snap.exists()) throw new Error('Produk tidak ditemukan');
  const data: any = snap.data() || {};
  const currentStock = Number(data.stock || 0);
  if (currentStock < amount) {
    throw new Error(`Stok tidak cukup. Tersedia ${currentStock}, dibutuhkan ${amount}`);
  }
  const stockByWarehouse: Record<string, number> = data.stockByWarehouse || {};
  const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };
  let remaining = amount;
  // Prioritas gudang utama
  if (nextByWarehouse[mainWarehouseId] && nextByWarehouse[mainWarehouseId] > 0) {
    const cut = Math.min(nextByWarehouse[mainWarehouseId], remaining);
    nextByWarehouse[mainWarehouseId] -= cut;
    remaining -= cut;
  }
  // Gudang lainnya
  if (remaining > 0) {
    for (const [whId, qty] of Object.entries(nextByWarehouse)) {
      if (whId === mainWarehouseId) continue;
      if (remaining <= 0) break;
      const cut = Math.min(Number(qty || 0), remaining);
      nextByWarehouse[whId] = Number(qty || 0) - cut;
      remaining -= cut;
    }
  }
  const nextStock = currentStock - amount;
  tx.update(pRef, { stock: nextStock, stockByWarehouse: nextByWarehouse });
  const logRef = doc(collection(db, 'inventory_logs'));
  tx.set(logRef, {
    productId,
    productName: data.name || data.Nama || 'Produk',
    type: 'KELUAR',
    amount,
    adminId,
    source,
    note: note || '',
    prevStock: currentStock,
    nextStock,
    date: serverTimestamp()
  });
};

/**
 * Menambah stok produk secara atomik dalam transaksi pada gudang tertentu dan menulis inventory_log (type: MASUK).
 */
export const addStockTx = async (tx: Transaction, params: {
  productId: string;
  amount: number;
  warehouseId?: string; // default 'gudang-utama'
  adminId: string;
  note?: string;
  source: InventorySource;
}) => {
  const { productId, amount, warehouseId = 'gudang-utama', adminId, note, source } = params;
  if (amount <= 0) return;
  const pRef = doc(db, 'products', productId);
  const snap = await tx.get(pRef);
  if (!snap.exists()) throw new Error('Produk tidak ditemukan');
  const data: any = snap.data() || {};
  const currentStock = Number(data.stock || 0);
  const stockByWarehouse: Record<string, number> = data.stockByWarehouse || {};
  const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };
  nextByWarehouse[warehouseId] = Number(nextByWarehouse[warehouseId] || 0) + amount;
  const nextStock = currentStock + amount;
  tx.update(pRef, { stock: nextStock, stockByWarehouse: nextByWarehouse });
  const logRef = doc(collection(db, 'inventory_logs'));
  tx.set(logRef, {
    productId,
    productName: data.name || data.Nama || 'Produk',
    type: 'MASUK',
    amount,
    adminId,
    source,
    note: note || '',
    toWarehouseId: warehouseId,
    prevStock: currentStock,
    nextStock,
    date: serverTimestamp()
  });
};

/**
 * Memindahkan stok antar gudang secara atomik.
 * Total stok produk tidak berubah.
 */
export const transferStockTx = async (tx: Transaction, params: {
  productId: string;
  amount: number;
  fromWarehouseId: string;
  toWarehouseId: string;
  adminId: string;
  note?: string;
  source: InventorySource;
}) => {
  const { productId, amount, fromWarehouseId, toWarehouseId, adminId, note, source } = params;
  if (amount <= 0) return;
  if (fromWarehouseId === toWarehouseId) throw new Error('Gudang asal dan tujuan sama');

  const pRef = doc(db, 'products', productId);
  const snap = await tx.get(pRef);
  if (!snap.exists()) throw new Error('Produk tidak ditemukan');
  
  const data: any = snap.data() || {};
  const stockByWarehouse: Record<string, number> = data.stockByWarehouse || {};
  const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };
  
  const currentSourceStock = Number(nextByWarehouse[fromWarehouseId] || 0);
  if (currentSourceStock < amount) {
    throw new Error(`Stok di gudang asal tidak cukup. Tersedia: ${currentSourceStock}`);
  }

  nextByWarehouse[fromWarehouseId] = currentSourceStock - amount;
  nextByWarehouse[toWarehouseId] = Number(nextByWarehouse[toWarehouseId] || 0) + amount;

  // Total stock does not change in a transfer
  tx.update(pRef, { stockByWarehouse: nextByWarehouse });

  const logRef = doc(collection(db, 'inventory_logs'));
  tx.set(logRef, {
    productId,
    productName: data.name || data.Nama || 'Produk',
    type: 'MUTASI',
    amount,
    adminId,
    source, // Usually 'TRANSFER'
    note: note || '',
    fromWarehouseId,
    toWarehouseId,
    prevStock: data.stock, // Total stock unchanged
    nextStock: data.stock,
    date: serverTimestamp()
  });
};

/**
 * Menyesuaikan stok (Opname) secara atomik.
 * Menghitung selisih dan melakukan add/deduct pada gudang tertentu.
 */
export const adjustStockTx = async (tx: Transaction, params: {
  productId: string;
  newStock: number; // Stok fisik baru untuk gudang tertentu
  warehouseId: string;
  adminId: string;
  note?: string;
  source: InventorySource; // Usually 'OPNAME'
}) => {
  const { productId, newStock, warehouseId, adminId, note, source } = params;
  if (newStock < 0) throw new Error('Stok tidak boleh negatif');

  const pRef = doc(db, 'products', productId);
  const snap = await tx.get(pRef);
  if (!snap.exists()) throw new Error('Produk tidak ditemukan');

  const data: any = snap.data() || {};
  const currentTotalStock = Number(data.stock || 0);
  const stockByWarehouse: Record<string, number> = data.stockByWarehouse || {};
  const nextByWarehouse: Record<string, number> = { ...stockByWarehouse };

  const oldWarehouseStock = Number(nextByWarehouse[warehouseId] || 0);
  const diff = newStock - oldWarehouseStock;

  if (diff === 0) return; // No change

  nextByWarehouse[warehouseId] = newStock;
  const nextTotalStock = currentTotalStock + diff;

  tx.update(pRef, { 
    stock: nextTotalStock, 
    stockByWarehouse: nextByWarehouse 
  });

  const logRef = doc(collection(db, 'inventory_logs'));
  tx.set(logRef, {
    productId,
    productName: data.name || data.Nama || 'Produk',
    type: diff > 0 ? 'MASUK' : 'KELUAR',
    amount: Math.abs(diff),
    adminId,
    source,
    note: note || (diff > 0 ? 'Penyesuaian (Lebih)' : 'Penyesuaian (Kurang)'),
    // Jika masuk, toWarehouse = warehouseId. Jika keluar, fromWarehouse = warehouseId.
    toWarehouseId: diff > 0 ? warehouseId : undefined,
    fromWarehouseId: diff < 0 ? warehouseId : undefined,
    prevStock: currentTotalStock,
    nextStock: nextTotalStock,
    date: serverTimestamp()
  });
};


// Pure function for unit testing Average Cost calculation
export const computeAverageCost = (oldStock: number, oldCost: number, newQtyUnits: number, unitCost: number, conversion = 1) => {
  const qtyPcs = newQtyUnits * conversion;
  const incomingCostPerPcs = conversion > 0 ? (unitCost / conversion) : unitCost;
  const effectiveOld = oldCost > 0 ? oldCost : incomingCostPerPcs;
  const newStock = oldStock + qtyPcs;
  if (newStock <= 0) return Math.round(incomingCostPerPcs);
  return Math.round(((oldStock * effectiveOld) + (newQtyUnits * unitCost)) / newStock);
};
