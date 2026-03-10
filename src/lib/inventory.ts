import { addDoc, collection, serverTimestamp, WriteBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type InventoryLogType = 'MASUK' | 'KELUAR' | 'MUTASI';
export type InventorySource = 'PURCHASE' | 'ORDER' | 'CASHIER' | 'MANUAL' | 'MARKETPLACE' | 'OPNAME' | 'TRANSFER';

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
