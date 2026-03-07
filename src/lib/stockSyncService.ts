/**
 * Stock Sync Service - Sinkronisasi otomatis antara produk dan gudang
 */

import { db } from '@/lib/firebase';
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  addDoc,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { SyncConfig, StockSyncLog, StockValidation } from '@/lib/types';

class StockSyncService {
  private static instance: StockSyncService;
  private syncListeners: Map<string, () => void> = new Map();
  private config: SyncConfig = {
    autoSync: true,
    syncInterval: 5000,
    maxRetries: 3,
    batchSize: 50,
    validationThreshold: 5,
    enableValidation: true,
    enableNotifications: true,
    logLevel: 'INFO'
  };

  private constructor() {}

  static getInstance(): StockSyncService {
    if (!StockSyncService.instance) {
      StockSyncService.instance = new StockSyncService();
    }
    return StockSyncService.instance;
  }

  /**
   * Validasi input parameter
   */
  private validateSyncParams(productId: string, warehouseId: string): void {
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      throw new Error('Product ID harus valid dan tidak kosong');
    }
    if (!warehouseId || typeof warehouseId !== 'string' || warehouseId.trim() === '') {
      throw new Error('Warehouse ID harus valid dan tidak kosong');
    }
  }

  /**
   * Validasi nilai stok
   */
  private validateStockValue(stock: number, fieldName: string): void {
    if (typeof stock !== 'number' || isNaN(stock)) {
      throw new Error(`${fieldName} harus berupa angka yang valid`);
    }
    if (stock < 0) {
      throw new Error(`${fieldName} tidak boleh negatif`);
    }
    if (stock > 10000000) {
      throw new Error(`${fieldName} melebihi batas maksimum (10.000.000)`);
    }
  }

  /**
   * Sinkronisasi stok dari gudang ke produk dengan validasi lengkap
   */
  async syncWarehouseToProduct(productId: string, warehouseId: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Validasi parameter input
      this.validateSyncParams(productId, warehouseId);
      
      console.log(`Memulai sinkronisasi stok untuk produk ${productId} di gudang ${warehouseId}`);

      // Ambil data produk dengan error handling
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDocs(collection(db, 'products'));
      const productDoc = productSnap.docs.find(doc => doc.id === productId);
      
      if (!productDoc) {
        throw new Error(`Produk ${productId} tidak ditemukan`);
      }

      const product = productDoc.data();
      
      // Validasi struktur data produk
      if (!product || typeof product !== 'object') {
        throw new Error('Data produk tidak valid');
      }

      // Validasi nama produk
      if (!product.name || typeof product.name !== 'string') {
        throw new Error('Nama produk tidak valid');
      }

      // Ambil stok dari gudang dengan error handling
      const warehouseStockRef = collection(db, 'warehouseStock');
      const q = query(warehouseStockRef, 
        where('productId', '==', productId),
        where('warehouseId', '==', warehouseId)
      );
      
      const warehouseStockSnap = await getDocs(q);
      
      // Validasi hasil query
      if (warehouseStockSnap.empty) {
        console.warn(`Tidak ada data warehouse stock untuk produk ${productId} di gudang ${warehouseId}`);
      }
      
      const warehouseStockData = warehouseStockSnap.docs[0]?.data();
      const warehouseStock = warehouseStockData?.quantity || 0;

      // Validasi nilai stok gudang
      this.validateStockValue(warehouseStock, 'Stok gudang');

      // Hitung total stok dari semua gudang dengan validasi
      const allWarehouseStockSnap = await getDocs(
        query(warehouseStockRef, where('productId', '==', productId))
      );
      
      let totalStock = 0;
      allWarehouseStockSnap.forEach(doc => {
        const stockValue = Number(doc.data().quantity) || 0;
        this.validateStockValue(stockValue, `Stok gudang ${doc.id}`);
        totalStock += stockValue;
      });

      // Validasi total stok
      this.validateStockValue(totalStock, 'Total stok');

      // Siapkan data stok per gudang
      const currentProductStock = product.stockByWarehouse?.[warehouseId] || 0;
      const updatedStockByWarehouse = {
        ...product.stockByWarehouse,
        [warehouseId]: warehouseStock
      };

      // Update stok produk dengan batch untuk atomic operation
      const batch = writeBatch(db);
      batch.update(productRef, {
        stock: totalStock,
        stockByWarehouse: updatedStockByWarehouse,
        lastSyncAt: serverTimestamp(),
        lastSyncWarehouse: warehouseId
      });

      // Catat aktivitas sinkronisasi dengan detail lengkap
      const syncLogRef = collection(db, 'stockSyncLogs');
      batch.set(doc(syncLogRef), {
        productId,
        warehouseId,
        type: 'WAREHOUSE_TO_PRODUCT',
        previousStock: currentProductStock,
        newStock: warehouseStock,
        difference: warehouseStock - currentProductStock,
        status: 'SUCCESS',
        timestamp: serverTimestamp(),
        operator: 'SYSTEM',
        executionTime: Date.now() - startTime,
        validation: {
          productExists: true,
          warehouseStockExists: !warehouseStockSnap.empty,
          stockValuesValid: true,
          totalStockValid: true
        }
      });

      await batch.commit();
      
      console.log(`Sinkronisasi berhasil: ${currentProductStock} -> ${warehouseStock} (selisih: ${warehouseStock - currentProductStock}) dalam ${Date.now() - startTime}ms`);
      return true;

    } catch (error) {
      console.error('Error sinkronisasi stok:', error);
      
      // Catat error ke log dengan detail lengkap
      try {
        await addDoc(collection(db, 'stockSyncLogs'), {
          productId,
          warehouseId,
          type: 'WAREHOUSE_TO_PRODUCT',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: serverTimestamp(),
          operator: 'SYSTEM',
          executionTime: Date.now() - startTime,
          validation: {
            paramsValid: true
          }
        });
      } catch (logError) {
        console.error('Gagal mencatat error log:', logError);
      }
      
      return false;
    }
  }

  /**
   * Validasi stok antara sistem dan fisik dengan validasi lengkap
   */
  async validateStock(productId: string, warehouseId: string, physicalStock: number): Promise<StockValidation> {
    const startTime = Date.now();
    
    try {
      // Validasi parameter input
      this.validateSyncParams(productId, warehouseId);
      
      // Validasi stok fisik
      if (typeof physicalStock !== 'number' || isNaN(physicalStock)) {
        throw new Error('Stok fisik harus berupa angka yang valid');
      }
      if (physicalStock < 0) {
        throw new Error('Stok fisik tidak boleh negatif');
      }
      if (physicalStock > 10000000) {
        throw new Error('Stok fisik melebihi batas maksimum (10.000.000)');
      }

      console.log(`Memulai validasi stok untuk produk ${productId} di gudang ${warehouseId}`);

      // Ambil stok dari sistem dengan error handling
      const warehouseStockRef = collection(db, 'warehouseStock');
      const q = query(warehouseStockRef, 
        where('productId', '==', productId),
        where('warehouseId', '==', warehouseId)
      );
      
      const systemStockSnap = await getDocs(q);
      
      if (systemStockSnap.empty) {
        console.warn(`Tidak ada data warehouse stock untuk produk ${productId} di gudang ${warehouseId}`);
      }
      
      const systemStock = systemStockSnap.docs[0]?.data()?.quantity || 0;

      // Validasi stok sistem
      this.validateStockValue(systemStock, 'Stok sistem');

      const difference = Math.abs(systemStock - physicalStock);
      const status = difference <= this.config.validationThreshold ? 'VALID' : 'INVALID';

      const validation: StockValidation = {
        productId,
        warehouseId,
        systemStock,
        physicalStock,
        difference,
        lastSync: new Date(),
        status
      };

      // Simpan hasil validasi dengan batch untuk atomic operation
      const batch = writeBatch(db);
      const validationRef = doc(db, 'stockValidations', `${productId}_${warehouseId}`);
      
      batch.set(validationRef, {
        ...validation,
        timestamp: serverTimestamp(),
        validationThreshold: this.config.validationThreshold,
        executionTime: Date.now() - startTime
      });

      // Catat aktivitas validasi
      const validationLogRef = collection(db, 'stockValidationLogs');
      const newLogRef = doc(validationLogRef);
      batch.set(newLogRef, {
        productId,
        warehouseId,
        type: 'STOCK_VALIDATION',
        systemStock,
        physicalStock,
        difference,
        status,
        validationThreshold: this.config.validationThreshold,
        timestamp: serverTimestamp(),
        executionTime: Date.now() - startTime
      });

      await batch.commit();

      console.log(`Validasi selesai: sistem=${systemStock}, fisik=${physicalStock}, selisih=${difference}, status=${status} dalam ${Date.now() - startTime}ms`);
      
      return validation;
      
    } catch (error) {
      console.error('Error validasi stok:', error);
      
      // Catat error validasi
      try {
        await addDoc(collection(db, 'stockValidationLogs'), {
          productId,
          warehouseId,
          type: 'STOCK_VALIDATION_ERROR',
          physicalStock,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          timestamp: serverTimestamp()
        });
      } catch (logError) {
        console.error('Gagal mencatat error validasi:', logError);
      }
      
      throw error;
    }
  }

  /**
   * Validasi array parameter untuk batch sync
   */
  private validateBatchParams(productIds: string[], warehouseIds: string[]): void {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error('Product IDs harus berupa array yang tidak kosong');
    }
    if (!Array.isArray(warehouseIds) || warehouseIds.length === 0) {
      throw new Error('Warehouse IDs harus berupa array yang tidak kosong');
    }
    
    // Validasi setiap ID
    productIds.forEach((id, index) => {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`Product ID pada index ${index} tidak valid`);
      }
    });
    
    warehouseIds.forEach((id, index) => {
      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new Error(`Warehouse ID pada index ${index} tidak valid`);
      }
    });
  }

  /**
   * Sinkronisasi batch untuk multiple produk dengan validasi
   */
  async batchSync(productIds: string[], warehouseIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const startTime = Date.now();
    
    try {
      // Validasi parameter input
      this.validateBatchParams(productIds, warehouseIds);
      
      console.log(`Memulai batch sync untuk ${productIds.length} produk dan ${warehouseIds.length} gudang`);
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const results: Array<{ productId: string; warehouseId: string; success: boolean; error?: string }> = [];

      // Proses sinkronisasi untuk setiap kombinasi
      for (const productId of productIds) {
        for (const warehouseId of warehouseIds) {
          try {
            console.log(`Proses sync: ${productId} - ${warehouseId}`);
            const result = await this.syncWarehouseToProduct(productId, warehouseId);
            
            results.push({ productId, warehouseId, success: result });
            
            if (result) {
              success++;
            } else {
              failed++;
              errors.push(`Gagal sync ${productId} - ${warehouseId}`);
            }
          } catch (error) {
            failed++;
            const errorMsg = `Error sync ${productId} - ${warehouseId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }

      // Catat hasil batch sync
      try {
        await addDoc(collection(db, 'stockSyncLogs'), {
          type: 'BATCH_SYNC',
          status: 'COMPLETED',
          totalProducts: productIds.length,
          totalWarehouses: warehouseIds.length,
          success,
          failed,
          errors,
          executionTime: Date.now() - startTime,
          timestamp: serverTimestamp(),
          operator: 'SYSTEM',
          results
        });
      } catch (logError) {
        console.error('Gagal mencatat log batch sync:', logError);
      }

      console.log(`Batch sync selesai: ${success} sukses, ${failed} gagal dalam ${Date.now() - startTime}ms`);
      return { success, failed, errors };
      
    } catch (error) {
      console.error('Error batch sync:', error);
      
      // Catat error batch sync
      try {
        await addDoc(collection(db, 'stockSyncLogs'), {
          type: 'BATCH_SYNC',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          timestamp: serverTimestamp(),
          operator: 'SYSTEM'
        });
      } catch (logError) {
        console.error('Gagal mencatat error log batch sync:', logError);
      }
      
      return { success: 0, failed: productIds.length * warehouseIds.length, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  /**
   * Auto-sync listener untuk perubahan stok dengan validasi
   */
  startAutoSync(productId: string, warehouseId: string): () => void {
    try {
      // Validasi parameter input
      this.validateSyncParams(productId, warehouseId);
      
      const key = `${productId}_${warehouseId}`;
      
      if (this.syncListeners.has(key)) {
        console.log(`Auto-sync sudah aktif untuk ${key}`);
        return this.syncListeners.get(key)!;
      }

      console.log(`Memulai auto-sync untuk ${key}`);

      const unsubscribe = onSnapshot(
        doc(db, 'warehouseStock', `${productId}_${warehouseId}`),
        async (doc) => {
          if (doc.exists() && this.config.autoSync) {
            try {
              console.log(`Auto-sync terpicu untuk ${key}`);
              await this.syncWarehouseToProduct(productId, warehouseId);
            } catch (error) {
              console.error(`Error auto-sync untuk ${key}:`, error);
            }
          }
        },
        (error) => {
          console.error(`Error listener auto-sync untuk ${key}:`, error);
        }
      );

      this.syncListeners.set(key, unsubscribe);
      console.log(`Auto-sync dimulai untuk ${key}`);
      
      return () => {
        unsubscribe();
        this.syncListeners.delete(key);
        console.log(`Auto-sync dihentikan untuk ${key}`);
      };
      
    } catch (error) {
      console.error('Error startAutoSync:', error);
      
      // Return dummy unsubscribe function untuk error handling yang konsisten
      return () => {
        console.log('Auto-sync tidak dimulai karena error');
      };
    }
  }

  /**
   * Hentikan auto-sync
   */
  stopAutoSync(productId: string, warehouseId: string): void {
    const key = `${productId}_${warehouseId}`;
    const unsubscribe = this.syncListeners.get(key);
    
    if (unsubscribe) {
      unsubscribe();
      this.syncListeners.delete(key);
    }
  }

  /**
   * Update konfigurasi
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get konfigurasi
   */
  getConfig(): SyncConfig {
    return this.config;
  }

  /**
   * Get status auto-sync listeners
   */
  getActiveListeners(): string[] {
    return Array.from(this.syncListeners.keys());
  }

  /**
   * Hentikan semua auto-sync listeners
   */
  stopAllAutoSync(): void {
    console.log(`Menghentikan ${this.syncListeners.size} auto-sync listeners`);
    this.syncListeners.forEach((unsubscribe, key) => {
      try {
        unsubscribe();
        console.log(`Auto-sync dihentikan untuk ${key}`);
      } catch (error) {
        console.error(`Error menghentikan auto-sync untuk ${key}:`, error);
      }
    });
    this.syncListeners.clear();
    console.log('Semua auto-sync listeners dihentikan');
  }

  /**
   * Get statistik sinkronisasi
   */
  async getSyncStats(timeRange: 'day' | 'week' | 'month' = 'day'): Promise<{
    total: number;
    success: number;
    failed: number;
    averageExecutionTime: number;
  }> {
    try {
      const now = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      const logsRef = collection(db, 'stockSyncLogs');
      const q = query(
        logsRef,
        where('timestamp', '>=', startDate),
        where('type', 'in', ['WAREHOUSE_TO_PRODUCT', 'BATCH_SYNC'])
      );
      
      const snapshot = await getDocs(q);
      
      let total = 0;
      let success = 0;
      let failed = 0;
      let totalExecutionTime = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        total++;
        
        if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
          success++;
        } else if (data.status === 'ERROR') {
          failed++;
        }
        
        if (data.executionTime) {
          totalExecutionTime += data.executionTime;
        }
      });

      const averageExecutionTime = total > 0 ? totalExecutionTime / total : 0;

      return {
        total,
        success,
        failed,
        averageExecutionTime
      };
      
    } catch (error) {
      console.error('Error getSyncStats:', error);
      return {
        total: 0,
        success: 0,
        failed: 0,
        averageExecutionTime: 0
      };
    }
  }
}

// Export singleton instance
export const stockSyncService = StockSyncService.getInstance();

// Cleanup function untuk browser
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('Membersihkan StockSyncService...');
    stockSyncService.stopAllAutoSync();
  });
}

// Export types
export type { StockSyncService };