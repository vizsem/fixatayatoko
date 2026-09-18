/**
 * Stock Sync Service - Sinkronisasi otomatis antara produk dan gudang
 */

import { SyncConfig, StockValidation } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';

class StockSyncService {
  private static instance: StockSyncService;
  private syncChannels: Map<string, any> = new Map();
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
      this.validateSyncParams(productId, warehouseId);
      logger.info(`Memulai sinkronisasi stok untuk produk ${productId} di gudang ${warehouseId}`);

      // Ambil data produk
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      
      if (productError || !product) {
        throw new Error(`Produk ${productId} tidak ditemukan: ${productError?.message || ''}`);
      }

      // Ambil stok produk dari gudang terkait
      const { data: warehouseStockRecord } = await supabase
        .from('warehouseStock')
        .select('*')
        .eq('productId', productId)
        .eq('warehouseId', warehouseId)
        .maybeSingle();
      
      const warehouseStock = Number(warehouseStockRecord?.quantity) || 0;
      this.validateStockValue(warehouseStock, 'Stok gudang');

      // Ambil semua stok gudang untuk produk ini
      const { data: allWarehouseStocks } = await supabase
        .from('warehouseStock')
        .select('*')
        .eq('productId', productId);
      
      let totalStock = 0;
      (allWarehouseStocks || []).forEach((item: any) => {
        const val = Number(item.quantity) || 0;
        totalStock += val;
      });

      this.validateStockValue(totalStock, 'Total stok');

      // Update stok produk
      const currentProductStock = product.stockByWarehouse?.[warehouseId] || 0;
      const updatedStockByWarehouse = {
        ...(product.stockByWarehouse || {}),
        [warehouseId]: warehouseStock
      };

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: totalStock,
          stockByWarehouse: updatedStockByWarehouse,
          updatedAt: new Date().toISOString()
        })
        .eq('id', productId);

      if (updateError) {
        throw updateError;
      }

      // Catat log
      await supabase.from('stockSyncLogs').insert({
        productId,
        warehouseId,
        type: 'WAREHOUSE_TO_PRODUCT',
        status: 'SUCCESS',
        previousStock: currentProductStock,
        newStock: warehouseStock,
        difference: warehouseStock - currentProductStock,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        operator: 'SYSTEM',
        validation: {
          productExists: true,
          warehouseStockExists: !!warehouseStockRecord,
          stockValuesValid: true,
          totalStockValid: true,
          paramsValid: true
        }
      });

      logger.info(`Sinkronisasi berhasil: ${currentProductStock} -> ${warehouseStock} (selisih: ${warehouseStock - currentProductStock}) dalam ${Date.now() - startTime}ms`);
      return true;

    } catch (error) {
      logger.error('Error sinkronisasi stok:', error);
      
      try {
        await supabase.from('stockSyncLogs').insert({
          productId,
          warehouseId,
          type: 'WAREHOUSE_TO_PRODUCT',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
          operator: 'SYSTEM',
          executionTime: Date.now() - startTime,
          validation: {
            paramsValid: true
          }
        });
      } catch (logError) {
        logger.error('Gagal mencatat error log:', logError);
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
      this.validateSyncParams(productId, warehouseId);
      
      if (typeof physicalStock !== 'number' || isNaN(physicalStock)) {
        throw new Error('Stok fisik harus berupa angka yang valid');
      }
      if (physicalStock < 0) {
        throw new Error('Stok fisik tidak boleh negatif');
      }
      if (physicalStock > 10000000) {
        throw new Error('Stok fisik melebihi batas maksimum (10.000.000)');
      }

      logger.info(`Memulai validasi stok untuk produk ${productId} di gudang ${warehouseId}`);

      const { data: stockData } = await supabase
        .from('warehouseStock')
        .select('*')
        .eq('productId', productId)
        .eq('warehouseId', warehouseId)
        .maybeSingle();
      
      const systemStock = Number(stockData?.quantity) || 0;
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

      // Simpan hasil validasi
      await supabase.from('stockValidations').upsert({
        id: `${productId}_${warehouseId}`,
        productId,
        warehouseId,
        systemStock,
        physicalStock,
        difference,
        status,
        lastSync: new Date().toISOString()
      });

      // Catat aktivitas validasi
      await supabase.from('stockValidationLogs').insert({
        productId,
        warehouseId,
        systemStock,
        physicalStock,
        difference,
        status,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      logger.info(`Validasi selesai: sistem=${systemStock}, fisik=${physicalStock}, selisih=${difference}, status=${status} dalam ${Date.now() - startTime}ms`);
      return validation;
      
    } catch (error) {
      logger.error('Error validasi stok:', error);
      
      try {
        await supabase.from('stockValidationLogs').insert({
          productId,
          warehouseId,
          type: 'STOCK_VALIDATION_ERROR',
          physicalStock,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        logger.error('Gagal mencatat error validasi:', logError);
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
      this.validateBatchParams(productIds, warehouseIds);
      logger.info(`Memulai batch sync untuk ${productIds.length} produk dan ${warehouseIds.length} gudang`);
      
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const results: Array<{ productId: string; warehouseId: string; success: boolean; error?: string }> = [];

      for (const productId of productIds) {
        for (const warehouseId of warehouseIds) {
          try {
            logger.info(`Proses sync: ${productId} - ${warehouseId}`);
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
            logger.error(errorMsg);
          }
        }
      }

      try {
        await supabase.from('stockSyncLogs').insert({
          type: 'BATCH_SYNC',
          status: 'COMPLETED',
          totalProducts: productIds.length,
          totalWarehouses: warehouseIds.length,
          success,
          failed,
          errors,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          operator: 'SYSTEM',
          results
        });
      } catch (logError) {
        logger.error('Gagal mencatat log batch sync:', logError);
      }

      logger.info(`Batch sync selesai: ${success} sukses, ${failed} gagal dalam ${Date.now() - startTime}ms`);
      return { success, failed, errors };
      
    } catch (error) {
      logger.error('Error batch sync:', error);
      
      try {
        await supabase.from('stockSyncLogs').insert({
          type: 'BATCH_SYNC',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          operator: 'SYSTEM'
        });
      } catch (logError) {
        logger.error('Gagal mencatat error log batch sync:', logError);
      }
      
      return { success: 0, failed: productIds.length * warehouseIds.length, errors: [error instanceof Error ? error.message : 'Unknown error'] };
    }
  }

  /**
   * Auto-sync listener untuk perubahan stok dengan validasi
   */
  startAutoSync(productId: string, warehouseId: string): () => void {
    try {
      this.validateSyncParams(productId, warehouseId);
      const key = `${productId}_${warehouseId}`;
      
      if (this.syncChannels.has(key)) {
        logger.info(`Auto-sync sudah aktif untuk ${key}`);
        return () => this.stopAutoSync(productId, warehouseId);
      }

      logger.info(`Memulai auto-sync untuk ${key}`);

      const channel = supabase
        .channel(`warehouseStock:${key}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'warehouseStock',
            filter: `productId=eq.${productId}`
          },
          async () => {
            if (this.config.autoSync) {
              try {
                logger.info(`Auto-sync terpicu untuk ${key}`);
                await this.syncWarehouseToProduct(productId, warehouseId);
              } catch (error) {
                logger.error(`Error auto-sync untuk ${key}:`, error);
              }
            }
          }
        )
        .subscribe();

      this.syncChannels.set(key, channel);
      logger.info(`Auto-sync dimulai untuk ${key}`);
      
      return () => {
        this.stopAutoSync(productId, warehouseId);
      };
      
    } catch (error) {
      logger.error('Error startAutoSync:', error);
      return () => {
        logger.info('Auto-sync tidak dimulai karena error');
      };
    }
  }

  /**
   * Hentikan auto-sync
   */
  stopAutoSync(productId: string, warehouseId: string): void {
    const key = `${productId}_${warehouseId}`;
    const channel = this.syncChannels.get(key);
    
    if (channel) {
      supabase.removeChannel(channel);
      this.syncChannels.delete(key);
      logger.info(`Auto-sync dihentikan untuk ${key}`);
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
    return Array.from(this.syncChannels.keys());
  }

  /**
   * Hentikan semua auto-sync listeners
   */
  stopAllAutoSync(): void {
    logger.info(`Menghentikan ${this.syncChannels.size} auto-sync listeners`);
    this.syncChannels.forEach((channel, key) => {
      try {
        supabase.removeChannel(channel);
        logger.info(`Auto-sync dihentikan untuk ${key}`);
      } catch (error) {
        logger.error(`Error menghentikan auto-sync untuk ${key}:`, error);
      }
    });
    this.syncChannels.clear();
    logger.info('Semua auto-sync listeners dihentikan');
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

      const { data: records, error } = await supabase
        .from('stockSyncLogs')
        .select('*')
        .gte('timestamp', startDate.toISOString());
      
      if (error || !records) {
        return { total: 0, success: 0, failed: 0, averageExecutionTime: 0 };
      }

      let total = 0;
      let success = 0;
      let failed = 0;
      let totalExecutionTime = 0;

      records.forEach((data: any) => {
        total++;
        if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
          success++;
        } else if (data.status === 'ERROR') {
          failed++;
        }
        if (data.executionTime) {
          totalExecutionTime += Number(data.executionTime) || 0;
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
      logger.error('Error getSyncStats:', error);
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
    logger.info('Membersihkan StockSyncService...');
    stockSyncService.stopAllAutoSync();
  });
}

// Export types
export type { StockSyncService };