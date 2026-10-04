/**
 * offlineQueue.ts
 * ----------------
 * IndexedDB-based offline transaction queue for the Cashier POS.
 */

import type { TransaksiKasirInput } from '@/lib/actions/cashier.actions';

const DB_NAME = 'pos-offline-db';
const STORE_NAME = 'tx-queue';
const DB_VERSION = 1;

export type OfflineTx = {
  id: string;
  timestamp: number;
  data: TransaksiKasirInput;
  retries: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineTx(data: TransaksiKasirInput): Promise<string> {
  const db = await openDB();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const entry: OfflineTx = { id, timestamp: Date.now(), data, retries: 0 };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineQueue(): Promise<OfflineTx[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineTx[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOfflineTx(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function incrementRetry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(STORE_NAME, 'readwrite');
    const store = txn.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const entry = req.result as OfflineTx;
      if (entry) { entry.retries += 1; store.put(entry); }
    };
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

export async function syncOfflineQueue(
  sendFn: (data: TransaksiKasirInput) => Promise<{ success: boolean; error?: string }>
): Promise<{ synced: number; failed: number }> {
  const queue = await getOfflineQueue();
  let synced = 0, failed = 0;
  for (const entry of queue) {
    try {
      const result = await sendFn(entry.data);
      if (result.success) { await removeOfflineTx(entry.id); synced++; }
      else { await incrementRetry(entry.id); failed++; }
    } catch { await incrementRetry(entry.id); failed++; }
  }
  return { synced, failed };
}
